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

test('the test URL restores a feed-date simulation position and playback speed', async ({ page }) => {
  await page.goto('/room/42?test=true&at=10%3A15&speed=10');

  await expect(page.getByRole('region', { name: 'Simulation controls' })).toBeVisible();
  await expect(page.getByLabel('Simulation time')).toHaveValue('10:15');
  await expect(page.getByLabel('Oslo local time')).toHaveText('10:15');
  await expect(page.getByText('Simulated time', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '10×' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('heading', { name: 'First simulation talk' })).toBeVisible();

  await page.reload();
  await expect(page.getByLabel('Simulation time')).toHaveValue('10:15');
  await expect(page.getByRole('button', { name: '10×' })).toHaveAttribute('aria-pressed', 'true');
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

test('seeking and boundary buttons move the simulated display through schedule transitions', async ({ page }) => {
  await page.goto('/room/42?test=true&at=10%3A15');

  await page.getByLabel('Simulation time').fill('10:18');
  await expect(page.getByLabel('Oslo local time')).toHaveText('10:18');
  await expect(page.getByText('Monday, 19 October 2026', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'First simulation talk' })).toBeVisible();
  await expect(page).toHaveURL(/at=10%3A18/);

  await page.getByRole('button', { name: 'Next boundary' }).click();
  await expect(page.getByLabel('Oslo local time')).toHaveText('10:20');
  await expect(page.getByRole('heading', { name: 'Second simulation talk' })).toBeVisible();
  await page.getByRole('button', { name: 'Previous boundary' }).click();
  await expect(page.getByLabel('Oslo local time')).toHaveText('10:00');
  await expect(page.getByRole('heading', { name: 'First simulation talk' })).toBeVisible();
});

test('the day scrubber moves simulated time without changing the live clock', async ({ page }) => {
  await page.goto('/room/42?test=true&at=10%3A15');

  await page.getByLabel('Day scrubber').press('ArrowRight');
  await expect(page.getByLabel('Oslo local time')).toHaveText('10:16');
  await expect(page.getByLabel('Simulation time')).toHaveValue('10:16');
  await expect(page.locator('datalist option')).toHaveCount(4);
});

test('switching views keeps the preview position and returning to live restores the Oslo clock', async ({ page }) => {
  await page.goto('/room/42?test=true&at=10%3A15&speed=10');

  await page.getByRole('link', { name: 'Common-area view' }).click();
  await expect(page.getByRole('heading', { name: 'Common Areas' })).toBeVisible();
  await expect(page.getByLabel('Oslo local time')).toHaveText('10:15');
  await expect(page).toHaveURL(/\/common\?test=true&at=10%3A15&speed=10/);

  await page.getByRole('link', { name: 'Choose a room' }).click();
  await expect(page.getByRole('heading', { name: 'Choose a screen' })).toBeVisible();
  await page.getByRole('link', { name: /Andromeda/ }).click();
  await expect(page.getByRole('heading', { name: 'First simulation talk' })).toBeVisible();
  await expect(page.getByLabel('Oslo local time')).toHaveText('10:15');
  await expect(page).toHaveURL(/\/room\/42\?test=true&at=10%3A15&speed=10/);

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
  await page.goto('/room/42?test=true&at=10%3A15&speed=60');

  await page.getByRole('link', { name: 'TDC 2026 conference displays' }).click();
  await expect(page.getByRole('heading', { name: 'Choose a screen' })).toBeVisible();
  await expect(page).toHaveURL(/\/?\?test=true&at=10%3A15&speed=60/);
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

  await page.getByRole('button', { name: '60×' }).click();
  await expect(page).toHaveURL(/test=true&at=10%3A15&speed=60/);
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
  await page.goto('/room/42?test=true&at=10%3A15');

  await page.getByRole('button', { name: '1×' }).click();
  await page.getByRole('button', { name: 'Play' }).click();
  await page.clock.fastForward(30_000);
  await expect(page).toHaveURL(/at=10%3A15/);
  await page.getByRole('button', { name: 'Pause' }).click();

  await page.getByRole('button', { name: '10×' }).click();
  await page.getByRole('button', { name: 'Play' }).click();
  await page.clock.fastForward(3_000);
  await expect(page).toHaveURL(/at=10%3A16/);
  await page.getByRole('button', { name: 'Pause' }).click();

  await page.getByRole('button', { name: '60×' }).click();
  await page.getByRole('button', { name: 'Play' }).click();
  await page.clock.fastForward(1_000);
  await expect(page).toHaveURL(/at=10%3A17/);
  await expect(page.getByLabel('Oslo local time')).toHaveText('10:17');
});

test('simulation controls sit below the schedule without obscuring room or common displays', async ({ page }) => {
  await page.setViewportSize({ width: 1080, height: 1920 });
  await page.goto('/room/42?test=true&at=10%3A15');
  const roomMain = page.getByRole('main', { name: 'Room display for Andromeda' });
  const roomControls = roomMain.getByRole('region', { name: 'Simulation controls' });
  const roomSchedule = roomMain.getByRole('region', { name: 'Live schedule for Andromeda' });
  const roomFooter = roomMain.getByText('Europe/Oslo', { exact: true });
  await expect(roomControls).toBeVisible();
  const [roomDimensions, roomControlsBox, roomScheduleBox, roomFooterBox, roomControlsBackground, roomLabelColor] = await Promise.all([
    roomMain.evaluate((element) => ({ height: element.clientHeight, scrollHeight: element.scrollHeight })),
    roomControls.boundingBox(),
    roomSchedule.boundingBox(),
    roomFooter.boundingBox(),
    roomControls.evaluate((element) => getComputedStyle(element).backgroundColor),
    roomControls.getByText('Simulated time', { exact: true }).evaluate((element) => getComputedStyle(element).color),
  ]);
  expect(roomControlsBox).not.toBeNull();
  expect(roomScheduleBox).not.toBeNull();
  expect(roomFooterBox).not.toBeNull();
  const roomLayout = {
    controlsTop: roomControlsBox!.y,
    scheduleBottom: roomScheduleBox!.y + roomScheduleBox!.height,
    footerBottom: roomFooterBox!.y + roomFooterBox!.height,
    height: roomDimensions.height,
    scrollHeight: roomDimensions.scrollHeight,
    controlsBackground: roomControlsBackground,
    labelColor: roomLabelColor,
  };
  expect(roomLayout.controlsTop).toBeGreaterThanOrEqual(roomLayout.scheduleBottom);
  expect(roomLayout.footerBottom).toBeLessThanOrEqual(roomLayout.height);
  expect(roomLayout.scrollHeight).toBeLessThanOrEqual(roomLayout.height + 1);
  expect(roomLayout.controlsBackground).toBe('rgb(32, 32, 32)');
  expect(roomLayout.labelColor).toBe('rgb(181, 240, 180)');
  if (process.env.TDC_SIMULATION_SCREENSHOT_PATH) {
    await page.screenshot({ path: process.env.TDC_SIMULATION_SCREENSHOT_PATH, fullPage: true });
  }

  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/common?test=true&at=10%3A15');
  const commonMain = page.getByRole('main', { name: 'Common-area conference overview' });
  const commonControls = commonMain.getByRole('region', { name: 'Simulation controls' });
  const commonSchedule = commonMain.getByRole('region', { name: 'Talk rooms' });
  const commonFooter = commonMain.getByText('Europe/Oslo', { exact: true });
  await expect(commonControls).toBeVisible();
  const [commonDimensions, commonControlsBox, commonScheduleBox, commonFooterBox] = await Promise.all([
    commonMain.evaluate((element) => ({ height: element.clientHeight, scrollHeight: element.scrollHeight })),
    commonControls.boundingBox(),
    commonSchedule.boundingBox(),
    commonFooter.boundingBox(),
  ]);
  expect(commonControlsBox).not.toBeNull();
  expect(commonScheduleBox).not.toBeNull();
  expect(commonFooterBox).not.toBeNull();
  const commonLayout = {
    controlsTop: commonControlsBox!.y,
    scheduleBottom: commonScheduleBox!.y + commonScheduleBox!.height,
    footerBottom: commonFooterBox!.y + commonFooterBox!.height,
    height: commonDimensions.height,
    scrollHeight: commonDimensions.scrollHeight,
  };
  expect(commonLayout.controlsTop).toBeGreaterThanOrEqual(commonLayout.scheduleBottom);
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
  await page.goto('/?test=true&at=10%3A15');

  await expect(page.getByRole('heading', { name: 'Choose a screen' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Simulation controls' })).toBeVisible();
  await expect(page.getByLabel('Day scrubber')).toBeVisible();
});
