import { expect, test } from '@playwright/test';

const talkRooms = [
  { id: 'room-a', name: 'Room A' },
  { id: 'room-b', name: 'Room B' },
  { id: 'room-c', name: 'Room C' },
  { id: 'room-d', name: 'Room D' },
  { id: 'room-e', name: 'Room E' },
  { id: 'room-f', name: 'Room F' },
  { id: 'main-hall', name: 'Main Hall' },
];

function session(
  id: string,
  roomId: string,
  title: string,
  startsAt: string,
  endsAt: string,
  options: { service?: boolean; plenary?: boolean } = {},
) {
  const room = talkRooms.find((candidate) => candidate.id === roomId)!;
  return {
    id,
    roomId,
    room: room.name,
    title,
    startsAt: `2026-10-19T${startsAt}:00`,
    endsAt: `2026-10-19T${endsAt}:00`,
    speakers: [],
    isServiceSession: options.service ?? false,
    isPlenumSession: options.plenary ?? false,
  };
}

const longTitle = 'Building resilient systems by learning from unexpected failures in production';
const schedule = {
  fetchedAt: '2026-10-19T07:00:00.000Z',
  rooms: talkRooms,
  sessions: [
    session('a-now', 'room-a', longTitle, '10:00', '10:30'),
    session('a-break', 'room-a', 'Coffee break', '10:30', '11:15', { service: true }),
    session('a-next', 'room-a', 'Room A next talk', '11:15', '12:00'),
    session('a-lunch', 'room-a', 'Lunch', '12:00', '12:30', { service: true }),
    session('a-after-lunch', 'room-a', 'Room A afternoon talk', '12:30', '13:00'),
    session('b-now', 'room-b', 'Room B current talk', '10:00', '10:20'),
    session('b-break', 'room-b', 'Coffee break', '10:20', '10:45', { service: true }),
    session('b-next', 'room-b', 'Room B next talk', '10:45', '11:30'),
    session('c-now', 'room-c', 'Room C current talk', '10:00', '10:40'),
    session('c-next', 'room-c', 'Room C next talk', '10:50', '11:30'),
    session('d-first', 'room-d', 'Room D first talk', '10:40', '10:55'),
    session('e-last', 'room-e', 'Room E final talk', '09:30', '10:10'),
    session('f-first', 'room-f', 'Room F first talk', '10:00', '10:30'),
    session('f-next', 'room-f', 'Room F next talk', '11:00', '11:40'),
    session('opening-plenary', 'main-hall', 'Opening plenary', '10:40', '10:55', { plenary: true }),
  ],
};

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-19T08:15:00.000Z') });
  await page.route('**/api/schedule*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(schedule) }),
  );
});

test('opens the permanent common-area URL after a reload with six feed-derived talk rooms', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/common');

  await expect(page.getByRole('heading', { name: /common areas/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: longTitle })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Room B', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Main Hall' })).toHaveCount(0);
  await expect(page.getByRole('article')).toHaveCount(6);

  await page.reload();
  await expect(page).toHaveURL(/\/common$/);
  await expect(page.getByRole('heading', { name: /common areas/i })).toBeVisible();
  await expect(page.getByRole('article')).toHaveCount(6);

  const dimensions = await page.getByRole('main', { name: 'Common-area conference overview' }).evaluate((element) => ({
    width: element.clientWidth,
    height: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }));
  expect(dimensions.width).toBe(1920);
  expect(dimensions.height).toBe(1080);
  expect(dimensions.scrollHeight).toBeLessThanOrEqual(dimensions.height + 1);
  await expect(page.getByRole('heading', { name: longTitle })).toBeInViewport();
  if (process.env.TDC_COMMON_SCREENSHOT_PATH) await page.screenshot({ path: process.env.TDC_COMMON_SCREENSHOT_PATH, fullPage: true });
});

test('shows each room’s current talk independently and gives local talks priority over plenaries', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/common');

  await expect(page.getByRole('heading', { name: longTitle })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Room B current talk' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Room C current talk' })).toBeVisible();
  await expect(page.getByText('Opening plenary')).toHaveCount(0);
  await expect(page.getByRole('article', { name: 'Room A' }).getByText('10:00–10:30')).toBeVisible();
});

