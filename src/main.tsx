import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  formatOsloDate,
  formatOsloTime,
  formatSessionRange,
  getRoomDisplayState,
  isScheduleSnapshot,
  type DisplayRoom,
  type DisplaySession,
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

function useLocalClock(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

function BrandMark() {
  return (
    <a className="brand-mark" href="/" aria-label="TDC 2026 conference displays">
      <span>TDC</span><i aria-hidden="true" />
    </a>
  );
}

function ScheduleStateMessage({ state }: { state: ScheduleState }) {
  if (state.loading) {
    return (
      <main className="state-page" aria-live="polite">
        <BrandMark />
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
        <BrandMark />
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

function ScreenSelector({ rooms, stale }: { rooms: DisplayRoom[]; stale: boolean }) {
  return (
    <main className="selector-page">
      <header className="selector-header">
        <BrandMark />
        <div className="selector-intro">
          <p className="eyebrow">Trondheim Developer Conference · 19 October 2026</p>
          <h1>Choose a screen</h1>
          <p>Open a room display for the TV outside that room.</p>
        </div>
      </header>
      {stale && <StaleNotice />}
      {rooms.length > 0 ? (
        <nav aria-label="Room screens">
          <ul className="room-list">
            {rooms.map((room, index) => (
              <li key={room.id}>
                <a className="room-link" href={`/room/${encodeURIComponent(room.id)}`}>
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
      <footer className="page-footer">
        <span>Trondheim · Europe/Oslo</span>
        <span>One permanent address for each room</span>
      </footer>
    </main>
  );
}

function SessionCard({ session, phase }: { session: DisplaySession; phase: 'live' | 'service' | 'before' | 'between' }) {
  const status = phase === 'live'
    ? 'Happening now'
    : phase === 'service'
      ? 'On the programme'
      : phase === 'before'
        ? 'Starts later'
        : 'Up next';

  return (
    <article className={`session-card session-card--${phase}`} aria-live="polite">
      <p className="session-status"><span className="status-dot" />{status}</p>
      <p className="session-kicker">{phase === 'live' ? 'NOW IN THIS ROOM' : phase === 'service' ? 'ROOM NOTICE' : 'COMING UP IN THIS ROOM'}</p>
      <h2>{session.title}</h2>
      {session.speakers.length > 0 && (
        <p className="session-speakers">{session.speakers.map((speaker) => speaker.name).join(' · ')}</p>
      )}
      <div className="session-time">
        <span className="session-time-label">SCHEDULED TIME</span>
        <time>{formatSessionRange(session)}</time>
      </div>
    </article>
  );
}

function EmptyRoomCard({ phase }: { phase: 'ended' | 'empty' }) {
  return (
    <article className="session-card empty-session" aria-live="polite">
      <p className="session-kicker">ROOM UPDATE</p>
      <h2>{phase === 'ended' ? 'No more sessions today' : 'No sessions scheduled'}</h2>
      <p className="session-speakers">Check another room for the next talk.</p>
    </article>
  );
}

function RoomDisplay({ snapshot, room, stale }: { snapshot: ScheduleSnapshot; room: DisplayRoom; stale: boolean }) {
  const now = useLocalClock();
  const display = getRoomDisplayState(snapshot, room.id, now);
  const sessionPhase = display.phase === 'empty' || display.phase === 'ended' ? null : display.phase;

  return (
    <main className="display-page">
      <header className="display-header">
        <BrandMark />
        <div className="display-room-name">
          <p className="eyebrow">ROOM DISPLAY</p>
          <h1>{room.name}</h1>
          <p className="display-date">{formatOsloDate(now)}</p>
        </div>
        <div className="display-clock-wrap">
          <time className="display-clock" aria-label="Oslo local time" dateTime={new Date(now).toISOString()}>
            {formatOsloTime(now)}
          </time>
          <span className="clock-caption">LOCAL TIME · TRONDHEIM</span>
        </div>
      </header>

      {stale && <StaleNotice />}

      <section className="display-content" aria-label={`Live schedule for ${room.name}`}>
        {display.session && sessionPhase
          ? <SessionCard session={display.session} phase={sessionPhase} />
          : <EmptyRoomCard phase={display.phase === 'empty' ? 'empty' : 'ended'} />}
      </section>

      <footer className="display-footer">
        <a href="/">All room screens</a>
        <span className="footer-brand">TDC 2026</span>
        <span>Europe/Oslo</span>
      </footer>
    </main>
  );
}

function UnknownRoom({ roomId }: { roomId: string }) {
  return (
    <main className="state-page">
      <BrandMark />
      <div className="state-message">
        <p className="eyebrow">ROOM {roomId}</p>
        <h1>Room not found</h1>
        <p>This room is not in the current conference schedule.</p>
        <a className="back-link" href="/">Choose a screen <span aria-hidden="true">↗</span></a>
      </div>
    </main>
  );
}

function App() {
  const state = useSchedule();
  const route = /^\/room\/([^/]+)\/?$/.exec(window.location.pathname);

  if (!state.snapshot || state.loading || state.error) return <ScheduleStateMessage state={state} />;
  if (!route) return <ScreenSelector rooms={state.snapshot.rooms} stale={state.stale} />;

  let roomId = route[1];
  try {
    roomId = decodeURIComponent(roomId);
  } catch {
    return <UnknownRoom roomId={route[1]} />;
  }
  const room = state.snapshot.rooms.find((candidate) => candidate.id === roomId);
  return room ? <RoomDisplay snapshot={state.snapshot} room={room} stale={state.stale} /> : <UnknownRoom roomId={roomId} />;
}

createRoot(document.getElementById('root')!).render(<App />);
