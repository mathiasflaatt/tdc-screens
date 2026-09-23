import { expect, test } from '@playwright/test';

const longTalkTitle = 'Building resilient systems by learning from the unexpected failures we meet in production';
const schedule = {
  fetchedAt: '2026-10-19T08:00:00.000Z',
  rooms: [
    { id: '42', name: 'Andromeda' },
    { id: '77', name: 'Aurora' },
  ],
  sessions: [
    {
      id: 'talk-1', roomId: '42', room: 'Andromeda', title: 'A live talk for the room display',
      startsAt: '2026-10-19T10:00:00', endsAt: '2026-10-19T10:20:00',
      speakers: [
        { id: 'speaker-1', name: 'Mina Example', portraitUrl: 'https://images.example.test/mina.webp' },
        { id: 'speaker-2', name: 'Ola Example' },
      ], isServiceSession: false, isPlenumSession: false,
    },
    {
      id: 'talk-2', roomId: '42', room: 'Andromeda', title: 'The next talk starts on the room clock',
      startsAt: '2026-10-19T10:20:00', endsAt: '2026-10-19T10:45:00',
      speakers: [{ id: 'speaker-3', name: 'Arun Example' }], isServiceSession: false, isPlenumSession: false,
    },
    {
      id: 'coffee-andromeda', roomId: '42', room: 'Andromeda', title: 'Coffee break',
      startsAt: '2026-10-19T10:45:00', endsAt: '2026-10-19T11:00:00',
      speakers: [], isServiceSession: true, isPlenumSession: false,
    },
    {
      id: 'coffee-aurora', roomId: '77', room: 'Aurora', title: 'Coffee break',
      startsAt: '2026-10-19T10:45:00', endsAt: '2026-10-19T11:00:00',
      speakers: [], isServiceSession: true, isPlenumSession: false,
    },
    {
      id: 'talk-3', roomId: '42', room: 'Andromeda', title: longTalkTitle,
      startsAt: '2026-10-19T11:00:00', endsAt: '2026-10-19T11:40:00',
      speakers: [{ id: 'speaker-4', name: 'Sam Example' }, { id: 'speaker-5', name: 'Toni Example' }],
      isServiceSession: false, isPlenumSession: false,
    },
    {
      id: 'plenary-1', roomId: '77', room: 'Aurora', title: 'Opening plenary',
      startsAt: '2026-10-19T11:45:00', endsAt: '2026-10-19T12:00:00',
      speakers: [{ id: 'speaker-6', name: 'Lee Example' }], isServiceSession: false, isPlenumSession: true,
    },
    {
      id: 'lunch-andromeda', roomId: '42', room: 'Andromeda', title: 'Lunch',
      startsAt: '2026-10-19T12:00:00', endsAt: '2026-10-19T13:00:00',
      speakers: [], isServiceSession: true, isPlenumSession: false,
    },
    {
      id: 'lunch-aurora', roomId: '77', room: 'Aurora', title: 'Lunch',
      startsAt: '2026-10-19T12:00:00', endsAt: '2026-10-19T13:00:00',
      speakers: [], isServiceSession: true, isPlenumSession: false,
    },
    {
      id: 'talk-4', roomId: '42', room: 'Andromeda', title: 'The afternoon session',
      startsAt: '2026-10-19T13:00:00', endsAt: '2026-10-19T13:45:00',
      speakers: [{ id: 'speaker-7', name: 'Rae Example' }], isServiceSession: false, isPlenumSession: false,
    },
    {
      id: 'talk-5', roomId: '42', room: 'Andromeda', title: 'The last Andromeda talk',
      startsAt: '2026-10-19T16:30:00', endsAt: '2026-10-19T17:00:00',
      speakers: [], isServiceSession: false, isPlenumSession: false,
    },
    {
      id: 'party-1', roomId: '77', room: 'Aurora', title: 'Evening party',
      startsAt: '2026-10-19T18:00:00', endsAt: '2026-10-19T22:00:00',
      speakers: [], isServiceSession: true, isPlenumSession: false,
    },
  ],
};
const scheduleCacheKey = 'tdc-2026-schedule-v1';

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-19T08:15:00.000Z') });
  await page.route('https://images.example.test/**', (route) =>
    route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2 2"><rect width="2" height="2" fill="#b5f0b4"/></svg>' }),
  );
  await page.route('**/api/schedule*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(schedule) }),
  );
});

