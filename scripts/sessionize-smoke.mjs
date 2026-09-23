// @ts-check
// Opt-in smoke check against the live Sessionize feeds. Not part of `npm test`, so the
// automated behavior tests stay independent of the network. Run with `npm run smoke:sessionize`,
// or pass a deployed base URL (`npm run smoke:sessionize -- https://example.vercel.app`) to check
// the deployed `/api/schedule` function instead of the local handler.

import { createScheduleHandler } from '../api/schedule.js';
import { parseSessionInstant } from '../src/lib/time.js';

const DEPLOYMENT_TIMEOUT_MS = 30_000;

/** @returns {Promise<{ status: number, body: any }>} */
async function callLocalHandler() {
  // The handler hides upstream errors from clients; log them here for diagnosis.
  /** @type {typeof fetch} */
  const fetchImpl = async (input, init) => {
    try {
      const response = await fetch(input, init);
      if (!response.ok) console.error(`  upstream ${input} -> HTTP ${response.status}`);
      return response;
    } catch (error) {
      console.error(`  upstream ${input} -> ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  };
  const handler = createScheduleHandler({ fetchImpl });
  /** @type {{ status: number, body: any }} */
  const result = { status: 0, body: undefined };
  const response = {
    setHeader() {},
    /** @param {number} code */
    status(code) {
      result.status = code;
      return this;
    },
    /** @param {unknown} body */
    json(body) {
      result.body = body;
      return this;
    },
  };
  await handler({ method: 'GET', url: '/api/schedule' }, response);
  return result;
}

/** @param {string} baseUrl @returns {Promise<{ status: number, body: any }>} */
async function callDeployment(baseUrl) {
  const url = new URL('/api/schedule', baseUrl);
  const response = await fetch(url, { signal: AbortSignal.timeout(DEPLOYMENT_TIMEOUT_MS) });
  const cacheControl = response.headers.get('cache-control') ?? '';
  if (!cacheControl.includes('no-store')) {
    throw new Error(`Expected no-store Cache-Control from ${url}, got "${cacheControl}"`);
  }
  return { status: response.status, body: await response.json() };
}

/** @param {boolean} condition @param {string} message */
function check(condition, message) {
  if (!condition) throw new Error(message);
}

/** @param {any} snapshot */
function validateSnapshot(snapshot) {
  check(Array.isArray(snapshot?.rooms) && snapshot.rooms.length > 0, 'Snapshot has no rooms');
  check(Array.isArray(snapshot.sessions) && snapshot.sessions.length > 0, 'Snapshot has no sessions');
  check(!Number.isNaN(Date.parse(snapshot.fetchedAt)), 'Snapshot fetchedAt is not a timestamp');

  const roomIds = new Set(snapshot.rooms.map((/** @type {any} */ room) => room.id));
  for (const session of snapshot.sessions) {
    check(typeof session.title === 'string' && session.title.length > 0, `Session ${session.id} has no title`);
    const start = parseSessionInstant(session.startsAt);
    const end = parseSessionInstant(session.endsAt);
    check(start !== null && end !== null && end > start, `Session ${session.id} has an invalid time range`);
    check(Array.isArray(session.speakers), `Session ${session.id} has no speaker list`);
  }
  const talks = snapshot.sessions.filter((/** @type {any} */ session) => !session.isServiceSession);
  check(talks.length > 0, 'Snapshot contains no talks');
  check(talks.every((/** @type {any} */ talk) => roomIds.has(talk.roomId)), 'A talk refers to a room without a screen');

  return {
    rooms: snapshot.rooms.length,
    sessions: snapshot.sessions.length,
    talks: talks.length,
    talksWithSpeakers: talks.filter((/** @type {any} */ talk) => talk.speakers.length > 0).length,
  };
}

async function main() {
  const baseUrl = process.argv[2];
  const source = baseUrl ? `${baseUrl} /api/schedule` : 'local /api/schedule handler';
  const { status, body } = baseUrl ? await callDeployment(baseUrl) : await callLocalHandler();
  check(status === 200, `Expected HTTP 200 from ${source}, got ${status}`);
  const summary = validateSnapshot(body);
  console.log(`Sessionize smoke check passed (${source}):`, summary);
  for (const room of body.rooms) console.log(`  /room/${encodeURIComponent(room.id)}  ${room.name}`);
}

main().catch((error) => {
  console.error(`Sessionize smoke check failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
