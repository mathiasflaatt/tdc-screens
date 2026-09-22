import { expect, test } from '@playwright/test';

const schedule = {
  fetchedAt: '2026-10-19T08:00:00.000Z',
  rooms: [
    { id: '42', name: 'Andromeda' },
    { id: '77', name: 'Aurora' },
  ],
  sessions: [
    {
      id: 'talk-1',
      roomId: '42',
      room: 'Andromeda',
      title: 'A live talk for the room display',
      startsAt: '2026-10-19T10:00:00',
      endsAt: '2026-10-19T10:20:00',
      speakers: [{ id: 'speaker-1', name: 'Mina Example' }],
      isServiceSession: false,
      isPlenumSession: false,
    },
    {
      id: 'talk-2',
      roomId: '42',
      room: 'Andromeda',
      title: 'The next talk starts on the room clock',
      startsAt: '2026-10-19T10:20:00',
      endsAt: '2026-10-19T10:45:00',
      speakers: [{ id: 'speaker-2', name: 'Ola Example' }],
      isServiceSession: false,
      isPlenumSession: false,
    },
  ],
};
const scheduleCacheKey = 'tdc-2026-schedule-v1';

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-19T08:15:00.000Z') });
  await page.route('**/api/schedule*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(schedule) }),
  );
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
  await expect(page.getByText('Mina Example')).toBeVisible();
  await expect(page.getByText('10:00–10:20')).toBeVisible();
  await expect(page.getByText('Happening now')).toBeVisible();
  await expect(page.getByLabel('Oslo local time')).toHaveText('10:15');
  if (process.env.TDC_SCREENSHOT_PATH) {
    await page.screenshot({ path: process.env.TDC_SCREENSHOT_PATH, fullPage: true });
  }

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
