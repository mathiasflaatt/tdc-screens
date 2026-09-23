import { defineConfig, devices } from '@playwright/test';

const DEV_URL = 'http://127.0.0.1:4173';
// Separate from `npm run preview:production` (4174) so a running preview never blocks tests.
const PRODUCTION_URL = 'http://127.0.0.1:4175';
const PRODUCTION_SPECS = '**/production-*.spec.ts';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    timezoneId: 'America/Los_Angeles',
    viewport: { width: 1080, height: 1920 },
    headless: true,
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : undefined,
  },
  projects: [
    { name: 'behavior', testIgnore: PRODUCTION_SPECS, use: { baseURL: DEV_URL } },
    // Runs against `vite build` output served with vercel.json routing (no implicit SPA fallback).
    { name: 'production', testMatch: PRODUCTION_SPECS, use: { baseURL: PRODUCTION_URL } },
  ],
  webServer: [
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 4173 --strictPort',
      url: DEV_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: 'npm run build && node scripts/serve-production.mjs',
      url: PRODUCTION_URL,
      env: { PORT: '4175' },
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
