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

test('a simulation URL selects Oslo time and labels the display while live URLs have no controls', async ({ page }) => {
  await page.goto('/room/42?simulate=2026-10-19T10%3A15%3A00');

  await expect(page.getByRole('region', { name: 'Simulation controls' })).toBeVisible();
  await expect(page.getByLabel('Simulation date and time')).toHaveValue('2026-10-19T10:15');
  await expect(page.getByLabel('Oslo local time')).toHaveText('10:15');
  await expect(page.getByText('SIMULATION MODE · NOT LIVE')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'First simulation talk' })).toBeVisible();

  await page.goto('/room/42');
  await expect(page.getByRole('region', { name: 'Simulation controls' })).toHaveCount(0);
  await expect(page.getByText('SIMULATION MODE · NOT LIVE')).toHaveCount(0);

  await page.goto('/common');
  await expect(page.getByRole('region', { name: 'Simulation controls' })).toHaveCount(0);
});

test('seeking and boundary buttons move the simulated display through schedule transitions', async ({ page }) => {
  await page.goto('/room/42?simulate=2026-10-19T10%3A15%3A00');

  await page.getByLabel('Simulation date and time').fill('2026-10-19T10:18');
  await expect(page.getByLabel('Oslo local time')).toHaveText('10:18');
  await expect(page.getByRole('heading', { name: 'First simulation talk' })).toBeVisible();
  await expect(page).toHaveURL(/simulate=2026-10-19T10%3A18%3A00/);

  await page.getByRole('button', { name: 'Next transition' }).click();
  await expect(page.getByLabel('Oslo local time')).toHaveText('10:20');
  await expect(page.getByRole('heading', { name: 'Second simulation talk' })).toBeVisible();
  await page.getByRole('button', { name: 'Previous transition' }).click();
  await expect(page.getByLabel('Oslo local time')).toHaveText('10:00');
  await expect(page.getByRole('heading', { name: 'First simulation talk' })).toBeVisible();
});

test('the day scrubber moves simulated time without changing the live clock', async ({ page }) => {
  await page.goto('/room/42?simulate=2026-10-19T10%3A15%3A00');

  await page.getByLabel('Day scrubber').press('ArrowRight');
  await expect(page.getByLabel('Oslo local time')).toHaveText('10:16');
  await expect(page.getByLabel('Simulation date and time')).toHaveValue('2026-10-19T10:16');
});

test('switching views keeps the preview position and returning to live restores the Oslo clock', async ({ page }) => {
  await page.goto('/room/42?simulate=2026-10-19T10%3A15%3A00');

  await page.getByRole('link', { name: 'Common-area view' }).click();
  await expect(page.getByRole('heading', { name: 'Common Areas' })).toBeVisible();
  await expect(page.getByLabel('Oslo local time')).toHaveText('10:15');
  await expect(page).toHaveURL(/\/common\?simulate=2026-10-19T10%3A15%3A00/);

  await page.getByRole('link', { name: 'Choose a room' }).click();
  await expect(page.getByRole('heading', { name: 'Choose a screen' })).toBeVisible();
  await page.getByRole('link', { name: /Andromeda/ }).click();
  await expect(page.getByRole('heading', { name: 'First simulation talk' })).toBeVisible();
  await expect(page.getByLabel('Oslo local time')).toHaveText('10:15');

  await page.getByRole('button', { name: 'Return to live' }).click();
  await expect(page.getByRole('region', { name: 'Simulation controls' })).toHaveCount(0);
  await expect(page).toHaveURL(/\/room\/42$/);
  await page.clock.fastForward(60_000);
  await expect(page.getByLabel('Oslo local time')).toHaveText('10:16');
});

test('playing at sixty times keeps the schedule refresh on its real five-minute cadence', async ({ page }) => {
  let requests = 0;
  await page.unroute('**/api/schedule*');
  await page.route('**/api/schedule*', (route) => {
    requests += 1;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(schedule) });
  });
  await page.goto('/room/42?simulate=2026-10-19T10%3A15%3A00');
  await expect.poll(() => requests).toBe(1);

  await page.getByLabel('Simulation date and time').fill('2026-10-19T23:00');
  await expect(page.getByLabel('Oslo local time')).toHaveText('23:00');
  expect(requests).toBe(1);
  await page.getByLabel('Simulation date and time').fill('2026-10-19T10:15');

  await page.getByRole('button', { name: '60×' }).click();
  await page.getByRole('button', { name: 'Play' }).click();
  await page.clock.fastForward(5_000);
  await expect(page.getByLabel('Oslo local time')).toHaveText('10:20');
  expect(requests).toBe(1);

  await page.clock.fastForward(240_000);
  expect(requests).toBe(1);
  await page.clock.fastForward(60_000);
  await expect.poll(() => requests).toBe(2);
});

