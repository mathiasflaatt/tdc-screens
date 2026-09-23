import {
  formatOsloTime,
  parseSessionInstant,
  type ScheduleSnapshot,
} from '../lib/schedule';
import {
  PLAYBACK_SPEEDS,
  simulationHref,
  type SimulationClock,
} from '../hooks/useSimulationClock';

export function SimulationControls({
  snapshot,
  simulation,
  switchHref,
  switchLabel,
}: {
  snapshot: ScheduleSnapshot;
  simulation: SimulationClock;
  switchHref?: string;
  switchLabel?: string;
}) {
  if (!simulation.active) return null;

  const sessionInstants = snapshot.sessions.flatMap((session) => [
    parseSessionInstant(session.startsAt),
    parseSessionInstant(session.endsAt),
  ]).filter((instant): instant is number => instant !== null);
  const scheduleBoundaries = [...new Set(sessionInstants)].sort((left, right) => left - right);
  const previousBoundary = scheduleBoundaries.filter((instant) => instant < simulation.now).at(-1);
  const nextBoundary = scheduleBoundaries.find((instant) => instant > simulation.now);
  const scrubberTime = Math.min(simulation.dayEnd, Math.max(simulation.dayStart, simulation.now));

  return (
    <section className="simulation-controls" aria-label="Simulation controls">
      <div className="simulation-controls-heading">
        <p className="simulation-mode-label" role="status">Simulated time</p>
        <div className="simulation-links">
          {switchHref && switchLabel && <a className="btn btn--ghost btn--sm" href={simulationHref(switchHref, simulation)}>{switchLabel}</a>}
          <button className="btn btn--primary btn--sm" type="button" onClick={simulation.returnToLive}>Back to live</button>
        </div>
      </div>
      <div className="simulation-controls-body">
        <label className="simulation-time-control">
          <span>Simulation time</span>
            <input
              className="simulation-time-input"
            type="time"
            step="60"
            value={formatOsloTime(simulation.now)}
            onChange={(event) => {
              const instant = parseSessionInstant(`${simulation.day}T${event.currentTarget.value}:00`);
              if (instant !== null) simulation.seek(instant);
            }}
          />
        </label>
        <label className="simulation-scrubber-control">
          <span>Day scrubber</span>
          <input
            className="simulation-scrubber-input"
            aria-label="Day scrubber"
            type="range"
            list="simulation-boundaries"
            min={simulation.dayStart}
            max={simulation.dayEnd}
            step={60_000}
            value={scrubberTime}
            onChange={(event) => simulation.seek(Number(event.currentTarget.value))}
          />
          <datalist id="simulation-boundaries">
            {scheduleBoundaries.map((instant) => (
              <option key={instant} value={instant} label={formatOsloTime(instant)} />
            ))}
          </datalist>
        </label>
        <div className="simulation-transport">
          <button className="btn btn--ghost btn--sm" type="button" disabled={previousBoundary === undefined} onClick={() => previousBoundary !== undefined && simulation.seek(previousBoundary)}>
            Previous boundary
          </button>
          <button className="btn btn--primary btn--sm" type="button" onClick={simulation.togglePlaying}>{simulation.playing ? 'Pause' : 'Play'}</button>
          <button className="btn btn--ghost btn--sm" type="button" disabled={nextBoundary === undefined} onClick={() => nextBoundary !== undefined && simulation.seek(nextBoundary)}>
            Next boundary
          </button>
        </div>
        <fieldset className="simulation-speed-control">
          <legend>Playback speed</legend>
          {PLAYBACK_SPEEDS.map((playbackSpeed) => (
            <button
              className={`btn btn--sm${simulation.speed === playbackSpeed ? ' btn--primary' : ' btn--ghost'}`}
              type="button"
              key={playbackSpeed}
              aria-pressed={simulation.speed === playbackSpeed}
              onClick={() => simulation.setSpeed(playbackSpeed)}
            >
              {playbackSpeed}×
            </button>
          ))}
        </fieldset>
      </div>
    </section>
  );
}
