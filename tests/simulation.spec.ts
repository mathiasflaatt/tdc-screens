import { expect, test } from '@playwright/test';

const schedule = {
  fetchedAt: '2026-10-19T08:00:00.000Z',
  rooms: [
    { id: '42', name: 'Andromeda' },
    { id: '77', name: 'Aurora' },
  ],
  sessions: [
    {
      id: 'talk-1', roomId: '42', room: 'Andromeda', title: 'First simulation talk',
      startsAt: '2026-10-19T10:00:00', endsAt: '2026-10-19T10:20:00',
      speakers: [], isServiceSession: false, isPlenumSession: false,
    },
    {
      id: 'talk-2', roomId: '42', room: 'Andromeda', title: 'Second simulation talk',
      startsAt: '2026-10-19T10:20:00', endsAt: '2026-10-19T10:45:00',
      speakers: [], isServiceSession: false, isPlenumSession: false,
    },
    {
      id: 'talk-3', roomId: '77', room: 'Aurora', title: 'Common-area simulation talk',
      startsAt: '2026-10-19T10:00:00', endsAt: '2026-10-19T10:40:00',
      speakers: [], isServiceSession: false, isPlenumSession: false,
    },
  ],
};

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-19T08:15:00.000Z') });
  await page.route('**/api/schedule*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(schedule) }),
  );
});

test('the test URL restores a feed-date simulation position and drops legacy speed', async ({ page }) => {
  await page.goto('/room/42?test=true&at=10%3A15&speed=10');

  await expect(page.getByRole('region', { name: 'Simulation controls' })).toBeVisible();
  await expect(page.getByLabel('Simulation time')).toHaveValue('10:15');
  await expect(page.getByLabel('Oslo local time')).toHaveText('10:15');
  await expect(page.getByText('Simulated time', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'First simulation talk' })).toBeVisible();
  await expect(page).toHaveURL(/\/room\/42\?test=true&at=10%3A15$/);

  await page.reload();
  await expect(page.getByLabel('Simulation time')).toHaveValue('10:15');
});

test('a bare test URL starts at the current wall time on the feed conference date', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-23T08:15:00.000Z'));
  await page.addInitScript((cachedSchedule) => {
    window.localStorage.setItem('tdc-2026-schedule-v1', JSON.stringify(cachedSchedule));
  }, schedule);
  await page.goto('/common?test=true');

  await expect(page.getByLabel('Oslo local time')).toHaveText('10:15');
  await expect(page.getByRole('main', { name: 'Common-area conference overview' })).toBeVisible();
  await expect(page.getByLabel('Oslo local time')).toHaveAttribute('datetime', '2026-10-19T08:15:00.000Z');
  await expect(page).toHaveURL(/\/common\?test=true&at=10%3A15/);

  await page.reload();
  await expect(page.getByLabel('Oslo local time')).toHaveText('10:15');
  await expect(page.getByLabel('Oslo local time')).toHaveAttribute('datetime', '2026-10-19T08:15:00.000Z');
});

test('test mode selects Oslo time and labels the display while URLs without test mode stay live', async ({ page }) => {
  await page.goto('/room/42?test=true&at=10%3A15');

  await expect(page.getByRole('region', { name: 'Simulation controls' })).toBeVisible();
  await expect(page.getByLabel('Simulation time')).toHaveValue('10:15');
  await expect(page.getByLabel('Oslo local time')).toHaveText('10:15');
  await expect(page.getByText('Simulated time', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'First simulation talk' })).toBeVisible();

  await page.goto('/room/42');
  await expect(page.getByRole('region', { name: 'Simulation controls' })).toHaveCount(0);
  await expect(page.getByText('Simulated time')).toHaveCount(0);

  await page.goto('/room/42?at=10%3A15&speed=60');
  await expect(page.getByRole('region', { name: 'Simulation controls' })).toHaveCount(0);
  await expect(page.getByLabel('Oslo local time')).toHaveText('10:15');

  await page.goto('/common');
  await expect(page.getByRole('region', { name: 'Simulation controls' })).toHaveCount(0);
});

