// @ts-check

const GRIDSMART_URL = 'https://sessionize.com/api/v2/1diujeu9/view/GridSmart?under=True';
const SESSIONS_URL = 'https://sessionize.com/api/v2/1diujeu9/view/Sessions?under=True';
const SPEAKERS_URL = 'https://sessionize.com/api/v2/1diujeu9/view/Speakers?under=True';
const REQUEST_TIMEOUT_MS = 10_000;

/** @typedef {{ id: string, name: string }} Speaker */
/** @typedef {{ id: string, name: string }} Room */
/** @typedef {{ id: string, roomId: string, room: string, title: string, startsAt: string, endsAt: string, speakers: Speaker[], isServiceSession: boolean, isPlenumSession: boolean }} DisplaySession */
/** @typedef {{ rooms: Room[], sessions: DisplaySession[], fetchedAt: string }} ScheduleSnapshot */

/** @param {unknown} value @param {string} label */
function requireArray(value, label) {
  if (!Array.isArray(value)) throw new Error(`Sessionize ${label} feed was not an array`);
  return value;
}

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** @param {unknown} value */
function asText(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

/** @param {unknown} value */
function asId(value) {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

/** @param {unknown} speaker */
function speakerName(speaker) {
  if (!isRecord(speaker)) return '';
  const directName = asText(speaker.fullName) || asText(speaker.name);
  if (directName) return directName;
  return [asText(speaker.firstName), asText(speaker.lastName)].filter(Boolean).join(' ');
}

/**
 * Build the screen snapshot from Sessionize's stable GridSmart schedule and optional detail feeds.
 * Missing session or speaker enrichment never removes a valid GridSmart schedule entry.
 * @param {{ gridSmart: unknown, sessions: unknown, speakers: unknown }} feeds
 * @param {Date} fetchedAt
 * @returns {ScheduleSnapshot}
 */
export function normaliseSessionizeFeeds(feeds, fetchedAt = new Date()) {
  const days = requireArray(feeds.gridSmart, 'GridSmart');
  if (days.length === 0) throw new Error('Sessionize GridSmart feed contained no schedule days');

  const sessionDetails = Array.isArray(feeds.sessions) ? feeds.sessions : [];
  const speakerDetails = Array.isArray(feeds.speakers) ? feeds.speakers : [];
  /** @type {Map<string, Record<string, unknown>>} */
  const detailsById = new Map();
  for (const detail of sessionDetails) {
    if (isRecord(detail)) {
      const id = asId(detail.id);
      if (id) detailsById.set(id, detail);
    }
  }

  /** @type {Map<string, Speaker>} */
  const speakersById = new Map();
  for (const speaker of speakerDetails) {
    if (isRecord(speaker)) {
      const id = asId(speaker.id);
      const name = speakerName(speaker);
      if (id && name) speakersById.set(id, { id, name });
    }
  }

  /** @type {Map<string, Room>} */
  const rooms = new Map();
  /** @type {Map<string, DisplaySession>} */
  const schedule = new Map();

  for (const day of days) {
    if (!isRecord(day) || !Array.isArray(day.rooms)) continue;
    for (const roomData of day.rooms) {
      if (!isRecord(roomData)) continue;
      const roomId = asId(roomData.id);
      const roomName = asText(roomData.name);
      if (!roomId || !roomName || !Array.isArray(roomData.sessions)) continue;

      for (const gridSession of roomData.sessions) {
        if (!isRecord(gridSession)) continue;
        const id = asId(gridSession.id);
        const startsAt = asText(gridSession.startsAt);
        const endsAt = asText(gridSession.endsAt);
        const detail = detailsById.get(id);
        const title = (detail && asText(detail.title)) || asText(gridSession.title);
        if (!id || !title || !startsAt || !endsAt) continue;

        /** @type {unknown[]} */
        const speakerRefs = detail && Array.isArray(detail.speakers)
          ? detail.speakers
          : Array.isArray(gridSession.speakers) ? gridSession.speakers : [];
        const speakers = speakerRefs.flatMap((reference) => {
          const speakerId = asId(isRecord(reference) ? reference.id : reference);
          if (!speakerId) return [];
          const enriched = speakersById.get(speakerId);
          if (enriched) return [enriched];
          const gridSpeaker = Array.isArray(gridSession.speakers)
            ? gridSession.speakers.find((candidate) => isRecord(candidate) && asId(candidate.id) === speakerId)
            : undefined;
          const name = (isRecord(reference) && speakerName(reference))
            || (isRecord(gridSpeaker) && speakerName(gridSpeaker))
            || '';
          return name ? [{ id: speakerId, name }] : [];
        });

        const normalizedRoom = { id: roomId, name: roomName };
        const sessionKey = `${roomId}:${id}:${startsAt}`;
        rooms.set(roomId, normalizedRoom);
        schedule.set(sessionKey, {
          id,
          roomId,
          room: roomName,
          title,
          startsAt,
          endsAt,
          speakers,
          isServiceSession: gridSession.isServiceSession === true,
          isPlenumSession: gridSession.isPlenumSession === true,
        });
      }
    }
  }

  const sessions = [...schedule.values()].sort((left, right) => left.startsAt.localeCompare(right.startsAt));
  if (sessions.length === 0) throw new Error('Sessionize GridSmart feed contained no usable sessions');

  // Only rooms with at least one talk get a permanent attendee room screen.
  const talkRoomIds = new Set(sessions.filter((session) => !session.isServiceSession).map((session) => session.roomId));
  return {
    rooms: [...rooms.values()].filter((room) => talkRoomIds.has(room.id)).sort((left, right) => left.name.localeCompare(right.name)),
    sessions,
    fetchedAt: fetchedAt.toISOString(),
  };
}

/** @param {string} url @param {(input: string, init?: RequestInit) => Promise<Response>} fetchImpl */
async function fetchJson(url, fetchImpl) {
  const response = await fetchImpl(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`Sessionize returned HTTP ${response.status}`);
  return response.json();
}

/** @typedef {{ method?: string, url?: string }} ScheduleRequest */
/** @typedef {{ setHeader: (name: string, value: string) => void, status: (code: number) => ScheduleResponse, json: (body: unknown) => ScheduleResponse }} ScheduleResponse */

/**
 * @param {{ fetchImpl?: (input: string, init?: RequestInit) => Promise<Response>, now?: () => Date }} [options]
 * @returns {(request: ScheduleRequest, response: ScheduleResponse) => Promise<ScheduleResponse>}
 */
export function createScheduleHandler({ fetchImpl = fetch, now = () => new Date() } = {}) {
  return async function scheduleHandler(request, response) {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Vercel-Cache-Control', 'no-store');
    response.setHeader('Content-Type', 'application/json; charset=utf-8');

    if (request.method !== 'GET') {
      return response.status(405).json({ error: 'Method not allowed' });
    }

    try {
      const gridSmartPromise = fetchJson(GRIDSMART_URL, fetchImpl);
      const sessionsPromise = fetchJson(SESSIONS_URL, fetchImpl).catch(() => []);
      const speakersPromise = fetchJson(SPEAKERS_URL, fetchImpl).catch(() => []);
      const [gridSmart, sessions, speakers] = await Promise.all([
        gridSmartPromise,
        sessionsPromise,
        speakersPromise,
      ]);
      const snapshot = normaliseSessionizeFeeds({ gridSmart, sessions, speakers }, now());
      return response.status(200).json(snapshot);
    } catch {
      return response.status(502).json({ error: 'Schedule unavailable' });
    }
  };
}

export default createScheduleHandler();
