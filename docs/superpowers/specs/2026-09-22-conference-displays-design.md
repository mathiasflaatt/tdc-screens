## Problem Statement

Conference attendees need to see what is happening in each room and what comes next without opening a schedule on their phones. TVs outside rooms need portrait schedules, while common-area TVs need a landscape overview that helps attendees choose their next talk during breaks. Organizers need changes in Sessionize to reach the screens automatically and need to preview the entire conference day before the event.

## Solution

Build a TDC-branded conference display website with one permanent URL per room and one common-area URL. Room displays highlight the current session and upcoming room agenda. During breaks they feature the next session. Common-area displays show current sessions across rooms and emphasize upcoming sessions during breaks. Fetch program changes on startup and every five minutes, independently of the clock that drives display transitions. Include an explicit simulation mode for exploring the conference day. Target Vercel hosting, with the user's preferred free plan subject to eligibility verification.

## User Stories

1. As an attendee, I want to identify the room from its screen, so that I know I am at the correct venue.
2. As an attendee, I want a portrait schedule outside each room, so that the display fits the installed TV.
3. As an attendee, I want the current session highlighted, so that I can see what is happening now.
4. As an attendee, I want the session title and speakers displayed, so that I can recognize the talk.
5. As an attendee, I want scheduled start and end times, so that I can plan my attendance.
6. As an attendee, I want the upcoming room agenda, so that I can plan later sessions.
7. As an attendee, I want the next session featured during a break, so that I can choose where to go.
8. As an attendee, I want the next session's start time during breaks, so that I know when to return.
9. As an attendee, I want a landscape overview in common areas, so that I can compare talks across rooms.
10. As an attendee, I want every overview card to identify its room, so that I can find the talk.
11. As an attendee, I want current sessions shown in common areas during talks, so that I can see the ongoing program.
12. As an attendee, I want upcoming talks emphasized in common areas during breaks, so that I can choose my next session.
13. As an attendee, I want clear lunch and break status, so that I understand gaps in the program.
14. As an attendee, I want plenary notices to name their actual room, so that I do not mistake them for local sessions.
15. As an attendee, I want a local conference clock, so that times are consistent across screens.
16. As an attendee, I want readable text from a distance, so that I can use the schedule while walking past.
17. As an attendee, I want updated titles, speakers, rooms, and times, so that I do not follow an obsolete program.
18. As an attendee, I want an explicit end-of-program message, so that an empty screen does not confuse me.
19. As an attendee arriving early, I want the first sessions and their date shown, so that I know when the program starts.
20. As an organizer, I want one permanent URL per room, so that each TV can be configured once.
21. As an organizer, I want one common-area URL, so that multiple common-area TVs can share the same view.
22. As an organizer, I want a screen-selection page, so that I can open the correct display easily.
23. As an organizer, I want Sessionize to remain the source of truth, so that I do not maintain a second program.
24. As an organizer, I want refreshes every five minutes, so that program changes appear automatically.
25. As an organizer, I want clock-driven transitions between refreshes, so that session highlighting changes on time.
26. As an organizer, I want the last successful schedule retained during outages, so that screens remain useful.
27. As an organizer, I want stale-data and initial loading failures indicated, so that I can spot connectivity problems.
28. As an organizer, I want automatic recovery after a failed refresh, so that I do not need to reload every TV.
29. As an organizer, I want the TDC website's visual style, so that the displays belong to the conference identity.
30. As an organizer, I want no countdown to the end of a session, so that the display focuses on attendee information.
31. As an organizer, I want to choose a simulated date and time, so that I can inspect any point in the day.
32. As an organizer, I want to scrub through the day and jump between transitions, so that I can inspect breaks quickly.
33. As an organizer, I want to pause and accelerate simulation, so that I can verify a full day efficiently.
34. As an organizer, I want simulation clearly labeled, so that I cannot confuse it with a live display.
35. As an organizer, I want to return to live time in one action, so that a preview can become a real display.
36. As an organizer, I want reproducible simulation links for both layouts, so that I can compare their behavior.
37. As an organizer, I want missing portraits or long titles handled gracefully, so that real program content stays readable.
38. As an organizer, I want deployment on Vercel without a database or paid add-ons, so that hosting remains simple and inexpensive.

## Implementation Decisions

