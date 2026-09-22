# TDC conference displays

The home page lists the available room displays. Each room has a permanent link at `/room/<sessionize-room-id>`, so a TV can be configured once and reloaded directly.

The display reads the TDC 2026 Sessionize GridSmart, Sessions, and Speakers feeds through the same-origin `/api/schedule` endpoint. GridSmart supplies the room IDs and scheduled times; the other feeds enrich titles and speaker names. The server endpoint uses only the fixed TDC feed URLs.

## Run locally

```sh
npm install
npm run dev
```

Open the local address printed by Vite to choose a room. The schedule refreshes every five minutes, while session highlighting and the clock update every second. If a refresh fails, the last successful schedule remains on screen and is marked as possibly out of date.

## Verify

```sh
npm run typecheck
npm test
npm run test:api
```

The browser suite uses controlled schedule responses and a frozen clock in an America/Los_Angeles browser context to check room selection, direct links, Oslo time, live-session transitions, unknown rooms, and a first-load failure. Install the matching Playwright Chromium with `npx playwright install chromium`; a preinstalled Chromium can be selected with `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.

## Deploy

Import the repository into Vercel. `vercel.json` configures the static build output, the `/api/schedule` serverless function, and direct room URL rewrites. No database or environment secrets are required.

The visual direction follows the [TDC 2026 website](https://2026.trondheimdc.no/#coc): near-black surfaces, mint accents, a yellow highlight, and strong readable type.
