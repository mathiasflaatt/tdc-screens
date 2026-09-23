import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { SimulationControls } from './components/SimulationControls';
import { simulationHref, useSimulationClock, type SimulationClock } from './hooks/useSimulationClock';
import {
  formatOsloDate,
  formatOsloTime,
  formatSessionRange,
  formatSessionStart,
  parseSessionInstant,
  getRoomDisplayState,
  getUpcomingRoomSessions,
  getCommonDisplayState,
  isScheduleSnapshot,
  type CommonRoomDisplay,
  type DisplayRoom,
  type DisplaySession,
  type RoomContext,
  type ScheduleSnapshot,
} from './lib/schedule';
import './styles.css';

const SCHEDULE_URL = '/api/schedule';
const CACHE_KEY = 'tdc-2026-schedule-v1';
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;
type ScheduleState = {
  snapshot: ScheduleSnapshot | null;
  loading: boolean;
  stale: boolean;
  error: boolean;
};

function readCachedSchedule(): ScheduleSnapshot | null {
  try {
    const saved = window.localStorage.getItem(CACHE_KEY);
    if (!saved) return null;
    const parsed: unknown = JSON.parse(saved);
    return isScheduleSnapshot(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function useSchedule(): ScheduleState {
  const initial = useRef<ScheduleSnapshot | null>(null);
  if (initial.current === null) initial.current = readCachedSchedule();

  const [state, setState] = useState<ScheduleState>(() => ({
    snapshot: initial.current,
    loading: initial.current === null,
    stale: initial.current !== null,
    error: false,
  }));
  const latestSnapshot = useRef(state.snapshot);

  useEffect(() => {
    let isMounted = true;
    let refreshing = false;

    const refresh = async () => {
      if (refreshing) return;
      refreshing = true;
      try {
        const response = await fetch(SCHEDULE_URL, {
          cache: 'no-store',
          signal: AbortSignal.timeout(10_000),
        });
        if (!response.ok) throw new Error('Schedule request failed');
        const result: unknown = await response.json();
        if (!isScheduleSnapshot(result)) throw new Error('Schedule response was invalid');

        latestSnapshot.current = result;
        try {
          window.localStorage.setItem(CACHE_KEY, JSON.stringify(result));
        } catch {
          // Storage can be disabled on shared TVs; the in-memory schedule still works.
        }
        if (isMounted) setState({ snapshot: result, loading: false, stale: false, error: false });
      } catch {
        const saved = latestSnapshot.current ?? readCachedSchedule();
        if (saved) latestSnapshot.current = saved;
        if (isMounted) {
          setState({ snapshot: saved, loading: false, stale: saved !== null, error: saved === null });
        }
      } finally {
        refreshing = false;
      }
    };

    void refresh();
    const timer = window.setInterval(() => void refresh(), REFRESH_INTERVAL_MS);
    return () => {
      isMounted = false;
      window.clearInterval(timer);
    };
  }, []);

  return state;
}

function BrandMark({ simulation }: { simulation?: SimulationClock } = {}) {
  return (
    <a className="brand-mark" href={simulation ? simulationHref('/', simulation) : '/'} aria-label="TDC 2026 conference displays">
      <span>TDC</span><i aria-hidden="true" />
    </a>
  );
}

function ScheduleStateMessage({ state, simulation }: { state: ScheduleState; simulation: SimulationClock }) {
  if (state.loading) {
    return (
      <main className="state-page" aria-live="polite">
        <BrandMark simulation={simulation} />
        <div className="state-message">
          <p className="eyebrow">TDC 2026</p>
          <h1>Loading the schedule</h1>
          <p>Connecting to the live conference programme.</p>
        </div>
      </main>
    );
  }

  if (state.error || !state.snapshot) {
    return (
      <main className="state-page" role="alert">
        <BrandMark simulation={simulation} />
        <div className="state-message">
          <p className="eyebrow">TDC 2026</p>
          <h1>Schedule unavailable</h1>
          <p>We couldn’t load the conference programme. Trying again automatically.</p>
        </div>
      </main>
    );
  }

  return null;
}

function StaleNotice() {
  return <p className="stale-notice" role="status">Schedule may be out of date</p>;
}

function ScreenSelector({
  rooms,
  stale,
  snapshot,
  simulation,
}: {
  rooms: DisplayRoom[];
  stale: boolean;
  snapshot: ScheduleSnapshot;
  simulation: SimulationClock;
}) {
  return (
    <main className="selector-page">
      <header className="selector-header">
        <BrandMark simulation={simulation} />
        <div className="selector-intro">
          <p className="eyebrow">Trondheim Developer Conference · 19 October 2026</p>
          <h1>Choose a screen</h1>
          <p>Open a room display for the TV outside that room.</p>
        </div>
      </header>
      {stale && <StaleNotice />}
      <SimulationControls snapshot={snapshot} simulation={simulation} />
      {rooms.length > 0 ? (
        <nav aria-label="Room screens">
          <ul className="room-list">
            {rooms.map((room, index) => (
              <li key={room.id}>
                <a className="room-link" href={simulationHref(`/room/${encodeURIComponent(room.id)}`, simulation)}>
                  <span className="room-number">{String(index + 1).padStart(2, '0')}</span>
                  <span className="room-link-name">{room.name}</span>
                  <span className="room-link-arrow" aria-hidden="true">↗</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      ) : (
        <p className="empty-rooms">No room screens are available yet.</p>
      )}
      <nav className="common-screen-link" aria-label="Other screens">
        <a className="room-link" href={simulationHref('/common', simulation)}>
          <span className="room-number">↗</span>
          <span className="room-link-name">Common-area display</span>
          <span className="room-link-arrow" aria-hidden="true">↗</span>
        </a>
      </nav>
      <footer className="page-footer">
        <span>Trondheim · Europe/Oslo</span>
        <span>One permanent address for each room</span>
      </footer>
    </main>
  );
}

function Speaker({ speaker }: { speaker: DisplaySession['speakers'][number] }) {
  const initials = speaker.name.split(/\s+/).map((name) => name[0]).slice(0, 2).join('').toLocaleUpperCase();
  return (
    <div className="speaker-person">
      {speaker.portraitUrl ? (
        <img className="speaker-portrait" src={speaker.portraitUrl} alt={`${speaker.name} portrait`} />
      ) : (
        <span className="speaker-portrait speaker-portrait--fallback" aria-hidden="true">{initials}</span>
      )}
      <span className="speaker-name">{speaker.name}</span>
    </div>
  );
}

function SessionCard({ session, phase }: { session: DisplaySession; phase: 'live' | 'service' | 'before' | 'between' }) {
  const status = phase === 'live'
    ? 'Happening now'
    : phase === 'service'
      ? 'On the programme'
      : phase === 'before'
        ? 'Starts later'
        : 'Between sessions';

  return (
    <article className={`session-card session-card--${phase}`} aria-live="polite">
      <p className="session-status"><span className="status-dot" />{status}</p>
      <p className="session-kicker">{phase === 'live' ? 'NOW IN THIS ROOM' : phase === 'service' ? 'ROOM NOTICE' : 'COMING UP IN THIS ROOM'}</p>
      <h2>{session.title}</h2>
      {phase === 'before' && <p className="session-date">{formatOsloDate(parseSessionInstant(session.startsAt) ?? Date.now())}</p>}
      {session.speakers.length > 0 && (
        <div className="session-speakers" aria-label="Speakers">
          {session.speakers.map((speaker) => <Speaker key={speaker.id} speaker={speaker} />)}
        </div>
      )}
      <div className="session-time">
        <span className="session-time-label">SCHEDULED TIME</span>
        <time>{formatSessionRange(session)}</time>
      </div>
    </article>
  );
}

function ContextNotice({ context }: { context: RoomContext }) {
  if (context.type === 'plenary') {
    return <p className="room-context room-context--plenary" role="status">Plenary session in <strong>{context.room}</strong></p>;
  }
  return (
    <p className={`room-context room-context--${context.type}`} role="status">
      {context.type === 'lunch' ? 'Shared lunch' : 'Shared break'}
    </p>
  );
}

function EmptyRoomCard({ phase }: { phase: 'ended' | 'empty' | 'complete' }) {
  const heading = phase === 'complete'
    ? 'Programme complete'
    : phase === 'ended'
      ? 'No more sessions today'
      : 'No sessions scheduled';
  const detail = phase === 'complete'
    ? 'The conference programme has ended.'
    : phase === 'ended'
      ? 'This room has no further sessions today.'
      : 'Check another room for the next talk.';

  return (
    <article className="session-card empty-session" aria-live="polite">
      <p className="session-kicker">ROOM UPDATE</p>
      <h2>{heading}</h2>
      <p className="session-speakers">{detail}</p>
    </article>
  );
}

function UpcomingAgenda({ sessions }: { sessions: DisplaySession[] }) {
  if (sessions.length === 0) return null;
  return (
    <section className="upcoming-agenda" aria-label="Upcoming room agenda">
      <h2>Coming up in this room</h2>
      <ol>
        {sessions.map((session) => (
          <li key={session.id}>
            <time>{formatSessionRange(session)}</time>
            <span>{session.title}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function RoomDisplay({
  snapshot,
  room,
  stale,
  simulation,
}: {
  snapshot: ScheduleSnapshot;
  room: DisplayRoom;
  stale: boolean;
  simulation: SimulationClock;
}) {
  const now = simulation.now;
  const display = getRoomDisplayState(snapshot, room.id, now);
  const sessionPhase = display.phase === 'empty' || display.phase === 'ended' || display.phase === 'complete'
    ? null
    : display.phase;
  const upcoming = getUpcomingRoomSessions(snapshot, room.id, now, display.session);
  const breakContext = display.context?.type === 'break' || display.context?.type === 'lunch';

  return (
    <main className="display-page" aria-label={`Room display for ${room.name}`}>
      <header className="display-header">
        <BrandMark simulation={simulation} />
        <div className="display-room-name">
          <p className="eyebrow">ROOM DISPLAY</p>
          <h1>{room.name}</h1>
          <p className="display-date">{formatOsloDate(now)}</p>
        </div>
        <div className="display-clock-wrap">
          <time className="display-clock" aria-label="Oslo local time" dateTime={new Date(now).toISOString()}>
            {formatOsloTime(now)}
          </time>
          <span className="clock-caption">{simulation.active ? 'SIMULATED TIME · TRONDHEIM' : 'LOCAL TIME · TRONDHEIM'}</span>
        </div>
        {stale && <StaleNotice />}
      </header>

      <section className="display-content" aria-label={`Live schedule for ${room.name}`}>
        <div className="featured-content">
          {display.context && <ContextNotice context={display.context} />}
          {display.session && sessionPhase
            ? <SessionCard session={display.session} phase={sessionPhase} />
            : <EmptyRoomCard phase={display.phase === 'empty' ? 'empty' : display.phase === 'complete' ? 'complete' : 'ended'} />}
          {breakContext && display.session && (
            <p className="next-start">Next talk starts at {formatSessionStart(display.session)}</p>
          )}
        </div>
        <UpcomingAgenda sessions={upcoming} />
      </section>

      <SimulationControls
        snapshot={snapshot}
        simulation={simulation}
        switchHref="/common"
        switchLabel="Common-area view"
      />

      <footer className="display-footer">
        <a href={simulationHref('/', simulation)}>All room screens</a>
        <a href={simulationHref('/common', simulation)}>Common-area display</a>
        <span className="footer-brand">TDC 2026</span>
        <span>Europe/Oslo</span>
      </footer>
    </main>
  );
}

function CommonRoomCard({ display, index }: { display: CommonRoomDisplay; index: number }) {
  const { phase, room, session } = display;
  const status = phase === 'live'
    ? 'Happening now'
    : phase === 'before'
      ? 'Starts later'
      : phase === 'break'
        ? 'Break · next talk'
        : phase === 'lunch'
          ? 'Lunch · next talk'
          : phase === 'next'
            ? 'Next talk'
            : phase === 'empty'
              ? 'No talks scheduled'
              : 'No more talks today';
  const roomHeadingId = `common-room-${index}`;

  return (
    <article className={`common-card common-card--${phase}`} aria-labelledby={roomHeadingId}>
      <header className="common-card-header">
        <h2 id={roomHeadingId}>{room.name}</h2>
        <p className="common-card-status">{status}</p>
      </header>
      {session ? (
        <div className="common-card-session">
          <h3>{session.title}</h3>
          {phase === 'before' && (
            <p className="common-card-date">
              {formatOsloDate(parseSessionInstant(session.startsAt) ?? Date.now())}
            </p>
          )}
          <div className="common-card-time">
            <span>{phase === 'live' ? 'SCHEDULED TIME' : 'STARTS AT'}</span>
            <time dateTime={session.startsAt}>
              {phase === 'live' ? formatSessionRange(session) : formatSessionStart(session)}
            </time>
          </div>
        </div>
      ) : (
        <p className="common-card-empty">
          {phase === 'empty' ? 'No talks are scheduled in this room.' : 'This room has no further talks today.'}
        </p>
      )}
    </article>
  );
}

function CommonDisplay({
  snapshot,
  stale,
  simulation,
}: {
  snapshot: ScheduleSnapshot;
  stale: boolean;
  simulation: SimulationClock;
}) {
  const now = simulation.now;
  const display = getCommonDisplayState(snapshot, now);

  if (display.phase === 'complete') {
    return (
      <main className="state-page simulation-state" aria-live="polite">
        <BrandMark simulation={simulation} />
        <div className="state-message">
          <p className="eyebrow">TDC 2026 · COMMON AREAS</p>
          <h1>Programme complete</h1>
          <p>The conference programme has ended for today.</p>
        </div>
        <SimulationControls snapshot={snapshot} simulation={simulation} switchHref="/" switchLabel="Choose a room" />
      </main>
    );
  }

  if (display.phase === 'empty') {
    return (
      <main className="state-page simulation-state" aria-live="polite">
        <BrandMark simulation={simulation} />
        <div className="state-message">
          <p className="eyebrow">TDC 2026 · COMMON AREAS</p>
          <h1>No talk rooms scheduled</h1>
          <p>There are no rooms with talks in the current conference programme.</p>
        </div>
        <SimulationControls snapshot={snapshot} simulation={simulation} switchHref="/" switchLabel="Choose a room" />
      </main>
    );
  }

  return (
    <main className="common-display" aria-label="Common-area conference overview">
      <header className="common-header">
        <BrandMark simulation={simulation} />
        <div className="common-heading">
          <p className="eyebrow">TDC 2026 · COMMON AREA</p>
          <h1>Common Areas</h1>
          <p className="common-date">{formatOsloDate(now)}</p>
        </div>
        <div className="common-clock-wrap">
          <time className="common-clock" aria-label="Oslo local time" dateTime={new Date(now).toISOString()}>
            {formatOsloTime(now)}
          </time>
          <span className="clock-caption">{simulation.active ? 'SIMULATED TIME · TRONDHEIM' : 'LOCAL TIME · TRONDHEIM'}</span>
        </div>
        {stale && <StaleNotice />}
      </header>

      <section className="common-content" aria-label="Talk rooms">
        {display.plenary && (
          <aside className="common-plenary" role="status" aria-label="Shared plenary">
            <span>SHARED PLENARY</span>
            <strong>{display.plenary.title}</strong>
            <p>Now in <b>{display.plenary.room}</b></p>
          </aside>
        )}
        <div className="common-grid">
          {display.rooms.map((room, index) => (
            <CommonRoomCard key={room.room.id} display={room} index={index} />
          ))}
        </div>
      </section>

      <SimulationControls snapshot={snapshot} simulation={simulation} switchHref="/" switchLabel="Choose a room" />

      <footer className="common-footer">
        <a href={simulationHref('/', simulation)}>All room screens</a>
        <span className="footer-brand">TDC 2026</span>
        <span>Europe/Oslo</span>
      </footer>
    </main>
  );
}

function UnknownRoom({ roomId, simulation }: { roomId: string; simulation: SimulationClock }) {
  return (
    <main className="state-page">
      <BrandMark simulation={simulation} />
      <div className="state-message">
        <p className="eyebrow">ROOM {roomId}</p>
        <h1>Room not found</h1>
        <p>This room is not in the current conference schedule.</p>
        <a className="back-link" href={simulationHref('/', simulation)}>Choose a screen <span aria-hidden="true">↗</span></a>
      </div>
    </main>
  );
}

function App() {
  const state = useSchedule();
  const simulation = useSimulationClock(state.snapshot);
  const route = /^\/room\/([^/]+)\/?$/.exec(window.location.pathname);
  const commonRoute = /^\/common\/?$/.test(window.location.pathname);

  if (!state.snapshot || state.loading || state.error) return <ScheduleStateMessage state={state} simulation={simulation} />;
  if (commonRoute) return <CommonDisplay snapshot={state.snapshot} stale={state.stale} simulation={simulation} />;
  if (!route) return <ScreenSelector rooms={state.snapshot.rooms} stale={state.stale} snapshot={state.snapshot} simulation={simulation} />;

  let roomId = route[1];
  try {
    roomId = decodeURIComponent(roomId);
  } catch {
    return <UnknownRoom roomId={route[1]} simulation={simulation} />;
  }
  const room = state.snapshot.rooms.find((candidate) => candidate.id === roomId);
  return room
    ? <RoomDisplay snapshot={state.snapshot} room={room} stale={state.stale} simulation={simulation} />
    : <UnknownRoom roomId={roomId} simulation={simulation} />;
}

createRoot(document.getElementById('root')!).render(<App />);