test('seeking moves the simulated display through schedule transitions', async ({ page }) => {
  await page.goto('/room/42?test=true&at=10%3A15');

  await page.getByLabel('Simulation time').fill('10:18');
  await expect(page.getByLabel('Oslo local time')).toHaveText('10:18');
  await expect(page.getByLabel('Oslo local time')).toHaveAttribute('datetime', '2026-10-19T08:18:00.000Z');
  await expect(page.getByRole('heading', { name: 'First simulation talk' })).toBeVisible();
  await expect(page).toHaveURL(/at=10%3A18/);

  await page.getByLabel('Simulation time').fill('10:20');
  await expect(page.getByRole('heading', { name: 'Second simulation talk' })).toBeVisible();
});

test('the day scrubber moves simulated time without changing the live clock', async ({ page }) => {
  await page.goto('/room/42?test=true&at=10%3A15');

  await page.getByLabel('Day scrubber').press('ArrowRight');
  await expect(page.getByLabel('Oslo local time')).toHaveText('10:16');
  await expect(page.getByLabel('Simulation time')).toHaveValue('10:16');
  await expect(page.locator('datalist option')).toHaveCount(4);
});

test('switching views keeps the preview position and returning to live restores the Oslo clock', async ({ page }) => {
  await page.goto('/room/42?test=true&at=10%3A15');

  await page.getByRole('link', { name: 'Common-area view' }).click();
  await expect(page.getByRole('main', { name: 'Common-area conference overview' })).toBeVisible();
  await expect(page.getByLabel('Oslo local time')).toHaveText('10:15');
  await expect(page).toHaveURL(/\/common\?test=true&at=10%3A15$/);

  await page.getByRole('link', { name: 'Choose a room' }).click();
  await expect(page.getByRole('heading', { name: 'Choose a screen' })).toBeVisible();
  await page.getByRole('link', { name: /Andromeda/ }).click();
  await expect(page.getByRole('heading', { name: 'First simulation talk' })).toBeVisible();
  await expect(page.getByLabel('Oslo local time')).toHaveText('10:15');
  await expect(page).toHaveURL(/\/room\/42\?test=true&at=10%3A15$/);

  await page.getByLabel('Simulation time').fill('23:00');
  await expect(page.getByLabel('Oslo local time')).toHaveText('23:00');
  await page.getByRole('button', { name: 'Back to live' }).click();
  await expect(page.getByRole('region', { name: 'Simulation controls' })).toHaveCount(0);
  await expect(page).toHaveURL(/\/room\/42\/?$/);
  await expect(page.getByLabel('Oslo local time')).toHaveText('10:15');
  await page.clock.fastForward(60_000);
  await expect(page.getByLabel('Oslo local time')).toHaveText('10:16');
});

test('the TDC brand link keeps the active simulation when returning to screen selection', async ({ page }) => {
  await page.goto('/room/42?test=true&at=10%3A15');

  await page.getByRole('link', { name: 'Common-area view' }).click();
  await page.getByRole('link', { name: 'Choose a room' }).click();
  await page.getByRole('link', { name: 'TDC 2026 conference displays' }).click();
  await expect(page.getByRole('heading', { name: 'Choose a screen' })).toBeVisible();
  await expect(page).toHaveURL(/\/?\?test=true&at=10%3A15$/);
  await expect(page.getByRole('region', { name: 'Simulation controls' })).toBeVisible();
});

test('an unknown-room return link keeps the active simulation when choosing a screen', async ({ page }) => {
  await page.goto('/room/missing?test=true&at=10%3A15');

  await expect(page.getByRole('heading', { name: 'Room not found' })).toBeVisible();
  await page.getByRole('link', { name: /choose a screen/i }).click();
  await expect(page.getByRole('heading', { name: 'Choose a screen' })).toBeVisible();
  await expect(page).toHaveURL(/\/?\?test=true&at=10%3A15/);
  await expect(page.getByRole('region', { name: 'Simulation controls' })).toBeVisible();
});

