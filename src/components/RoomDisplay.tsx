import { useRef } from 'react';
import {
  formatSessionRange,
  formatSessionStart,
  getCommonDisplayState,
  getRoomAgenda,
  getRoomDisplayState,
  type CommonRoomDisplay,
  type DisplayRoom,
  type DisplaySession,
  type RoomContext,
  type RoomDisplayState,
  type ScheduleSnapshot,
} from '../lib/schedule';
import { DuckActor } from './duck/DuckActor';
import { IdleDuck } from './duck/IdleDuck';
import { useDuckTransition } from './duck/useDuckTransition';
import { idleBreakFor, useIdleDuck } from './duck/useIdleDuck';
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

function SessionTags({ session }: { session: DisplaySession }) {
  const tags = [session.mainTag, session.language].filter((tag): tag is string => Boolean(tag));
  if (tags.length === 0) return null;
  return (
    <ul className="session-tags" aria-label="Session tags">
      {tags.map((tag, index) => (
        <li key={tag} className={index === 0 && session.mainTag ? 'session-tag session-tag--main' : 'session-tag'}>{tag}</li>
      ))}
    </ul>
  );
}

function FeaturedSession({ session, phase }: { session: DisplaySession; phase: SessionPhase }) {
  return (
    <article className={`featured-card featured-card--${phase}`} aria-live="polite">
      <div className="featured-meta">
        <p className="status-pill">{STATUS_LABEL[phase]}</p>
        <time className="featured-time" dateTime={session.startsAt}>{formatSessionRange(session)}</time>
      </div>
      <h2 className="featured-title">{session.title}</h2>
      <SessionTags session={session} />
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

/** Only plenaries get a notice: they send people elsewhere. Breaks and lunch are the duck's business. */
function PlenaryNotice({ context }: { context: RoomContext }) {
  if (context.type !== 'plenary') return null;
  return <p className="room-context" role="status">Plenary session in <strong>{context.room}</strong></p>;
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
      <span className={session ? 'elsewhere-status' : 'elsewhere-status elsewhere-status--done'}>{label}</span>
      {session && <span className="elsewhere-title">{session.title}</span>}
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

type RoomScheduleProps = { snapshot: ScheduleSnapshot; roomId: string; display: RoomDisplayState; now: number };

/** Featured card plus the rest of the room's day, as of `now`. */
function RoomSchedule({ snapshot, roomId, display, now }: RoomScheduleProps) {
  const sessionPhase = display.phase === 'empty' || display.phase === 'ended' || display.phase === 'complete'
    ? null
    : display.phase;
  // With no featured session the room is finished or empty; a trailing agenda would contradict that.
  const agenda = sessionPhase ? getRoomAgenda(snapshot, roomId, now, display.session) : [];
  const breakContext = display.context?.type === 'break' || display.context?.type === 'lunch';

  return (
    <>
      <div className="featured">
        {display.context && <PlenaryNotice context={display.context} />}
        {display.session && sessionPhase
          ? <FeaturedSession session={display.session} phase={sessionPhase} />
          : <EmptyRoom phase={display.phase === 'empty' || display.phase === 'complete' ? display.phase : 'ended'} />}
        {breakContext && display.session && (
          <p className="next-start">Next talk starts at {formatSessionStart(display.session)}</p>
        )}
      </div>
      <RoomAgenda sessions={agenda} />
    </>
  );
}

type RoomDisplayProps = { snapshot: ScheduleSnapshot; room: DisplayRoom; stale: boolean; simulation: SimulationClock };

export function RoomDisplay({ snapshot, room, stale, simulation }: RoomDisplayProps) {
  const now = simulation.now;
  const display = getRoomDisplayState(snapshot, room.id, now);
  const duckRun = useDuckTransition(display, now, snapshot, simulation.jumps);
  const idleVisit = useIdleDuck(idleBreakFor(snapshot, room.id, now), duckRun !== null);
  const stageRef = useRef<HTMLElement>(null);
  // Until the duck swaps the cards, keep showing the room as it was just before the boundary.
  const shown = duckRun?.stage === 'outgoing' ? duckRun.outgoing : { display, now };
  const elsewhere = getCommonDisplayState(snapshot, now).rooms.filter((other) => other.room.id !== room.id);

  return (
    <KioskCanvas {...ROOM_CANVAS} className="display-page room-canvas" label={`${room.name} room display`}>
      <KioskHeader now={now} stale={stale} />
      <h1 className="room-name">{room.name}</h1>
      <section
        ref={stageRef}
        className="room-body"
        aria-label={`Live schedule for ${room.name}`}
        data-room-context={shown.display.context?.type}
      >
        <RoomSchedule snapshot={snapshot} roomId={room.id} display={shown.display} now={shown.now} />
        {duckRun && <DuckActor key={duckRun.id} run={duckRun} stageRef={stageRef} />}
        {idleVisit && <IdleDuck key={idleVisit.id} visit={idleVisit} stageRef={stageRef} />}
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
