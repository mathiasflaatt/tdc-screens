# Deployment and TV setup

## Architecture: no database

The app is a static Vite single-page app plus one serverless function, `api/schedule.js`.

- Sessionize is the only source of truth. `/api/schedule` fetches the fixed TDC 2026 GridSmart, Sessions and Speakers feeds on every request and returns a validated snapshot with its `fetchedAt` time. It never accepts an upstream URL from the request.
- There is no database, key-value store, cron job, environment variable or paid add-on. The function sends `Cache-Control: no-store` and `Vercel-Cache-Control: no-store`, so there is no server cache layered over the five-minute browser polling.
- Each TV keeps its last valid schedule in its own browser `localStorage`. During an outage the screen keeps showing that schedule with a stale-data marker and recovers on the next successful five-minute refresh without a reload.

## Vercel project

The repository is already imported into a Vercel project and deployed. All build settings are in the repository: `vercel.json` sets `npm run build` as the build command, `dist` as the output directory and the SPA rewrites. Vercel discovers `api/schedule.js` as a Node.js function at `/api/schedule`. The project needs no environment variables, database or integrations. Keep the dashboard's build, output and root-directory overrides empty so that `vercel.json` stays authoritative.

**Plan eligibility.** The Hobby plan is limited to personal, non-commercial use. A conference deployment may not qualify. Before the event, check the current [Hobby plan terms](https://vercel.com/docs/plans/hobby), the [Fair Use Guidelines](https://vercel.com/docs/limits/fair-use-guidelines) and the [Function limits](https://vercel.com/docs/functions/limitations) against the account and its use. Move the project to Pro if Hobby does not apply.

**Redeploying.** With the project connected through Vercel's Git integration (the default for an imported repository), Vercel builds a preview deployment for every pushed branch or pull request and a production deployment for every merge to `main`. To release:

1. Run the checks under [Verifying a release](#verifying-a-release) locally.
2. Merge to `main` and wait for the production deployment to finish in the Vercel dashboard. Optionally, check the pull request's preview URL first.
3. On the production URL, open `/`, `/common` and one or two `/room/<id>` screens, reload each once, and run `npm run smoke:sessionize -- https://<production-domain>`.
4. Running TVs pick up the new build on their next reload. The schedule itself does not need a redeploy, because Sessionize changes reach the screens within five minutes. To roll back, promote the previous production deployment in the Vercel dashboard ("Instant Rollback").

### Routing

Vercel serves static files first, then functions, then the rewrites in `vercel.json`. The rewrites send `/room/<id>`, `/common` and `/common/...` to `index.html`, so these URLs work as direct links and after a reload. Query strings such as `?test=true&at=10:35` stay in the browser URL and are read by the app. `/api/schedule` and hashed files under `/assets/` are never rewritten. Other paths return Vercel's 404.

### Function usage

Every open screen calls `/api/schedule` on load and every five minutes, and each call makes three requests to Sessionize. Estimate about 12 function invocations per screen per hour, plus reloads and retries. For example, 10 screens running for 12 hours make about 1,440 invocations. Each upstream request times out after 10 seconds; the maximum function duration depends on the plan.

## Verifying a release

```sh
npm run typecheck
npm test                  # behavior tests (dev server) + production routing tests
npm run smoke:sessionize  # opt-in: live Sessionize feeds through the /api/schedule handler
```

- `npm test` runs two Playwright projects. `behavior` uses the Vite dev server. `production` runs `vite build` and serves `dist` with `scripts/serve-production.mjs`, which applies the same order as Vercel: static files, `/api/schedule`, then `vercel.json` rewrites. It has no SPA fallback beyond those rewrites, so a missing rewrite fails a test. Both projects stub the schedule in the browser and do not contact Sessionize. Run only the production routing tests with `npm run test:production`.
- `npm run preview:production` builds and serves the production output at `http://127.0.0.1:4174`, using the live Sessionize feed.
- `npm run smoke:sessionize` calls the real Sessionize feeds through the `/api/schedule` handler, validates the snapshot and lists the room URLs. After deployment, check the deployed function with `npm run smoke:sessionize -- https://<deployment>.vercel.app`. This check needs network access and is not part of `npm test`.

## TV and kiosk browser setup

Use one permanent URL per TV: `/room/<sessionize-room-id>` for the portrait screens outside rooms and `/common` for landscape common-area screens. The home page lists every room URL. Never leave `?test=true` simulation links on a live screen.

**Browser.** Use a current Chromium-based browser in kiosk mode, for example:

```sh
chromium --kiosk --noerrdialogs --disable-session-crashed-bubble --disable-translate \
  --overscroll-history-navigation=0 --check-for-update-interval=31536000 \
  https://<deployment>.vercel.app/room/<id>
```

- Do not use incognito or guest profiles. The browser profile must keep `localStorage`, so the last schedule survives reloads and outages.
- Kiosk or full-screen mode (F11) hides browser chrome. The layouts fit the viewport without scrolling, so no scrollbars should appear. If a scrollbar appears, the CSS viewport is smaller than the target size (see below).
- Disable pinch zoom and browser zoom shortcuts where the kiosk software allows it. Keep browser zoom at 100%.
- Start the browser automatically at login, or use the TV's or media player's kiosk or signage mode. Test that the browser restarts after a power cut.

**No sleep.** Turn off the TV's eco, auto power-off and no-signal standby settings. On the connected computer or stick, disable screen saver, display sleep and system sleep. Chrome OS kiosk and most signage players have a "keep display on" policy. Disable scheduled OS updates and restarts during the conference.

**Resolution and orientation.**

- Room screens target a 1080 × 1920 portrait viewport. Common screens target a 1920 × 1080 landscape viewport.
- For portrait TVs, rotate the output in the operating system's display settings. Do not rotate it in CSS or with TV picture settings.
- On 3840 × 2160 (4K) panels, set OS display scaling to 200%. The CSS viewport then stays 1920 × 1080 (or 1080 × 1920) while text renders at full 4K sharpness. At 100% scaling the viewport is 3840 × 2160, which is a different layout size.
- Confirm the viewport on each TV once by opening the browser console or a bookmarklet and checking `innerWidth` × `innerHeight`.
- Turn off TV overscan (often called "Just Scan", "Screen Fit" or "1:1 pixel mapping") so that the edges are not cropped.

**Network.** Screens need outbound HTTPS to the Vercel deployment only. The browser does not contact Sessionize directly. Speaker portraits load from Sessionize's image CDN; a missing portrait does not break the layout.
