import { expect, test } from '@playwright/test';

const schedule = {
  fetchedAt: '2026-10-19T08:00:00.000Z',
  rooms: [{ id: '42', name: 'Andromeda' }, { id: '77', name: 'Aurora' }],
  sessions: [
    {
      id: 'talk-1', roomId: '42', room: 'Andromeda', title: 'The first duck-delivered talk',
      startsAt: '2026-10-19T10:00:00', endsAt: '2026-10-19T10:20:00',
      speakers: [], isServiceSession: false, isPlenumSession: false,
    },
    {
      id: 'talk-2', roomId: '42', room: 'Andromeda', title: 'The talk pulled up from the agenda',
      startsAt: '2026-10-19T10:20:00', endsAt: '2026-10-19T10:45:00',
      speakers: [], isServiceSession: false, isPlenumSession: false,
    },
    {
      id: 'lunch', roomId: '42', room: 'Andromeda', title: 'Lunch',
      startsAt: '2026-10-19T10:45:00', endsAt: '2026-10-19T11:30:00',
      speakers: [], isServiceSession: true, isPlenumSession: false,
    },
    {
      id: 'lunch-aurora', roomId: '77', room: 'Aurora', title: 'Lunch',
      startsAt: '2026-10-19T10:45:00', endsAt: '2026-10-19T11:30:00',
      speakers: [], isServiceSession: true, isPlenumSession: false,
    },
    {
      id: 'talk-aurora', roomId: '77', room: 'Aurora', title: 'An Aurora afternoon talk',
      startsAt: '2026-10-19T11:30:00', endsAt: '2026-10-19T12:00:00',
      speakers: [], isServiceSession: false, isPlenumSession: false,
    },
    {
      id: 'talk-3', roomId: '42', room: 'Andromeda', title: 'The afternoon talk',
      startsAt: '2026-10-19T11:30:00', endsAt: '2026-10-19T12:00:00',
      speakers: [], isServiceSession: false, isPlenumSession: false,
    },
  ],
};

/** Mirrors IDLE_ARRIVAL_MS / IDLE_VISIT_MS in src/components/duck/useIdleDuck.ts. */
const IDLE_ARRIVAL_MAX_MS = 90_000;
const IDLE_VISIT_MS = 16_000;

/** Mirrors DUCK_TIMING in src/components/duck/useDuckTransition.ts. */
const PROMOTE_SWAP_MS = 1_500;
const PROMOTE_TOTAL_MS = 3_000;
const ADVANCE_SWAP_MS = 2_800;
const ADVANCE_TOTAL_MS = 4_700;

test.use({ reducedMotion: 'no-preference' });

async function openRoomAt(page: import('@playwright/test').Page, utc: string, path = '/room/42') {
  await page.clock.install({ time: new Date(utc) });
  await page.route('**/api/schedule*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(schedule) }),
  );
  await page.goto(path);
}

const featuredTitle = (page: import('@playwright/test').Page) => page.locator('.featured-title');
const duck = (page: import('@playwright/test').Page) => page.locator('.duck-actor:not([data-kind="idle"])');
const idleDuck = (page: import('@playwright/test').Page) => page.locator('.duck-actor[data-kind="idle"]');

test('the duck pushes the finished talk off and pulls the next one up on the clock boundary', async ({ page }) => {
  await openRoomAt(page, '2026-10-19T08:19:59.000Z');
  await expect(featuredTitle(page)).toHaveText('The first duck-delivered talk');
  await expect(duck(page)).toHaveCount(0);

  await page.clock.fastForward(1_000);
  await expect(duck(page)).toBeVisible();
  await expect(featuredTitle(page)).toHaveText('The first duck-delivered talk');

  await page.clock.runFor(ADVANCE_SWAP_MS);
  await expect(featuredTitle(page)).toHaveText('The talk pulled up from the agenda');
  await expect(duck(page)).toBeVisible();

  await page.clock.runFor(ADVANCE_TOTAL_MS - ADVANCE_SWAP_MS);
  await expect(duck(page)).toHaveCount(0);
  await expect(page.getByText('Happening now')).toBeVisible();
});

test('the duck pecks the status pill live when the featured talk starts', async ({ page }) => {
  await openRoomAt(page, '2026-10-19T07:59:59.000Z');
  await expect(page.getByText('Starts later')).toBeVisible();

  await page.clock.fastForward(1_000);
  await expect(duck(page)).toBeVisible();
  await expect(page.getByText('Starts later')).toBeVisible();

  await page.clock.runFor(PROMOTE_SWAP_MS);
  await expect(page.getByText('Happening now')).toBeVisible();
  await expect(featuredTitle(page)).toHaveText('The first duck-delivered talk');

  await page.clock.runFor(PROMOTE_TOTAL_MS - PROMOTE_SWAP_MS);
  await expect(duck(page)).toHaveCount(0);
});

test('seeking across a boundary swaps the card without the duck', async ({ page }) => {
  await openRoomAt(page, '2026-10-19T08:15:00.000Z', '/room/42?test=true&at=10%3A19');
  await expect(featuredTitle(page)).toHaveText('The first duck-delivered talk');

  await page.getByRole('button', { name: 'Next boundary' }).click();
  await expect(featuredTitle(page)).toHaveText('The talk pulled up from the agenda');
  await expect(duck(page)).toHaveCount(0);
});

/** Steps through the random arrival window; returns the visiting duck's activity, or null if none came. */
async function awaitIdleVisit(page: import('@playwright/test').Page): Promise<string | null> {
  for (let waited = 0; waited < IDLE_ARRIVAL_MAX_MS; waited += 1_000) {
    if (await idleDuck(page).count() > 0) return idleDuck(page).getAttribute('data-activity');
    await page.clock.runFor(1_000);
  }
  return null;
}

test('some but not all room screens get a duck each break, and it eats at lunch', async ({ context }) => {
  const visits: Record<string, string | null> = {};
  for (const roomId of ['42', '77']) {
    const page = await context.newPage();
    await openRoomAt(page, '2026-10-19T08:50:00.000Z', `/room/${roomId}`);
    await expect(featuredTitle(page)).toBeVisible();
    visits[roomId] = await awaitIdleVisit(page);
    if (visits[roomId]) {
      await page.clock.runFor(IDLE_VISIT_MS);
      await expect(idleDuck(page)).toHaveCount(0);
      // One visit per break.
      await page.clock.runFor(IDLE_ARRIVAL_MAX_MS);
      await expect(idleDuck(page)).toHaveCount(0);
    }
    await page.close();
  }
  // With two rooms, at most half the rooms (one) host the duck, and at least one always does.
  expect(Object.values(visits).filter(Boolean)).toEqual(['eat']);
});

test.describe('with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('boundaries swap instantly with no duck', async ({ page }) => {
    await openRoomAt(page, '2026-10-19T08:19:59.000Z');
    await page.clock.fastForward(1_000);
    await expect(featuredTitle(page)).toHaveText('The talk pulled up from the agenda');
    await expect(duck(page)).toHaveCount(0);
    await page.clock.runFor(IDLE_ARRIVAL_MAX_MS);
    await expect(idleDuck(page)).toHaveCount(0);
  });
});
