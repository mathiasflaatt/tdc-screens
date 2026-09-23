import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrandLink } from './components/brand';
import { CommonDisplay } from './components/CommonDisplay';
import { StaleNotice } from './components/kiosk';
import { RoomDisplay } from './components/RoomDisplay';
import { useDisplayClock, type DisplayClock } from './hooks/useDisplayClock';
import { useSchedule } from './hooks/useSchedule';
import type { DisplayRoom } from './lib/schedule';
import './styles/fonts.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/button.css';
import './styles/wordmark.css';
import './styles/room.css';
import './styles/common.css';

function StatePage({ eyebrow, heading, children, alert = false }: {
  eyebrow: string;
  heading: string;
  children: ReactNode;
  alert?: boolean;
}) {
  return (
    <main className="state-page" role={alert ? 'alert' : undefined} aria-live={alert ? undefined : 'polite'}>
      <BrandLink />
      <div className="state-message">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{heading}</h1>
        {children}
      </div>
    </main>
  );
}

function ScreenSelector({ rooms, stale }: { rooms: DisplayRoom[]; stale: boolean }) {
  return (
    <main className="selector-page">
      <header className="selector-header">
        <BrandLink />
        <p className="eyebrow">Trondheim Developer Conference · 19 October 2026</p>
        <h1>Choose a screen</h1>
        <p className="selector-lede">Open a room display for the TV outside that room.</p>
      </header>
      {stale && <StaleNotice />}
      {rooms.length > 0 ? (
        <nav aria-label="Room screens">
          <ul className="room-list">
            {rooms.map((room) => (
              <li key={room.id}>
                <a className="btn btn--ghost btn--lg" href={`/room/${encodeURIComponent(room.id)}`}>{room.name}</a>
              </li>
            ))}
          </ul>
        </nav>
      ) : (
        <p className="empty-rooms">No room screens are available yet.</p>
      )}
      <nav className="common-screen-link" aria-label="Other screens">
        <a className="btn btn--primary btn--lg" href="/common">Common-area display</a>
      </nav>
    </main>
  );
}

function UnknownRoom({ roomId }: { roomId: string }) {
  return (
    <StatePage eyebrow={`Room ${roomId}`} heading="Room not found">
      <p>This room is not in the current conference schedule.</p>
      <a className="btn btn--primary" href="/">Choose a screen</a>
    </StatePage>
  );
}

function decodeRoomId(raw: string): string | null {
  try {
    return decodeURIComponent(raw);
  } catch {
    return null;
  }
}

function App({ clock }: { clock: DisplayClock }) {
  const state = useSchedule();
  const now = useDisplayClock(clock);
  const route = /^\/room\/([^/]+)\/?$/.exec(window.location.pathname);
  const commonRoute = /^\/common\/?$/.test(window.location.pathname);

  if (state.loading) {
    return (
      <StatePage eyebrow="TDC 2026" heading="Loading the schedule">
        <p>Connecting to the live conference programme.</p>
      </StatePage>
    );
  }
  if (state.error || !state.snapshot) {
    return (
      <StatePage eyebrow="TDC 2026" heading="Schedule unavailable" alert>
        <p>We couldn’t load the conference programme. Trying again automatically.</p>
      </StatePage>
    );
  }

  const { snapshot, stale } = state;
  if (commonRoute) return <CommonDisplay snapshot={snapshot} stale={stale} now={now} />;
  if (!route) return <ScreenSelector rooms={snapshot.rooms} stale={stale} />;

  const roomId = decodeRoomId(route[1]);
  const room = roomId === null ? undefined : snapshot.rooms.find((candidate) => candidate.id === roomId);
  return room
    ? <RoomDisplay snapshot={snapshot} room={room} stale={stale} now={now} />
    : <UnknownRoom roomId={roomId ?? route[1]} />;
}

createRoot(document.getElementById('root')!).render(<App clock={Date.now} />);
