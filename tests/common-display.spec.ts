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

  const dimensions = await page.locator('.common-display').evaluate((element) => ({
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
  await expect(roomA.getByText(/break/i)).toBeVisible();
  await expect(roomB.getByText('Room B next talk')).toBeVisible();
  await expect(roomB.getByText('10:45', { exact: true })).toBeVisible();
  await expect(roomB.getByText(/break/i)).toBeVisible();
  await expect(roomA.getByText('Room B next talk')).toHaveCount(0);
});

test('emphasizes the next room talk and its actual start during lunch', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.clock.setFixedTime(new Date('2026-10-19T10:15:00.000Z'));
  await page.goto('/common');

  const roomA = page.getByRole('article', { name: 'Room A' });
  await expect(roomA.getByText('Lunch · next talk')).toBeVisible();
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
  await page.clock.setFixedTime(new Date('2026-10-19T06:00:00.000Z'));
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