test('shows the featured talk, speaker portrait and nearest room agenda on a 1080 by 1920 screen', async ({ page }) => {
  await page.goto('/room/42');

  await expect(page.getByRole('heading', { name: 'Andromeda' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'A live talk for the room display' })).toBeVisible();
  await expect(page.getByText('Mina Example')).toBeVisible();
  await expect(page.getByRole('img', { name: /mina example portrait/i })).toHaveAttribute('src', 'https://images.example.test/mina.webp');
  await expect(page.getByText('Ola Example')).toBeVisible();
  await expect(page.getByText('10:00–10:20')).toBeVisible();
  await expect(page.getByRole('region', { name: /upcoming room agenda/i })).toBeVisible();
  await expect(page.getByText('The next talk starts on the room clock')).toBeVisible();
  await expect(page.getByText(longTalkTitle)).toBeVisible();

  const display = page.locator('.display-page');
  const dimensions = await display.evaluate((element) => ({
    width: element.clientWidth,
    height: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }));
  expect(dimensions.width).toBe(1080);
  expect(dimensions.height).toBe(1920);
  expect(dimensions.scrollHeight).toBeLessThanOrEqual(dimensions.height + 1);
});

test('shows the current session at its exact start boundary', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-19T08:00:00.000Z'));
  await page.goto('/room/42');

  await expect(page.getByRole('heading', { name: 'A live talk for the room display' })).toBeVisible();
  await expect(page.getByLabel('Oslo local time')).toHaveText('10:00');
});

test('selects the next talk at the exact end of a session', async ({ page }) => {
  await page.goto('/room/42');
  await page.clock.fastForward(5 * 60 * 1000);

  await expect(page.getByRole('heading', { name: 'The next talk starts on the room clock' })).toBeVisible();
  await expect(page.getByText('10:20–10:45')).toBeVisible();
  await expect(page.getByLabel('Oslo local time')).toHaveText('10:20');
});

test('features the next room talk during a shared coffee break and shows its actual start', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-19T08:50:00.000Z'));
  await page.goto('/room/42');

  await expect(page.getByRole('heading', { name: longTalkTitle })).toBeVisible();
  await expect(page.getByText('Shared break')).toBeVisible();
  await expect(page.getByText('Next talk starts at 11:00')).toBeVisible();
  await expect(page.getByText('11:00–11:40')).toBeVisible();
  await expect(page.getByText('Sam Example')).toBeVisible();
  await expect(page.getByText('Toni Example')).toBeVisible();
  const layout = await page.evaluate(() => {
    const footer = document.querySelector('main footer')!.getBoundingClientRect();
    return { scrollHeight: document.documentElement.scrollHeight, viewportHeight: window.innerHeight, footerBottom: footer.bottom };
  });
  expect(layout.scrollHeight).toBeLessThanOrEqual(layout.viewportHeight);
  expect(layout.footerBottom).toBeLessThanOrEqual(layout.viewportHeight);
  if (process.env.TDC_LONG_SCREENSHOT_PATH) {
    await page.screenshot({ path: process.env.TDC_LONG_SCREENSHOT_PATH, fullPage: true });
  }
});

test('distinguishes a shared lunch from a break and from an ordinary room gap', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-19T10:30:00.000Z'));
  await page.goto('/room/42');
  await expect(page.getByText('Shared lunch')).toBeVisible();
  await expect(page.getByText('Next talk starts at 13:00')).toBeVisible();

  await page.clock.setFixedTime(new Date('2026-10-19T12:50:00.000Z'));
  await page.reload();
  await expect(page.getByText('Between sessions')).toBeVisible();
  await expect(page.getByText('Shared break')).toHaveCount(0);
});

test('shows a plenary notice with its actual venue while keeping the room agenda local', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-19T09:50:00.000Z'));
  await page.goto('/room/42');

  await expect(page.getByText('Plenary session in Aurora')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Opening plenary' })).toHaveCount(0);
  await expect(page.getByText('The afternoon session')).toBeVisible();
  await expect(page.getByText('Between sessions')).toBeVisible();
});

