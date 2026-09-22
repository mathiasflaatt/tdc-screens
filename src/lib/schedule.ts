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

const osloPartsFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: OSLO_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
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

/** Parse feed timestamps as Oslo wall time when they do not include an offset. */
export function parseSessionInstant(value: string): number | null {
  if (/[zZ]|[+-]\d{2}:\d{2}$/.test(value)) {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/.exec(value);
  if (!match) return null;

  const [, yearText, monthText, dayText, hourText, minuteText, secondText = '0', fractionText = '0'] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const millisecond = Number(fractionText.padEnd(3, '0'));
  const wallTime = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
  let instant = wallTime;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const parts = osloPartsFormatter.formatToParts(instant);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    const representedAsUtc = Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      Number(values.hour),
      Number(values.minute),
      Number(values.second),
    );
    instant += wallTime - representedAsUtc;
  }

  return Number.isFinite(instant) ? instant : null;
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
  const validRooms = candidate.rooms.every((room) =>
    Boolean(room && typeof room.id === 'string' && typeof room.name === 'string'),
  );
  const validSessions = candidate.sessions.every((session) =>
    Boolean(
      session &&
      typeof session.id === 'string' &&
      typeof session.roomId === 'string' &&
      typeof session.room === 'string' &&
      typeof session.title === 'string' &&
      typeof session.startsAt === 'string' &&
      typeof session.endsAt === 'string' &&
      Array.isArray(session.speakers),
    ),
  );
  return validRooms && validSessions;
}