test('emphasizes independently timed next talks during breaks', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.clock.setFixedTime(new Date('2026-10-19T08:32:00.000Z'));
  await page.goto('/common');

  const roomA = page.getByRole('article', { name: 'Room A' });
  const roomB = page.getByRole('article', { name: 'Room B' });
  await expect(roomA.getByText('Room A next talk')).toBeVisible();
  await expect(roomA.getByText('11:15', { exact: true })).toBeVisible();
  await expect(roomA.getByText('Up next')).toBeVisible();
  await expect(roomB.getByText('Room B next talk')).toBeVisible();
  await expect(roomB.getByText('10:45', { exact: true })).toBeVisible();
  await expect(roomA.getByText('Room B next talk')).toHaveCount(0);
  const banner = page.getByRole('status', { name: 'Shared programme' });
  await expect(banner.getByText('Coffee break')).toBeVisible();
  await expect(page.getByRole('article').getByText(/break/i)).toHaveCount(0);
});

test('emphasizes the next room talk and its actual start during lunch', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.clock.setFixedTime(new Date('2026-10-19T10:15:00.000Z'));
  await page.goto('/common');

  const roomA = page.getByRole('article', { name: 'Room A' });
  const banner = page.getByRole('status', { name: 'Shared programme' });
  await expect(banner.getByText('Lunch', { exact: true }).first()).toBeVisible();
  await expect(roomA.getByText('Up next')).toBeVisible();
  await expect(roomA.getByText('Room A afternoon talk')).toBeVisible();
  await expect(roomA.getByText('12:30', { exact: true })).toBeVisible();
});

test('shows a shared plenary once with its actual venue without treating it as a room talk', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.clock.setFixedTime(new Date('2026-10-19T08:42:00.000Z'));
  await page.goto('/common');

  await expect(page.getByText('Opening plenary')).toHaveCount(1);
  await expect(page.getByText(/Main Hall/)).toBeVisible();
  await expect(page.getByRole('article')).toHaveCount(6);
  await expect(page.getByRole('article').filter({ hasText: 'Opening plenary' })).toHaveCount(0);
  await expect(page.getByRole('article', { name: 'Room A' }).getByText('Room A next talk')).toBeVisible();
  await expect(page.getByRole('article', { name: 'Room B' }).getByText('10:45', { exact: true })).toBeVisible();
  await expect(page.getByRole('article', { name: 'Room D' }).getByText('Room D first talk')).toBeVisible();
});

test('shows before-event, finished-room, and complete-program states', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.clock.setFixedTime(new Date('2026-10-18T06:00:00.000Z'));
  await page.goto('/common');
  await expect(page.getByText('Starts later')).toHaveCount(6);
  await expect(page.getByRole('article', { name: 'Room A' }).getByText('10:00', { exact: true })).toBeVisible();
  await expect(page.getByRole('article', { name: 'Room A' }).getByText('Monday, 19 October 2026')).toBeVisible();

  await page.clock.setFixedTime(new Date('2026-10-19T08:15:00.000Z'));
  await page.reload();
  await expect(page.getByRole('article', { name: 'Room E' }).getByText(/no more talks today/i)).toBeVisible();

  await page.clock.setFixedTime(new Date('2026-10-19T12:00:00.000Z'));
  await page.reload();
  await expect(page.getByRole('heading', { name: /programme complete/i })).toBeVisible();
});

test('offers a common-area link from the screen selector', async ({ page }) => {
  await page.goto('/');

  const commonLink = page.getByRole('link', { name: /common-area display/i });
  await expect(commonLink).toHaveAttribute('href', '/common');
  await commonLink.click();
  await expect(page).toHaveURL(/\/common$/);
  await expect(page.getByRole('heading', { name: /common areas/i })).toBeVisible();
});

test('moves updated talks to their new room and removes cancelled talks on refresh', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-19T08:15:00.000Z'));
  let refreshedSchedule = schedule;
  let requests = 0;

  await page.unroute('**/api/schedule*');
  await page.route('**/api/schedule*', async (route) => {
    requests += 1;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(refreshedSchedule) });
  });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/common');

  await expect(page.getByRole('article', { name: 'Room A' }).getByRole('heading', { name: longTitle })).toBeVisible();
  await expect(page.getByRole('article', { name: 'Room B' }).getByRole('heading', { name: 'Room B current talk' })).toBeVisible();
  const movedTalk = {
    ...schedule.sessions.find((candidate) => candidate.id === 'a-now')!,
    roomId: 'room-b',
    room: 'Room B',
    title: 'Talk moved into Room B',
    startsAt: '2026-10-19T10:05:00',
    endsAt: '2026-10-19T10:55:00',
  };
  refreshedSchedule = {
    ...schedule,
    sessions: [
      ...schedule.sessions.filter((candidate) => candidate.id !== 'a-now' && candidate.id !== 'b-now'),
      movedTalk,
    ],
  };

  await page.clock.fastForward(5 * 60 * 1000);

  await expect(page.getByRole('article', { name: 'Room B' }).getByRole('heading', { name: 'Talk moved into Room B' })).toBeVisible();
  await expect(page.getByRole('article', { name: 'Room B' }).getByText('10:05–10:55')).toBeVisible();
  await expect(page.getByRole('article', { name: 'Room A' }).getByRole('heading', { name: longTitle })).toHaveCount(0);
  await expect(page.getByRole('article', { name: 'Room B' }).getByRole('heading', { name: 'Room B current talk' })).toHaveCount(0);
  await expect.poll(() => requests).toBe(2);
});