test('does not label an evening party as a break', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-19T16:30:00.000Z'));
  await page.goto('/room/77');

  await expect(page.getByRole('heading', { name: 'Evening party' })).toBeVisible();
  await expect(page.getByText('On the programme')).toBeVisible();
  await expect(page.getByText(/break/i)).toHaveCount(0);
});

test('shows the first session and its date before the conference starts', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-18T08:15:00.000Z'));
  await page.goto('/room/42');

  await expect(page.getByRole('heading', { name: 'A live talk for the room display' })).toBeVisible();
  await expect(page.getByText('Starts later')).toBeVisible();
  await expect(page.getByText(/Monday, 19 October 2026/i)).toBeVisible();
});

test('shows the room end state while another room still has an event', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-19T16:00:00.000Z'));
  await page.goto('/room/42');

  await expect(page.getByRole('heading', { name: 'No more sessions today' })).toBeVisible();
  await expect(page.getByText('Programme complete')).toHaveCount(0);
});

test('shows a programme-complete state after the final scheduled event ends', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-19T20:00:00.000Z'));
  await page.goto('/room/42');

  await expect(page.getByRole('heading', { name: /programme complete/i })).toBeVisible();
});

test('selects a room, supports a permanent direct URL, and advances on the Oslo clock', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: /choose a screen/i })).toBeVisible();
  const roomLink = page.getByRole('link', { name: /Andromeda/i });
  await expect(roomLink).toHaveAttribute('href', '/room/42');
  await roomLink.click();
  await expect(page).toHaveURL(/\/room\/42$/);
  await expect(page.getByRole('heading', { name: 'Andromeda' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'A live talk for the room display' })).toBeVisible();
  await expect(page.getByText('10:00–10:20')).toBeVisible();
  await expect(page.getByLabel('Oslo local time')).toHaveText('10:15');
  if (process.env.TDC_SCREENSHOT_PATH) await page.screenshot({ path: process.env.TDC_SCREENSHOT_PATH, fullPage: true });

  await page.reload();
  await expect(page.getByRole('heading', { name: 'A live talk for the room display' })).toBeVisible();
  await page.clock.fastForward(5 * 60 * 1000);
  await expect(page.getByRole('heading', { name: 'The next talk starts on the room clock' })).toBeVisible();
  await expect(page.getByLabel('Oslo local time')).toHaveText('10:20');
});

test('shows a useful way back for an unknown room', async ({ page }) => {
  await page.goto('/room/unknown-room');

  await expect(page.getByRole('heading', { name: /room not found/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /choose a screen/i })).toHaveAttribute('href', '/');
});

test('shows a readable state when the first schedule request fails', async ({ page }) => {
  await page.unroute('**/api/schedule*');
  await page.route('**/api/schedule*', (route) =>
    route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'offline' }) }),
  );
  await page.goto('/room/42');

  await expect(page.getByRole('heading', { name: /schedule unavailable/i })).toBeVisible();
  await expect(page.getByText(/trying again automatically/i)).toBeVisible();
});

test('keeps the cached schedule when a refresh contains invalid timestamps', async ({ page }) => {
  const invalidSchedule = {
    ...schedule,
    sessions: schedule.sessions.map((session, index) => index === 0 ? ({
      ...session,
      startsAt: 'not-a-date',
      endsAt: 'also-not-a-date',
    }) : session),
  };

  await page.unroute('**/api/schedule*');
  await page.addInitScript(({ key, snapshot }) => {
    window.localStorage.setItem(key, JSON.stringify(snapshot));
  }, { key: scheduleCacheKey, snapshot: schedule });
  await page.route('**/api/schedule*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(invalidSchedule) }),
  );
  await page.goto('/room/42');

  await expect(page.getByRole('heading', { name: 'A live talk for the room display' })).toBeVisible();
  await expect(page.getByText('Schedule may be out of date')).toBeVisible();
  await expect(page.getByText('Happening now')).toBeVisible();
  expect(await page.evaluate((key) => window.localStorage.getItem(key), scheduleCacheKey)).toBe(JSON.stringify(schedule));
});

