import { expect, test, type Page } from '@playwright/test';

// Runs in the `production` project: the `vite build` output served with vercel.json routing.
// The schedule is stubbed in the browser, so these checks never reach Sessionize.

const schedule = {
  fetchedAt: '2026-10-19T08:00:00.000Z',
  rooms: [{ id: '42', name: 'Andromeda' }],
  sessions: [
    {
      id: 'talk-1', roomId: '42', room: 'Andromeda', title: 'A production build talk',
      startsAt: '2026-10-19T10:00:00', endsAt: '2026-10-19T10:40:00',
      speakers: [{ id: 'speaker-1', name: 'Mina Example' }], isServiceSession: false, isPlenumSession: false,
    },
  ],
};

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-19T08:15:00.000Z') });
  await page.route('**/api/schedule*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(schedule) }),
  );
});

async function expectScreenSelector(page: Page) {
  await expect(page.locator('a[href="/room/42"]')).toBeVisible();
  await expect(page.locator('a[href="/common"]')).toBeVisible();
}

async function expectRoomDisplay(page: Page) {
  await expect(page.getByRole('heading', { level: 1, name: 'Andromeda' })).toBeVisible();
  await expect(page.getByText('A production build talk')).toBeVisible();
}

async function expectCommonDisplay(page: Page) {
  await expect(page.getByRole('heading', { level: 2, name: 'Andromeda' })).toBeVisible();
  await expect(page.getByText('A production build talk')).toBeVisible();
}

const directLinks: { path: string; expectDisplay: (page: Page) => Promise<void> }[] = [
  { path: '/', expectDisplay: expectScreenSelector },
  { path: '/room/42', expectDisplay: expectRoomDisplay },
  { path: '/room/42/', expectDisplay: expectRoomDisplay },
  { path: '/room/42?test=true&at=10%3A35', expectDisplay: expectRoomDisplay },
  { path: '/common', expectDisplay: expectCommonDisplay },
  { path: '/common/', expectDisplay: expectCommonDisplay },
  { path: '/common?test=true&at=10%3A35', expectDisplay: expectCommonDisplay },
];

for (const { path, expectDisplay } of directLinks) {
  test(`serves ${path} as a direct link and after reload`, async ({ page, baseURL }) => {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expectDisplay(page);

    const reload = await page.reload();
    expect(reload?.status()).toBe(200);
    expect(page.url()).toBe(new URL(path, baseURL).href);
    await expectDisplay(page);
  });
}

test('keeps the schedule function reachable instead of rewriting it to the app shell', async ({ request }) => {
  // POST is rejected by the handler itself, so this proves routing without calling Sessionize.
  const response = await request.post('/api/schedule');
  expect(response.status()).toBe(405);
  expect(response.headers()['content-type']).toContain('application/json');
  expect(await response.json()).toEqual({ error: 'Method not allowed' });
});

test('serves hashed build assets rather than the app shell', async ({ page }) => {
  const assetResponses: { url: string; contentType: string }[] = [];
  page.on('response', (response) => {
    if (new URL(response.url()).pathname.startsWith('/assets/')) {
      assetResponses.push({ url: response.url(), contentType: response.headers()['content-type'] ?? '' });
    }
  });
  await page.goto('/room/42');
  await expectRoomDisplay(page);

  expect(assetResponses.length).toBeGreaterThan(0);
  for (const asset of assetResponses) expect(asset.contentType).not.toContain('text/html');
});