test('shows every talk room as a column with now, next, and remaining talks', async ({ page }) => {
  const withSpeakers = {
    ...schedule,
    sessions: schedule.sessions.map((entry) => entry.id === 'a-now'
      ? {
        ...entry,
        speakers: [
          { id: 'sp-1', name: 'Mina Example', portraitUrl: 'https://images.example.test/mina.webp' },
          { id: 'sp-2', name: 'Ola Example' },
        ],
      }
      : entry),
  };
  await page.route('https://images.example.test/**', (route) =>
    route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2 2"><rect width="2" height="2" fill="#9bf7a9"/></svg>' }),
  );
  await page.unroute('**/api/schedule*');
  await page.route('**/api/schedule*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(withSpeakers) }),
  );
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/common');

  const header = page.getByRole('main').locator('header');
  await expect(header.getByRole('heading', { name: /common areas/i, level: 1 })).toBeVisible();
  await expect(header.getByRole('img', { name: 'TDC' })).toBeVisible();
  await expect(header.getByLabel('Oslo local time')).toHaveText('10:15');
  await expect(page.getByText('All room screens')).toHaveCount(0);
  await expect(page.getByText(/Europe\/Oslo/)).toHaveCount(0);
  await expect(page.getByRole('link')).toHaveCount(0);

  const columns = page.getByRole('article');
  await expect(columns).toHaveCount(6);
  const boxes = await columns.evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().toJSON()));
  for (let index = 1; index < boxes.length; index += 1) {
    expect(boxes[index].x).toBeGreaterThan(boxes[index - 1].x + boxes[index - 1].width - 1);
    expect(Math.abs(boxes[index].y - boxes[0].y)).toBeLessThan(1);
  }

  const roomA = page.getByRole('article', { name: 'Room A' });
  await expect(roomA.getByText('Now', { exact: true })).toBeVisible();
  await expect(roomA.getByRole('heading', { name: longTitle })).toBeVisible();
  await expect(roomA.getByText('Mina Example')).toBeVisible();
  await expect(roomA.getByRole('img', { name: /mina example portrait/i })).toBeVisible();
  await expect(roomA.getByText('Ola Example')).toBeVisible();
  await expect(roomA.getByText('Up next')).toBeVisible();
  await expect(roomA.getByRole('heading', { name: 'Room A next talk' })).toBeVisible();
  await expect(roomA.getByText('11:15', { exact: true })).toBeVisible();
  await expect(roomA.getByRole('list', { name: 'Later in Room A' }).getByRole('listitem')).toHaveText([
    /12:30\s*Room A afternoon talk/,
  ]);
  await expect(page.getByRole('status', { name: 'Shared programme' })).toHaveCount(0);
});

test('shows a shared plenary as a full-width banner above the columns', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.clock.setFixedTime(new Date('2026-10-19T08:42:00.000Z'));
  await page.goto('/common');

  const banner = page.getByRole('status', { name: 'Shared programme' });
  await expect(banner.getByText('Opening plenary')).toBeVisible();
  const bannerBox = await banner.boundingBox();
  const columnsBox = await page.getByRole('region', { name: 'Talk rooms' }).boundingBox();
  expect(bannerBox!.y + bannerBox!.height).toBeLessThanOrEqual(columnsBox!.y);
  expect(bannerBox!.width).toBeCloseTo(columnsBox!.width, 0);
});

test('renders the landscape canvas identically on a 4K screen', async ({ page }) => {
  await page.setViewportSize({ width: 3840, height: 2160 });
  await page.goto('/common');

  const canvas = page.getByRole('main', { name: 'Common-area conference overview' });
  await expect(canvas.getByRole('heading', { name: longTitle })).toBeVisible();
  expect(await canvas.boundingBox()).toEqual({ x: 0, y: 0, width: 3840, height: 2160 });
  const dimensions = await canvas.evaluate((element) => ({
    width: element.clientWidth,
    height: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }));
  expect(dimensions).toMatchObject({ width: 1920, height: 1080 });
  expect(dimensions.scrollHeight).toBeLessThanOrEqual(1080);
});
