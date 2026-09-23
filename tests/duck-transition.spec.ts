import { expect, test } from '@playwright/test';

const schedule = {
  fetchedAt: '2026-10-19T08:00:00.000Z',
  rooms: [{ id: '42', name: 'Andromeda' }],
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
  ],
};

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
const duck = (page: import('@playwright/test').Page) => page.locator('.duck-actor');

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

test.describe('with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('boundaries swap instantly with no duck', async ({ page }) => {
    await openRoomAt(page, '2026-10-19T08:19:59.000Z');
    await page.clock.fastForward(1_000);
    await expect(featuredTitle(page)).toHaveText('The talk pulled up from the agenda');
    await expect(duck(page)).toHaveCount(0);
  });
});