test('playing at sixty times keeps the schedule refresh on its real five-minute cadence', async ({ page }) => {
  let requests = 0;
  await page.unroute('**/api/schedule*');
  await page.route('**/api/schedule*', (route) => {
    requests += 1;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(schedule) });
  });
  await page.goto('/room/42?test=true&at=10%3A15');
  await expect.poll(() => requests).toBe(1);

  await page.getByLabel('Simulation time').fill('23:00');
  await expect(page.getByLabel('Oslo local time')).toHaveText('23:00');
  expect(requests).toBe(1);
  await page.getByLabel('Simulation time').fill('10:15');
  await expect(page.getByRole('heading', { name: 'First simulation talk' })).toBeVisible();

  await page.getByRole('button', { name: 'Play' }).click();
  await page.clock.fastForward(5_000);
  await expect(page.getByLabel('Oslo local time')).toHaveText('10:20');
  expect(requests).toBe(1);

  await page.clock.fastForward(240_000);
  expect(requests).toBe(1);
  await page.clock.fastForward(60_000);
  await expect.poll(() => requests).toBe(2);
});

test('playback advances at sixty times the real elapsed time', async ({ page }) => {
  await page.goto('/room/42?test=true&at=10%3A15');

  await page.getByRole('button', { name: 'Play' }).click();
  await page.clock.fastForward(1_000);
  await expect(page).toHaveURL(/at=10%3A16/);
  await page.getByRole('button', { name: 'Pause' }).click();
  await page.clock.fastForward(5_000);
  await expect(page.getByLabel('Oslo local time')).toHaveText('10:16');
});

test('playback pauses at the final minute so its URL remains within the feed conference day', async ({ page }) => {
  await page.goto('/room/42?test=true&at=23%3A58');
  await page.getByRole('button', { name: 'Play' }).click();

  await page.clock.fastForward(5_000);

  await expect(page.getByLabel('Oslo local time')).toHaveText('23:59');
  await expect(page).toHaveURL(/test=true&at=23%3A59$/);
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
});

test('simulation controls float over the viewport without taking canvas space', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/common?test=true&at=10%3A15');
  const controls = page.getByRole('region', { name: 'Simulation controls' });
  await expect(controls).toBeVisible();
  await expect(page.getByRole('main').getByRole('region', { name: 'Simulation controls' })).toHaveCount(0);
  expect(await controls.evaluate((element) => getComputedStyle(element).position)).toBe('fixed');

  const box = (await controls.boundingBox())!;
  expect(box.x + box.width).toBeLessThanOrEqual(1920);
  expect(box.y + box.height).toBeLessThanOrEqual(1080);
  if (process.env.TDC_SIMULATION_COMMON_SCREENSHOT_PATH) {
    await page.screenshot({ path: process.env.TDC_SIMULATION_COMMON_SCREENSHOT_PATH });
  }
});

test('the simulation panel collapses and remembers where it was dragged', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/room/42?test=true&at=10%3A15');
  const controls = page.getByRole('region', { name: 'Simulation controls' });
  const handle = controls.getByText('Simulated time', { exact: true });
  const before = (await controls.boundingBox())!;

  const grab = (await handle.boundingBox())!;
  await page.mouse.move(grab.x + 10, grab.y + 5);
  await page.mouse.down();
  await page.mouse.move(grab.x - 390, grab.y - 295, { steps: 5 });
  await page.mouse.up();
  const moved = (await controls.boundingBox())!;
  expect(moved.x).toBeCloseTo(before.x - 400, -1);
  expect(moved.y).toBeCloseTo(before.y - 300, -1);

  await page.getByRole('button', { name: 'Collapse simulation controls' }).click();
  await expect(page.getByLabel('Day scrubber')).toBeHidden();
  await expect(controls.getByText('10:15')).toBeVisible();

  await page.reload();
  await expect(page.getByLabel('Day scrubber')).toBeHidden();
  await page.getByRole('button', { name: 'Expand simulation controls' }).click();
  await expect(page.getByLabel('Day scrubber')).toBeVisible();
  const restored = (await controls.boundingBox())!;
  expect(restored.x + restored.width).toBeCloseTo(moved.x + moved.width, -1);
  expect(restored.y + restored.height).toBeCloseTo(moved.y + moved.height, -1);
});

test('simulation controls remain usable when the valid schedule has no sessions', async ({ page }) => {
  await page.unroute('**/api/schedule*');
  await page.route('**/api/schedule*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ fetchedAt: '2026-10-19T08:00:00.000Z', rooms: [], sessions: [] }),
    }),
  );
  await page.goto('/?test=true&at=10%3A15');

  await expect(page.getByRole('heading', { name: 'Choose a screen' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Simulation controls' })).toBeVisible();
  await expect(page.getByLabel('Day scrubber')).toBeVisible();
});
