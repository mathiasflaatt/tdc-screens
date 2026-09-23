import { expect, test } from '@playwright/test';

const gridSmart = [
  {
    date: '2026-10-19T00:00:00Z',
    rooms: [
      {
        id: 42,
        name: 'Andromeda',
        sessions: [
          {
            id: 'talk-1',
            title: 'Grid title',
            startsAt: '2026-10-19T10:00:00',
            endsAt: '2026-10-19T10:40:00',
            isServiceSession: false,
            isPlenumSession: false,
            speakers: [{ id: 'speaker-1', name: 'Grid speaker name' }],
          },
        ],
      },
    ],
  },
];

const sessionFeed = [{ id: 'talk-1', title: 'Enriched talk title', speakers: ['speaker-1'] }];
const speakerFeed = [{ id: 'speaker-1', fullName: 'Mina Example', profilePicture: 'https://cdn.example.test/mina.webp' }];

test('builds the same-origin schedule from the fixed Sessionize feeds and ignores upstream URL input', async () => {
  const { createScheduleHandler } = await import('../api/schedule.js');
  const responses = new Map<string, unknown>([
    ['https://sessionize.com/api/v2/1diujeu9/view/GridSmart?under=True', gridSmart],
    ['https://sessionize.com/api/v2/1diujeu9/view/Sessions?under=True', sessionFeed],
    ['https://sessionize.com/api/v2/1diujeu9/view/Speakers?under=True', speakerFeed],
  ]);
  const requestedUrls: string[] = [];
  const fetchImpl: typeof fetch = async (url) => {
    requestedUrls.push(String(url));
    return { ok: true, json: async () => responses.get(String(url)) } as Response;
  };
  const handler = createScheduleHandler({
    fetchImpl,
    now: () => new Date('2026-10-19T08:00:00.000Z'),
  });
  const response: {
    headers: Record<string, string>;
    statusCode?: number;
    body?: unknown;
    setHeader(name: string, value: string): void;
    status(code: number): typeof response;
    json(body: unknown): typeof response;
  } = {
    headers: {},
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };

  await handler({ method: 'GET', url: '/api/schedule?url=https%3A%2F%2Fevil.example' }, response);

  expect(requestedUrls.sort()).toEqual([...responses.keys()].sort());
  expect(response.statusCode).toBe(200);
  expect(response.headers['Cache-Control']).toBe('no-store');
  const snapshot = response.body as { rooms: unknown[]; sessions: unknown[]; fetchedAt: string };
  expect(snapshot.fetchedAt).toBe('2026-10-19T08:00:00.000Z');
  expect(snapshot.rooms).toEqual([{ id: '42', name: 'Andromeda' }]);
  expect(snapshot.sessions).toEqual([
    {
      id: 'talk-1',
      roomId: '42',
      room: 'Andromeda',
      title: 'Enriched talk title',
      startsAt: '2026-10-19T10:00:00',
      endsAt: '2026-10-19T10:40:00',
      speakers: [{ id: 'speaker-1', name: 'Mina Example', portraitUrl: 'https://cdn.example.test/mina.webp' }],
      isServiceSession: false,
      isPlenumSession: false,
    },
  ]);

  responses.set('https://sessionize.com/api/v2/1diujeu9/view/Speakers?under=True', []);
  await handler({ method: 'GET', url: '/api/schedule' }, response);
  expect(response.statusCode).toBe(200);
  const unenrichedSnapshot = response.body as { sessions: Array<{ title: string; speakers: Array<{ name: string }> }> };
  expect(unenrichedSnapshot.sessions).toHaveLength(1);
  expect(unenrichedSnapshot.sessions[0].title).toBe('Enriched talk title');
  expect(unenrichedSnapshot.sessions[0].speakers).toEqual([{ id: 'speaker-1', name: 'Grid speaker name' }]);

  const malformedGridSmart = structuredClone(gridSmart);
  malformedGridSmart[0].rooms[0].sessions[0].startsAt = 'not-a-date';
  malformedGridSmart[0].rooms[0].sessions.push({
    id: 'valid-talk',
    title: 'Still valid talk',
    startsAt: '2026-10-19T11:00:00',
    endsAt: '2026-10-19T11:40:00',
    isServiceSession: false,
    isPlenumSession: false,
    speakers: [],
  });
  responses.set('https://sessionize.com/api/v2/1diujeu9/view/GridSmart?under=True', malformedGridSmart);

  await handler({ method: 'GET', url: '/api/schedule' }, response);

  expect(response.statusCode).toBe(502);
  expect(response.body).toEqual({ error: 'Schedule unavailable' });
});

test('does not return a fresh timestamp when the required Sessionize feed is unavailable', async () => {
  const { createScheduleHandler } = await import('../api/schedule.js');
  const handler = createScheduleHandler({
    fetchImpl: async () => { throw new Error('Sessionize is unavailable'); },
    now: () => new Date('2026-10-19T08:00:00.000Z'),
  });
  const response: {
    headers: Record<string, string>;
    statusCode?: number;
    body?: unknown;
    setHeader(name: string, value: string): void;
    status(code: number): typeof response;
    json(body: unknown): typeof response;
  } = {
    headers: {},
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };

  await handler({ method: 'GET', url: '/api/schedule' }, response);

  expect(response.statusCode).toBe(502);
  expect(response.body).toEqual({ error: 'Schedule unavailable' });
  expect(response.body).not.toHaveProperty('fetchedAt');
});
