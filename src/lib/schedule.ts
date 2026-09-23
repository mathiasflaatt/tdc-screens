import { parseSessionInstant } from './time.js';
export { parseSessionInstant } from './time.js';

export const OSLO_TIME_ZONE = 'Europe/Oslo';

export type DisplayRoom = { id: string; name: string };
export type DisplaySpeaker = { id: string; name: string; portraitUrl?: string };

export type DisplaySession = {
  id: string;
  roomId: string;
  room: string;
  title: string;
  startsAt: string;
  endsAt: string;
  speakers: DisplaySpeaker[];
  isServiceSession: boolean;
  isPlenumSession: boolean;
};

export type ScheduleSnapshot = {
  rooms: DisplayRoom[];
  sessions: DisplaySession[];
  fetchedAt: string;
};

export type RoomContext =
  | { type: 'break' }
  | { type: 'lunch' }
  | { type: 'plenary'; room: string };

export type RoomDisplayState = {
  phase: 'live' | 'service' | 'before' | 'between' | 'ended' | 'empty' | 'complete';
  session?: DisplaySession;
  context?: RoomContext;
};

export type CommonRoomPhase = 'live' | 'before' | 'break' | 'lunch' | 'next' | 'ended' | 'empty';

export type CommonRoomDisplay = {
  room: DisplayRoom;
  phase: CommonRoomPhase;
  session?: DisplaySession;
};

export type CommonDisplayState = {
  phase: 'scheduled' | 'complete' | 'empty';
  rooms: CommonRoomDisplay[];
  plenary?: DisplaySession;
};

type TimedSession = { session: DisplaySession; start: number; end: number };

const osloFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: OSLO_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const osloDateKeyFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: OSLO_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function formatOsloTime(instant: number): string {
  return osloFormatter.format(instant);
}

export function formatOsloDate(instant: number): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: OSLO_TIME_ZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(instant);
}

function osloDateKey(instant: number): string {
  return osloDateKeyFormatter.format(instant);
}

function timedSessions(snapshot: ScheduleSnapshot): TimedSession[] {
  return snapshot.sessions
    .map((session) => ({
      session,
      start: parseSessionInstant(session.startsAt),
      end: parseSessionInstant(session.endsAt),
    }))
    .filter((entry): entry is TimedSession => entry.start !== null && entry.end !== null)
    .sort((left, right) => left.start - right.start);
}

export function formatSessionRange(session: DisplaySession): string {
  const start = parseSessionInstant(session.startsAt);
  const end = parseSessionInstant(session.endsAt);
  if (start === null || end === null) return '';
  return `${formatOsloTime(start)}–${formatOsloTime(end)}`;
}

export function formatSessionStart(session: DisplaySession): string {
  const start = parseSessionInstant(session.startsAt);
  return start === null ? '' : formatOsloTime(start);
}

function contextForService(session: DisplaySession): RoomContext | null {
  if (!session.isServiceSession) return null;
  const title = session.title.toLocaleLowerCase();
  if (title.includes('lunch')) return { type: 'lunch' };
  if (title.includes('break') || title.includes('coffee')) return { type: 'break' };
  return null;
}

function currentEntry(sessions: TimedSession[], now: number): TimedSession | undefined {
  return sessions.find(({ start, end }) => start <= now && now < end);
}

function nextRoomTalk(sessions: TimedSession[], now: number): TimedSession | undefined {
  return sessions.find(({ session, start }) => !session.isServiceSession && start > now);
}

function nextPlenaryContext(
  sessions: TimedSession[],
  roomId: string,
  now: number,
): RoomContext | undefined {
  const plenary = sessions.find(({ session, start, end }) =>
    session.isPlenumSession && session.roomId !== roomId && start <= now && now < end,
  );
  return plenary ? { type: 'plenary', room: plenary.session.room } : undefined;
}

export function getRoomDisplayState(
  snapshot: ScheduleSnapshot,
  roomId: string,
  now: number,
): RoomDisplayState {
  const allSessions = timedSessions(snapshot);
  if (allSessions.length === 0) return { phase: 'empty' };

  const programEnd = Math.max(...allSessions.map(({ end }) => end));
  if (now >= programEnd) return { phase: 'complete' };

  const roomSessions = allSessions.filter(({ session }) => session.roomId === roomId);
  if (roomSessions.length === 0) return { phase: 'empty' };

  const programStart = Math.min(...allSessions.map(({ start }) => start));
  if (now < programStart) {
    const firstTalk = roomSessions.find(({ session }) => !session.isServiceSession);
    return firstTalk ? { phase: 'before', session: firstTalk.session } : { phase: 'empty' };
  }

  const localCurrent = currentEntry(roomSessions, now);
  if (localCurrent) {
    const serviceContext = contextForService(localCurrent.session);
    if (serviceContext) {
      const nextTalk = nextRoomTalk(roomSessions, now);
      if (nextTalk) return { phase: 'between', session: nextTalk.session, context: serviceContext };
    }
    return {
      phase: localCurrent.session.isServiceSession ? 'service' : 'live',
      session: localCurrent.session,
    };
  }

  const localDate = osloDateKey(now);
  const todaySessions = roomSessions.filter(({ start }) => osloDateKey(start) === localDate);
  const nextTalk = todaySessions.find(({ session, start }) => !session.isServiceSession && start > now);
  if (!nextTalk) return { phase: 'ended' };

  const firstTalkToday = todaySessions.find(({ session }) => !session.isServiceSession);
  const phase = firstTalkToday && now < firstTalkToday.start ? 'before' : 'between';
  const sharedService = allSessions.find(({ session, start, end }) =>
    session.roomId !== roomId &&
    start <= now && now < end &&
    contextForService(session) !== null,
  );
  const context = sharedService
    ? contextForService(sharedService.session) ?? undefined
    : nextPlenaryContext(allSessions, roomId, now);
  return { phase, session: nextTalk.session, context };
}