test('playback advances at one, ten, and sixty times the real elapsed time', async ({ page }) => {
  await page.goto('/room/42?simulate=2026-10-19T10%3A15%3A00');

  await page.getByRole('button', { name: '1×' }).click();
  await page.getByRole('button', { name: 'Play' }).click();
  await page.clock.fastForward(30_000);
  await expect(page).toHaveURL(/simulate=2026-10-19T10%3A15%3A30/);
  await page.getByRole('button', { name: 'Pause' }).click();

  await page.getByRole('button', { name: '10×' }).click();
  await page.getByRole('button', { name: 'Play' }).click();
  await page.clock.fastForward(3_000);
  await expect(page).toHaveURL(/simulate=2026-10-19T10%3A16%3A00/);
  await page.getByRole('button', { name: 'Pause' }).click();

  await page.getByRole('button', { name: '60×' }).click();
  await page.getByRole('button', { name: 'Play' }).click();
  await page.clock.fastForward(1_000);
  await expect(page).toHaveURL(/simulate=2026-10-19T10%3A17%3A00/);
  await expect(page.getByLabel('Oslo local time')).toHaveText('10:17');
});

test('simulation controls fit above the schedule on portrait and landscape displays', async ({ page }) => {
  await page.setViewportSize({ width: 1080, height: 1920 });
  await page.goto('/room/42?simulate=2026-10-19T10%3A15%3A00');
  await expect(page.getByRole('region', { name: 'Simulation controls' })).toBeVisible();
  const roomLayout = await page.evaluate(() => {
    const main = document.querySelector('.display-page')!;
    const controls = main.querySelector('.simulation-controls')!;
    const scheduleArea = main.querySelector('.display-content')!;
    const footer = main.querySelector('.display-footer')!;
    return {
      controlsBottom: controls.getBoundingClientRect().bottom,
      scheduleTop: scheduleArea.getBoundingClientRect().top,
      footerBottom: footer.getBoundingClientRect().bottom,
      height: main.clientHeight,
      scrollHeight: main.scrollHeight,
      controlsBackground: getComputedStyle(controls).backgroundColor,
      labelColor: getComputedStyle(controls.querySelector('.simulation-mode-label')!).color,
    };
  });
  expect(roomLayout.controlsBottom).toBeLessThanOrEqual(roomLayout.scheduleTop);
  expect(roomLayout.footerBottom).toBeLessThanOrEqual(roomLayout.height);
  expect(roomLayout.scrollHeight).toBeLessThanOrEqual(roomLayout.height + 1);
  expect(roomLayout.controlsBackground).toBe('rgb(32, 32, 32)');
  expect(roomLayout.labelColor).toBe('rgb(181, 240, 180)');
  if (process.env.TDC_SIMULATION_SCREENSHOT_PATH) {
    await page.screenshot({ path: process.env.TDC_SIMULATION_SCREENSHOT_PATH, fullPage: true });
  }

  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/common?simulate=2026-10-19T10%3A15%3A00');
  await expect(page.getByRole('region', { name: 'Simulation controls' })).toBeVisible();
  const commonLayout = await page.evaluate(() => {
    const main = document.querySelector('.common-display')!;
    const controls = main.querySelector('.simulation-controls')!;
    const scheduleArea = main.querySelector('.common-content')!;
    const footer = main.querySelector('.common-footer')!;
    return {
      controlsBottom: controls.getBoundingClientRect().bottom,
      scheduleTop: scheduleArea.getBoundingClientRect().top,
      footerBottom: footer.getBoundingClientRect().bottom,
      height: main.clientHeight,
      scrollHeight: main.scrollHeight,
    };
  });
  expect(commonLayout.controlsBottom).toBeLessThanOrEqual(commonLayout.scheduleTop);
  expect(commonLayout.footerBottom).toBeLessThanOrEqual(commonLayout.height);
  expect(commonLayout.scrollHeight).toBeLessThanOrEqual(commonLayout.height + 1);
  if (process.env.TDC_SIMULATION_COMMON_SCREENSHOT_PATH) {
    await page.screenshot({ path: process.env.TDC_SIMULATION_COMMON_SCREENSHOT_PATH, fullPage: true });
  }
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
  await page.goto('/?simulate=2026-10-19T10%3A15%3A00');

  await expect(page.getByRole('heading', { name: 'Choose a screen' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Simulation controls' })).toBeVisible();
  await expect(page.getByLabel('Day scrubber')).toBeVisible();
});
