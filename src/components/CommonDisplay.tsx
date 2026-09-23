import {
  formatOsloDate,
  formatSessionRange,
  formatSessionStart,
  getCommonDisplayState,
  parseSessionInstant,
  type CommonNotice,
  type CommonRoomDisplay,
  type ScheduleSnapshot,
} from '../lib/schedule';
import { COMMON_CANVAS, KioskCanvas, KioskHeader, SpeakerList } from './kiosk';
import { SimulationControls } from './SimulationControls';
import type { SimulationClock } from '../hooks/useSimulationClock';

const CANVAS_LABEL = 'Common-area conference overview';
/** Keep the later list short so the columns stay scannable at a distance. */
const MAX_LATER_TALKS = 3;

const NOTICE_LABEL: Record<CommonNotice['type'], string> = {
  break: 'Break',
  lunch: 'Lunch',
  plenary: 'Plenary',
  service: 'On the programme',
};

function NoticeBanner({ notices }: { notices: CommonNotice[] }) {
  if (notices.length === 0) return null;
  return (
    <section className="common-banner" role="status" aria-label="Shared programme">
      {notices.map(({ type, session }) => (
        <p key={session.id} className={`common-banner-item common-banner-item--${type}`}>
          {!session.title.toLocaleLowerCase().includes(NOTICE_LABEL[type].toLocaleLowerCase()) && (
            <span className="common-banner-label">{NOTICE_LABEL[type]}</span>
          )}
          <strong className="common-banner-title">{session.title}</strong>
          <span className="common-banner-where">
            {type === 'plenary' || type === 'service' ? <>in <b>{session.room}</b> · </> : null}
            <time dateTime={session.startsAt}>{formatSessionRange(session)}</time>
          </span>
        </p>
      ))}
    </section>
  );
}

function NowCard({ display }: { display: CommonRoomDisplay }) {
  const session = display.current;
  if (!session) return null;
  return (
    <div className="column-card column-card--now">
      <p className="column-card-meta">
        <span className="column-card-label">Now</span>
        <time dateTime={session.startsAt}>{formatSessionRange(session)}</time>
      </p>
      <h3 className="column-card-title">{session.title}</h3>
      <SpeakerList speakers={session.speakers} />
    </div>
  );
}

function NextCard({ display }: { display: CommonRoomDisplay }) {
  const session = display.next;
  if (!session) return null;
  const featured = !display.current;
  return (
    <div className={`column-card column-card--next${featured ? ' column-card--featured' : ''}`}>
      <p className="column-card-meta">
        <span className="column-card-label">{display.phase === 'before' ? 'Starts later' : 'Up next'}</span>
        <time dateTime={session.startsAt}>{formatSessionStart(session)}</time>
      </p>
      <h3 className="column-card-title">{session.title}</h3>
      {display.phase === 'before' && (
        <p className="column-card-date">{formatOsloDate(parseSessionInstant(session.startsAt) ?? Date.now())}</p>
      )}
      {featured && <SpeakerList speakers={session.speakers} />}
    </div>
  );
}

function RoomColumn({ display, index }: { display: CommonRoomDisplay; index: number }) {
  const headingId = `common-room-${index}`;
  const hasTalks = display.current || display.next;
  return (
    <article className={`room-column room-column--${display.phase}`} aria-labelledby={headingId}>
      <h2 id={headingId} className="room-column-name">{display.room.name}</h2>
      <div className="room-column-cards">
        <NowCard display={display} />
        <NextCard display={display} />
        {!hasTalks && (
          <p className="room-column-empty">
            {display.phase === 'empty' ? 'No talks are scheduled in this room.' : 'No more talks today'}
          </p>
        )}
      </div>
      {display.later.length > 0 && (
        <ol className="room-column-later" aria-label={`Later in ${display.room.name}`}>
          {display.later.slice(0, MAX_LATER_TALKS).map((session) => (
            <li key={session.id}>
              <time dateTime={session.startsAt}>{formatSessionStart(session)}</time>
              <span>{session.title}</span>
            </li>
          ))}
        </ol>
      )}
    </article>
  );
}

function CommonMessage({ heading, detail }: { heading: string; detail: string }) {
  return (
    <div className="common-message" aria-live="polite">
      <h2>{heading}</h2>
      <p>{detail}</p>
    </div>
  );
}

type CommonDisplayProps = { snapshot: ScheduleSnapshot; stale: boolean; simulation: SimulationClock };

export function CommonDisplay({ snapshot, stale, simulation }: CommonDisplayProps) {
  const now = simulation.now;
  const display = getCommonDisplayState(snapshot, now);

  return (
    <KioskCanvas {...COMMON_CANVAS} className="common-canvas" label={CANVAS_LABEL}>
      <KioskHeader now={now} stale={stale} />
      {display.phase === 'complete' && (
        <CommonMessage heading="Programme complete" detail="The conference programme has ended for today." />
      )}
      {display.phase === 'empty' && (
        <CommonMessage heading="No talk rooms scheduled" detail="There are no rooms with talks in the current conference programme." />
      )}
      {display.phase === 'scheduled' && (
        <>
          <NoticeBanner notices={display.notices} />
          <section
            className="room-columns"
            aria-label="Talk rooms"
            style={{ gridTemplateColumns: `repeat(${display.rooms.length}, minmax(0, 1fr))` }}
          >
            {display.rooms.map((room, index) => (
              <RoomColumn key={room.room.id} display={room} index={index} />
            ))}
          </section>
        </>
      )}
      <SimulationControls
        snapshot={snapshot}
        simulation={simulation}
        switchHref="/"
        switchLabel="Choose a room"
      />
    </KioskCanvas>
  );
}
