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
```

The browser tests use controlled schedule responses and a frozen clock in an `America/Los_Angeles` browser context. They cover room selection and direct links, Oslo time, session changes, common-area room selection and layout, breaks and lunch, plenaries, unequal room start times, unknown rooms, and schedule-loading failures. Install Playwright's Chromium with `npx playwright install chromium`. To use an existing Chrome or Chromium installation, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to its executable path before running `npm test`.

## Deploy to Vercel

Import this repository as a Vercel project. The project settings in `vercel.json` run `npm run build`, serve the `dist` output, and rewrite `/room/<id>` and `/common` to the single-page app. Vercel discovers the `/api/schedule` function from `api/schedule.js`. No database, environment variables, or scheduled job are needed.

Every active screen polls the function every five minutes; the function calls Sessionize for each request and is not backed by a server cache. Estimate about 12 function invocations per active screen per hour, plus initial loads and retries. Vercel currently lists 1,000,000 monthly function invocations on Hobby, which is limited to personal, non-commercial use. A conference deployment may not qualify, so check the current [Hobby plan terms and usage](https://vercel.com/docs/plans/hobby) and [Function limits](https://vercel.com/docs/functions/limitations) for the account and deployment before choosing a plan. The function's upstream timeout is 10 seconds; Vercel's maximum function duration depends on plan and compute settings.

The visual direction follows the [TDC 2026 website](https://2026.trondheimdc.no/#coc): near-black surfaces, mint accents, a yellow highlight, and readable type.
