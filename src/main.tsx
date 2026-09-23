import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrandLink } from './components/brand';
import { CommonDisplay } from './components/CommonDisplay';
import { SimulationControls } from './components/SimulationControls';
import { StaleNotice } from './components/kiosk';
import { RoomDisplay } from './components/RoomDisplay';
import { simulationHref, useSimulationClock } from './hooks/useSimulationClock';
import { useSchedule } from './hooks/useSchedule';
import type { DisplayRoom, ScheduleSnapshot } from './lib/schedule';
import './styles/fonts.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/button.css';
import './styles/wordmark.css';
import './styles/room.css';
import './styles/common.css';
import './styles/simulation.css';

function StatePage({ eyebrow, heading, children, alert = false, href = '/' }: {
  eyebrow: string;
  heading: string;
  children: ReactNode;
  alert?: boolean;
  href?: string;
}) {
  return (
    <main className="state-page" role={alert ? 'alert' : undefined} aria-live={alert ? undefined : 'polite'}>
      <BrandLink href={href} />
      <div className="state-message">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{heading}</h1>
        {children}
      </div>
    </main>
  );
}

function ScreenSelector({ rooms, stale, snapshot, simulation }: {
  rooms: DisplayRoom[];
  stale: boolean;
  snapshot: ScheduleSnapshot;
  simulation: ReturnType<typeof useSimulationClock>;
}) {
  return (
    <main className="selector-page">
      <header className="selector-header">
        <BrandLink href={simulationHref('/', simulation)} />
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
                <a className="btn btn--ghost btn--lg" href={simulationHref(`/room/${encodeURIComponent(room.id)}`, simulation)}>{room.name}</a>
              </li>
            ))}
          </ul>
        </nav>
      ) : (
        <p className="empty-rooms">No room screens are available yet.</p>
      )}
      <nav className="common-screen-link" aria-label="Other screens">
        <a className="btn btn--primary btn--lg" href={simulationHref('/common', simulation)}>Common-area display</a>
      </nav>
      <SimulationControls snapshot={snapshot} simulation={simulation} />
    </main>
  );
}

function UnknownRoom({ roomId, simulation }: { roomId: string; simulation: ReturnType<typeof useSimulationClock> }) {
  return (
    <StatePage eyebrow={`Room ${roomId}`} heading="Room not found" href={simulationHref('/', simulation)}>
      <p>This room is not in the current conference schedule.</p>
      <a className="btn btn--primary" href={simulationHref('/', simulation)}>Choose a screen</a>
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

function App() {
  const state = useSchedule();
  const simulation = useSimulationClock(state.snapshot);
  const route = /^\/room\/([^/]+)\/?$/.exec(window.location.pathname);
  const commonRoute = /^\/common\/?$/.test(window.location.pathname);
  const currentHref = simulationHref(window.location.pathname, simulation);

  if (state.loading) {
    return (
      <StatePage eyebrow="TDC 2026" heading="Loading the schedule" href={currentHref}>
        <p>Connecting to the live conference programme.</p>
      </StatePage>
    );
  }
  if (state.error || !state.snapshot) {
    return (
      <StatePage eyebrow="TDC 2026" heading="Schedule unavailable" alert href={currentHref}>
        <p>We couldn’t load the conference programme. Trying again automatically.</p>
      </StatePage>
    );
  }

  const { snapshot, stale } = state;
  if (commonRoute) return <CommonDisplay snapshot={snapshot} stale={stale} simulation={simulation} />;
  if (!route) return <ScreenSelector rooms={snapshot.rooms} stale={stale} snapshot={snapshot} simulation={simulation} />;

  const roomId = decodeRoomId(route[1]);
  const room = roomId === null ? undefined : snapshot.rooms.find((candidate) => candidate.id === roomId);
  return room
    ? <RoomDisplay snapshot={snapshot} room={room} stale={stale} simulation={simulation} />
    : <UnknownRoom roomId={roomId ?? route[1]} simulation={simulation} />;
}

createRoot(document.getElementById('root')!).render(<App />);