export function getUpcomingRoomSessions(
  snapshot: ScheduleSnapshot,
  roomId: string,
  now: number,
  featuredSession?: DisplaySession,
): DisplaySession[] {
  const dateKey = featuredSession
    ? osloDateKey(parseSessionInstant(featuredSession.startsAt) ?? now)
    : osloDateKey(now);
  return timedSessions(snapshot)
    .filter(({ session, start }) =>
      session.roomId === roomId &&
      !session.isServiceSession &&
      start > now &&
      osloDateKey(start) === dateKey &&
      session.id !== featuredSession?.id,
    )
    .slice(0, 2)
    .map(({ session }) => session);
}

export function getCommonDisplayState(snapshot: ScheduleSnapshot, now: number): CommonDisplayState {
  const allSessions = timedSessions(snapshot);
  if (allSessions.length === 0) return { phase: 'empty', rooms: [] };

  const talks = allSessions.filter(({ session }) => !session.isServiceSession && !session.isPlenumSession);
  if (talks.length === 0) return { phase: 'empty', rooms: [] };

  const programEnd = Math.max(...allSessions.map(({ end }) => end));
  if (now >= programEnd) return { phase: 'complete', rooms: [] };

  const talkRoomIds = new Set(talks.map(({ session }) => session.roomId));
  const rooms = snapshot.rooms.filter((room) => talkRoomIds.has(room.id));
  if (rooms.length === 0) return { phase: 'empty', rooms: [] };

  const programStart = Math.min(...talks.map(({ start }) => start));
  const beforeEvent = now < programStart;
  const today = osloDateKey(now);
  const activeServiceContext = allSessions
    .filter(({ session, start, end }) =>
      session.isServiceSession && start <= now && now < end && contextForService(session) !== null,
    )
    .map(({ session }) => contextForService(session))
    .find((context) => context?.type === 'lunch')
    ?? allSessions
      .filter(({ session, start, end }) =>
        session.isServiceSession && start <= now && now < end && contextForService(session)?.type === 'break',
      )
      .map(({ session }) => contextForService(session))
      .find((context) => context?.type === 'break');

  const roomStates = rooms.map((room): CommonRoomDisplay => {
    const roomTalks = talks.filter(({ session }) => session.roomId === room.id);
    const current = currentEntry(roomTalks, now);
    if (current) return { room, phase: 'live', session: current.session };

    const todayTalks = roomTalks.filter(({ start }) => osloDateKey(start) === today);
    const next = todayTalks.find(({ start }) => start > now);
    if (next) {
      const phase = beforeEvent
        ? 'before'
        : activeServiceContext?.type === 'lunch'
          ? 'lunch'
          : activeServiceContext?.type === 'break'
            ? 'break'
            : 'next';
      return { room, phase, session: next.session };
    }

    return { room, phase: roomTalks.length === 0 ? 'empty' : 'ended' };
  });

  const plenary = allSessions.find(({ session, start, end }) =>
    session.isPlenumSession && start <= now && now < end,
  )?.session;

  return { phase: 'scheduled', rooms: roomStates, plenary };
}

export function isScheduleSnapshot(value: unknown): value is ScheduleSnapshot {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ScheduleSnapshot>;
  if (!Array.isArray(candidate.rooms) || !Array.isArray(candidate.sessions) || typeof candidate.fetchedAt !== 'string') return false;
  const fetchedAt = Date.parse(candidate.fetchedAt);
  if (!Number.isFinite(fetchedAt) || new Date(fetchedAt).toISOString() !== candidate.fetchedAt) return false;
  const validRooms = candidate.rooms.every((room) =>
    Boolean(room && typeof room.id === 'string' && room.id && typeof room.name === 'string' && room.name),
  );
  const validSessions = candidate.sessions.every((session) => {
    if (
      !session ||
      typeof session.id !== 'string' || !session.id ||
      typeof session.roomId !== 'string' || !session.roomId ||
      typeof session.room !== 'string' || !session.room ||
      typeof session.title !== 'string' || !session.title ||
      typeof session.startsAt !== 'string' ||
      typeof session.endsAt !== 'string' ||
      !Array.isArray(session.speakers) ||
      typeof session.isServiceSession !== 'boolean' ||
      typeof session.isPlenumSession !== 'boolean'
    ) return false;

    const validSpeakers = session.speakers.every((speaker) =>
      Boolean(
        speaker &&
        typeof speaker.id === 'string' && speaker.id &&
        typeof speaker.name === 'string' && speaker.name &&
        (speaker.portraitUrl === undefined || typeof speaker.portraitUrl === 'string'),
      ),
    );
    const start = parseSessionInstant(session.startsAt);
    const end = parseSessionInstant(session.endsAt);
    return validSpeakers && start !== null && end !== null && end > start;
  });
  return validRooms && validSessions;
}