- This is a new application. React, TypeScript, and Vite are the proposed implementation baseline; no existing application conventions constrain the choice.
- Separate the feed adapter, schedule selection with an explicit clock input, and rendering responsibilities. These are internal boundaries, not a requirement for separate test suites.
- Provide a screen selector, a room display addressed by stable Sessionize room ID, and a common-area display. Direct links and reloads must work on Vercel.
- Optimize room displays for 1080 × 1920 portrait and common displays for 1920 × 1080 landscape. Keep current/next content prominent and show the nearest upcoming room entries without requiring attendees to scroll. Derive the room list from data; the currently observed program has six talk rooms.
- Follow the reference site's near-black background, mint accents, yellow highlights, strong typography, and restrained pixel-duck branding: https://2026.trondheimdc.no/#hero.
- Read the supplied public feeds: https://sessionize.com/api/v2/1diujeu9/view/Sessions?under=True, https://sessionize.com/api/v2/1diujeu9/view/Speakers?under=True, and https://sessionize.com/api/v2/1diujeu9/view/GridSmart?under=True.
- Use GridSmart as the scheduling authority. Enrich sessions and speakers from the other feeds, join by stable IDs, and deduplicate shared sessions. Missing enrichment must not hide valid schedule entries.
- Provide a same-origin Vercel endpoint for the fixed conference feeds. It must not accept arbitrary upstream URLs. Return a validated schedule snapshot with its successful fetch time, so displays can distinguish fresh and stale data.
- Fetch on startup and every 300 seconds of real elapsed time, including during simulation. Apply changes without a page reload. Avoid layering a five-minute server cache over five-minute browser polling; an expired server snapshot must be refreshed before reporting a successful fresh response. Do not claim data is fresh when serving a fallback.
- Retain the last validated schedule in the browser, including across reloads, with a discreet stale-data indicator after a failed refresh. Retry on subsequent refreshes with bounded request timeouts. Without usable data, show a clear loading/error state. Handle unavailable local storage without preventing rendering.
- Interpret unzoned feed timestamps in Europe/Oslo, independently of the device timezone. Use start-inclusive/end-exclusive intervals and re-evaluate display state every second. Do not tie schedule transitions to API polling.
- During a talk, feature the current room session. During a room gap, feature its next session with its actual start time. Shared breaks and lunch provide context. An evening party is not a break merely because it is a service session.
- Common-area cards select current or next sessions independently by room, including unequal start times. Shared plenary content identifies its actual venue and is not duplicated as though occurring in every room. Local current sessions take priority over shared notices.
- Before the event, show the first upcoming sessions with their date. After a room's last session, show that it has no further sessions. After the whole program, show an end-of-program state. Unknown room URLs show a useful room-selection error.
- Display scheduled time ranges but no session-end countdown. A next-start countdown during breaks is retained from the proposed design; it must not become an end-of-talk timer.
- Simulation is explicitly enabled through a URL parameter and visibly labeled. Provide a time input, day scrubber, play/pause, 1×/10×/60× playback, previous/next transition, and return-to-live action. Normal live display URLs omit simulation controls.
- Simulation changes only the clock used for display selection, never Sessionize data. Preserve the chosen simulation position when switching views and allow reproducible preview links. Returning to live clears simulation state.
- Target Vercel with static assets and a small on-demand API endpoint; no database, login, scheduled background job, or paid external service is required by the design. Free-plan eligibility remains a deployment constraint, not a claim that this conference is eligible.

## Testing Decisions

- Agreed primary testing boundary: the rendered application in a browser, using controlled Sessionize HTTP responses and a controllable clock. The user confirmed this boundary. Prefer this single high-level boundary over tests coupled to component internals.
- A good test asserts attendee-visible output and observable interactions: featured title, room, time, status, navigation, updated content, and simulation behavior. Avoid assertions about internal state, hook calls, class names, or module organization.
- Cover the feed adapter, schedule selection, clock, display rendering, simulation, and recovery through their combined public behavior. Exercise the same-origin endpoint at its HTTP boundary only where browser tests cannot cover upstream failures or freshness semantics.
- There is no existing test framework or test prior art in the repository. Use browser integration tests for the new application; do not invent existing conventions.
- Verify exact session start/end boundaries, breaks, lunch, plenaries, overlapping shared notices, unequal room start times, empty rooms, before/after-event states, and an unknown room link.
- Verify Oslo interpretation while the browser uses another timezone. Test simulation seek, pause, speed changes, boundary jumps, preserved view-switch state, and restoration of live time.
- Verify startup fetch and a real-time five-minute refresh that changes title, time, speaker, and room placement. Confirm removed/cancelled feed entries disappear rather than persist through stale merging. Advancing simulated time must not accelerate network polling.
- Verify failed refresh retains the prior schedule, malformed responses cannot replace it, first-load failure is understandable, cache recovery survives reload, and later successful refresh restores normal status. Check missing portraits and unavailable enrichment.
- Inspect portrait and landscape layouts using real long session titles and multiple speakers. Ensure featured content remains readable without clipping and that all six common-area room cards fit at target size.
- Verify the production build and Vercel direct-link routing, and perform a smoke check against the real Sessionize feeds. Keep deterministic tests independent of live API availability.

## Out of Scope

- Editing the conference program, speaker records, or room assignments in this application.
- Attendee accounts, favorites, ticketing, bookings, analytics, notifications, or a CMS.
- Countdown timers to session ends.
- Remote TV device management, kiosk provisioning, and control of operating-system sleep settings.
- Multi-conference administration or an arbitrary-URL data proxy.
- Databases, paid services, and automatic upgrades to a paid hosting plan.
- Video streaming, presentation slides, advertisements, and sponsor rotations.
- Publishing the live website as part of this specification-writing task. Implementation should deliver Vercel deployment configuration and instructions.

## Further Notes

- Sessionize data was inspected on 2026-09-22. GridSmart currently describes 2026-10-19 and includes timed rooms, shared breaks, lunch, and plenary flags; Speakers includes portraits. Treat this as a sample, not immutable schedule content.
- The user's latest refresh requirement is five minutes, superseding the earlier one-minute proposal.
- The user's portrait room and landscape common-area requirements supersede the initial all-landscape assumption.
- The hosting target is Vercel, superseding the earlier provider-neutral design. Vercel describes Hobby as personal, non-commercial hosting: https://vercel.com/docs/plans/hobby and https://vercel.com/docs/limits/fair-use-guidelines. Verify eligibility before deployment; do not assume low traffic alone makes the project eligible.
- This specification consolidates the conversation and replaces the earlier design document. Core requirements come from the user; specific framework, endpoint, caching, and simulation-control details are proposed implementation choices.
