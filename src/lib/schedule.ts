import { parseSessionInstant } from './time.js';
export { parseSessionInstant } from './time.js';

export const OSLO_TIME_ZONE = 'Europe/Oslo';

export type DisplayRoom = { id: string; name: string };

export type DisplaySession = {
  id: string;
  roomId: string;
  room: string;
  title: string;
  startsAt: string;
  endsAt: string;
  speakers: Array<{ id: string; name: string }>;
  isServiceSession: boolean;
  isPlenumSession: boolean;
};

export type ScheduleSnapshot = {
  rooms: DisplayRoom[];
  sessions: DisplaySession[];
  fetchedAt: string;
};

export type RoomDisplayState = {
  phase: 'live' | 'service' | 'before' | 'between' | 'ended' | 'empty';
  session?: DisplaySession;
};

const osloFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: OSLO_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
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

export function formatSessionRange(session: DisplaySession): string {
  const start = parseSessionInstant(session.startsAt);
  const end = parseSessionInstant(session.endsAt);
  if (start === null || end === null) return '';
  return `${formatOsloTime(start)}–${formatOsloTime(end)}`;
}

export function getRoomDisplayState(
  snapshot: ScheduleSnapshot,
  roomId: string,
  now: number,
): RoomDisplayState {
  const sessions = snapshot.sessions
    .filter((session) => session.roomId === roomId)
    .map((session) => ({ session, start: parseSessionInstant(session.startsAt), end: parseSessionInstant(session.endsAt) }))
    .filter((entry) => entry.start !== null && entry.end !== null)
    .sort((left, right) => left.start! - right.start!);

  if (sessions.length === 0) return { phase: 'empty' };

  const current = sessions.find(({ start, end }) => start! <= now && now < end!);
  if (current) return { phase: current.session.isServiceSession ? 'service' : 'live', session: current.session };

  const next = sessions.find(({ session, start }) => !session.isServiceSession && start! > now);
  if (next) {
    const firstStart = sessions[0].start!;
    return { phase: now < firstStart ? 'before' : 'between', session: next.session };
  }

  return { phase: 'ended' };
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
      Boolean(speaker && typeof speaker.id === 'string' && speaker.id && typeof speaker.name === 'string' && speaker.name),
    );
    const start = parseSessionInstant(session.startsAt);
    const end = parseSessionInstant(session.endsAt);
    return validSpeakers && start !== null && end !== null && end > start;
  });
  return validRooms && validSessions;
}