test('updates room status on the one-second display tick and polls at five minutes', async ({ page }) => {
  const secondBoundarySchedule = {
    ...schedule,
    sessions: schedule.sessions.map((session, index) => index === 0 ? ({
      ...session,
      startsAt: '2026-10-19T10:15:01',
      endsAt: '2026-10-19T10:40:00',
    }) : session),
  };
  let requests = 0;

  await page.unroute('**/api/schedule*');
  await page.route('**/api/schedule*', async (route) => {
    requests += 1;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(secondBoundarySchedule) });
  });
  await page.goto('/room/42');

  await expect(page.getByText('Starts later')).toBeVisible();
  await expect.poll(() => requests).toBe(1);
  await page.clock.fastForward(1_000);
  await expect(page.getByText('Happening now')).toBeVisible();
  expect(requests).toBe(1);

  await page.clock.fastForward(299_999);
  expect(requests).toBe(1);
  await page.clock.fastForward(1);
  await expect.poll(() => requests).toBe(2);
});

test('applies refreshed title, speaker, and scheduled time without reloading', async ({ page }) => {
  let refreshedSchedule = schedule;
  let requests = 0;

  await page.unroute('**/api/schedule*');
  await page.route('**/api/schedule*', async (route) => {
    requests += 1;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(refreshedSchedule) });
  });
  await page.goto('/room/42');

  await expect(page.getByRole('heading', { name: 'A live talk for the room display' })).toBeVisible();
  refreshedSchedule = {
    ...schedule,
    sessions: schedule.sessions.map((session, index) => index === 0 ? ({
      ...session,
      title: 'A refreshed room talk',
      startsAt: '2026-10-19T10:05:00',
      endsAt: '2026-10-19T10:50:00',
      speakers: [{ id: 'speaker-refreshed', name: 'Updated Speaker' }],
    }) : session),
  };

  await page.clock.fastForward(5 * 60 * 1000);

  await expect(page.getByRole('heading', { name: 'A refreshed room talk' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'A live talk for the room display' })).toHaveCount(0);
  await expect(page.getByText('Updated Speaker')).toBeVisible();
  await expect(page.getByText('10:05–10:50')).toBeVisible();
  expect(page.url()).toMatch(/\/room\/42$/);
  await expect.poll(() => requests).toBe(2);
});

test('shows the latest cached schedule through an outage and reload, then clears stale status on recovery', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-19T08:15:00.000Z'));
  let refreshedSchedule = schedule;
  let requests = 0;

  await page.unroute('**/api/schedule*');
  await page.route('**/api/schedule*', async (route) => {
    requests += 1;
    if (requests === 2 || requests === 3) {
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'offline' }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(refreshedSchedule) });
  });
  await page.goto('/room/42');

  await expect(page.getByRole('heading', { name: 'A live talk for the room display' })).toBeVisible();
  await page.clock.fastForward(5 * 60 * 1000);
  await expect(page.getByText('Schedule may be out of date')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'A live talk for the room display' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'A live talk for the room display' })).toBeVisible();
  await expect(page.getByText('Schedule may be out of date')).toBeVisible();

  refreshedSchedule = {
    ...schedule,
    sessions: schedule.sessions.map((session, index) => index === 0 ? ({ ...session, title: 'Recovered room talk' }) : session),
  };
  await page.clock.fastForward(5 * 60 * 1000);

  await expect(page.getByRole('heading', { name: 'Recovered room talk' })).toBeVisible();
  await expect(page.getByText('Schedule may be out of date')).toHaveCount(0);
  await expect.poll(() => requests).toBe(4);
});

test('recovers from an initial schedule failure on the next refresh', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-19T08:15:00.000Z'));
  let requests = 0;

  await page.unroute('**/api/schedule*');
  await page.route('**/api/schedule*', async (route) => {
    requests += 1;
    if (requests === 1) {
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'offline' }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(schedule) });
  });
  await page.goto('/room/42');

  await expect(page.getByRole('heading', { name: /schedule unavailable/i })).toBeVisible();
  await expect(page.getByText(/trying again automatically/i)).toBeVisible();
  await page.clock.fastForward(5 * 60 * 1000);

  await expect(page.getByRole('heading', { name: 'A live talk for the room display' })).toBeVisible();
  await expect(page.getByText('Schedule unavailable')).toHaveCount(0);
  await expect.poll(() => requests).toBe(2);
});

test('renders the fetched schedule when local storage is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('Storage is disabled');
      },
    });
  });
  await page.goto('/room/42');

  await expect(page.getByRole('heading', { name: 'A live talk for the room display' })).toBeVisible();
  await expect(page.getByText('Schedule may be out of date')).toHaveCount(0);
});
