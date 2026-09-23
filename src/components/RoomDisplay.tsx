import {
  formatOsloDate,
  formatSessionRange,
  formatSessionStart,
  getCommonDisplayState,
  getRoomAgenda,
  getRoomDisplayState,
  parseSessionInstant,
  type CommonRoomDisplay,
  type DisplayRoom,
  type DisplaySession,
  type RoomContext,
  type ScheduleSnapshot,
} from '../lib/schedule';
import { KioskCanvas, KioskHeader, ROOM_CANVAS, SpeakerList } from './kiosk';
import { SimulationControls } from './SimulationControls';
import type { SimulationClock } from '../hooks/useSimulationClock';

type SessionPhase = 'live' | 'service' | 'before' | 'between';

const STATUS_LABEL: Record<SessionPhase, string> = {
  live: 'Happening now',
  service: 'On the programme',
  before: 'Starts later',
  between: 'Between sessions',
};

/** Above this many agenda rows, rows switch to a compact single-line layout. */
const COMPACT_AGENDA_ROWS = 6;

function FeaturedSession({ session, phase }: { session: DisplaySession; phase: SessionPhase }) {
  return (
    <article className={`featured-card featured-card--${phase}`} aria-live="polite">
      <div className="featured-meta">
        <p className="status-pill">{STATUS_LABEL[phase]}</p>
        <time className="featured-time" dateTime={session.startsAt}>{formatSessionRange(session)}</time>
      </div>
      <h2 className="featured-title">{session.title}</h2>
      {phase === 'before' && (
        <p className="featured-date">{formatOsloDate(parseSessionInstant(session.startsAt) ?? Date.now())}</p>
      )}
      <SpeakerList speakers={session.speakers} />
    </article>
  );
}

const EMPTY_COPY = {
  complete: ['Programme complete', 'The conference programme has ended.'],
  ended: ['No more sessions today', 'This room has no further sessions today.'],
  empty: ['No sessions scheduled', 'Check another room for the next talk.'],
} as const;

function EmptyRoom({ phase }: { phase: keyof typeof EMPTY_COPY }) {
  const [heading, detail] = EMPTY_COPY[phase];
  return (
    <article className="featured-card featured-card--empty" aria-live="polite">
      <h2 className="featured-title">{heading}</h2>
      <p className="featured-detail">{detail}</p>
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

function RoomAgenda({ sessions }: { sessions: DisplaySession[] }) {
  if (sessions.length === 0) return null;
  const compact = sessions.length > COMPACT_AGENDA_ROWS;
  return (
    <section className={`room-agenda${compact ? ' room-agenda--compact' : ''}`} aria-label="Upcoming room agenda">
      <h2 className="section-label">Later in this room</h2>
      <ol>
        {sessions.map((session) => (
          <li key={session.id} className={session.isServiceSession ? 'agenda-row agenda-row--service' : 'agenda-row'}>
            <time dateTime={session.startsAt}>{formatSessionRange(session)}</time>
            <span className="agenda-title">{session.title}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function ElsewhereRow({ display }: { display: CommonRoomDisplay }) {
  const session = display.current ?? display.next;
  const label = display.current ? 'Now' : session ? `Next ${formatSessionStart(session)}` : 'Done for today';
  return (
    <li className={`elsewhere-row${display.current ? ' elsewhere-row--live' : ''}`}>
      <span className="elsewhere-room">{display.room.name}</span>
      <span className="elsewhere-status">{label}</span>
      <span className="elsewhere-title">{session?.title ?? 'No more talks'}</span>
    </li>
  );
}

function ElsewhereNow({ rooms }: { rooms: CommonRoomDisplay[] }) {
  if (rooms.length === 0) return null;
  return (
    <section className="elsewhere" aria-label="Elsewhere now">
      <h2 className="section-label">Elsewhere now</h2>
      <ul>
        {rooms.map((display) => <ElsewhereRow key={display.room.id} display={display} />)}
      </ul>
    </section>
  );
}

type RoomDisplayProps = { snapshot: ScheduleSnapshot; room: DisplayRoom; stale: boolean; simulation: SimulationClock };

export function RoomDisplay({ snapshot, room, stale, simulation }: RoomDisplayProps) {
  const now = simulation.now;
  const display = getRoomDisplayState(snapshot, room.id, now);
  const sessionPhase = display.phase === 'empty' || display.phase === 'ended' || display.phase === 'complete'
    ? null
    : display.phase;
  const agenda = getRoomAgenda(snapshot, room.id, now, display.session);
  const elsewhere = getCommonDisplayState(snapshot, now).rooms.filter((other) => other.room.id !== room.id);
  const breakContext = display.context?.type === 'break' || display.context?.type === 'lunch';

  return (
    <KioskCanvas {...ROOM_CANVAS} className="display-page room-canvas" label={`${room.name} room display`}>
      <KioskHeader title={room.name} now={now} stale={stale} />
      <section className="room-body" aria-label={`Live schedule for ${room.name}`}>
        <div className="featured">
          {display.context && <ContextNotice context={display.context} />}
          {display.session && sessionPhase
            ? <FeaturedSession session={display.session} phase={sessionPhase} />
            : <EmptyRoom phase={display.phase === 'empty' || display.phase === 'complete' ? display.phase : 'ended'} />}
          {breakContext && display.session && (
            <p className="next-start">Next talk starts at {formatSessionStart(display.session)}</p>
          )}
        </div>
        <RoomAgenda sessions={agenda} />
      </section>
      {display.phase !== 'complete' && <ElsewhereNow rooms={elsewhere} />}
      <SimulationControls
        snapshot={snapshot}
        simulation={simulation}
        switchHref="/common"
        switchLabel="Common-area view"
      />
    </KioskCanvas>
  );
}
