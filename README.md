# TDC conference displays

The home page lists the available room displays and links to the common-area overview. Each room has a permanent URL at `/room/<sessionize-room-id>`, and the common-area display is at `/common`; use these links when configuring TVs. Room cards are derived from the current Sessionize schedule.

## Schedule data

The browser reads the same-origin `/api/schedule` endpoint. It uses the fixed TDC 2026 Sessionize feed URLs: GridSmart is the source for rooms and scheduled times, while Sessions and Speakers add titles and speaker names when available. The endpoint does not accept an upstream URL from the request. GridSmart is required; if it is unavailable or invalid, the endpoint returns an error. The browser keeps the last valid schedule in local storage and marks it as possibly out of date if a refresh fails.

Each display requests the schedule on startup and every five minutes. The Oslo clock and session state update every second between requests. The API fetches the three feeds concurrently, with a 10-second timeout per upstream request, and sends `no-store` cache headers.

## Run locally

```sh
npm install
npm run dev
```

Open the local address printed by Vite to choose a room. Vite serves the same `/api/schedule` handler used by the deployment.

## Verify

```sh
npm run typecheck
npm test
npm run test:api
npm run smoke:sessionize   # opt-in, uses the live Sessionize feeds
```

`npm test` also builds the app and checks direct links and reloads against the production output served with `vercel.json` routing (`npm run test:production`).

The browser tests use controlled schedule responses and a frozen clock in an `America/Los_Angeles` browser context. They cover room selection and direct links, Oslo time, session changes, common-area room selection and layout, breaks and lunch, plenaries, unequal room start times, unknown rooms, five-minute refreshes, outage recovery, and unavailable local storage. The simulation-mode polling check depends on issue #6, which adds the simulated clock; this suite verifies refresh cadence and live schedule transitions independently. Install Playwright's Chromium with `npx playwright install chromium`. To use an existing Chrome or Chromium installation, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to its executable path before running `npm test`.

## Deploy to Vercel

See [docs/deployment.md](docs/deployment.md) for Vercel setup, the no-database design, TV/kiosk browser setup (full screen, no sleep, no scrollbars, 1080p versus 4K), and the live Sessionize smoke check. Hobby is limited to personal, non-commercial use, so check eligibility against Vercel's current terms before deploying.

The visual direction follows the [TDC 2026 website](https://2026.trondheimdc.no/#coc): near-black surfaces, mint accents, a yellow highlight, and readable type.
