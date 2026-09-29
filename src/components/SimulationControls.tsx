import { createPortal } from 'react-dom';
import {
  formatOsloTime,
  parseSessionInstant,
  type ScheduleSnapshot,
} from '../lib/schedule';
import {
  PLAYBACK_SPEED,
  simulationHref,
  type SimulationClock,
} from '../hooks/useSimulationClock';
import { useFloatingPanel } from '../hooks/useFloatingPanel';

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
  const panel = useFloatingPanel('tdc-simulation-panel-v1');
  if (!simulation.active) return null;

  const sessionInstants = snapshot.sessions.flatMap((session) => [
    parseSessionInstant(session.startsAt),
    parseSessionInstant(session.endsAt),
  ]).filter((instant): instant is number => instant !== null);
  const scheduleBoundaries = [...new Set(sessionInstants)].sort((left, right) => left - right);
  const scrubberTime = Math.min(simulation.dayEnd, Math.max(simulation.dayStart, simulation.now));
  const bodyId = 'simulation-controls-body';

  // Portalled to <body> so it floats over the viewport instead of the scaled kiosk canvas.
  return createPortal(
    <section
      ref={panel.panelRef}
      className={`simulation-controls${panel.collapsed ? ' is-collapsed' : ''}`}
      aria-label="Simulation controls"
      style={panel.style}
    >
      <div className="simulation-controls-handle" {...panel.handleProps}>
        <span className="simulation-grip" aria-hidden="true" />
        <p className="simulation-mode-label" role="status">Simulated time</p>
        {panel.collapsed && <span className="simulation-collapsed-time">{formatOsloTime(simulation.now)}</span>}
        <button
          className="simulation-icon-button"
          type="button"
          aria-expanded={!panel.collapsed}
          aria-controls={bodyId}
          aria-label={panel.collapsed ? 'Expand simulation controls' : 'Collapse simulation controls'}
          onClick={panel.toggleCollapsed}
        >
          <span aria-hidden="true">{panel.collapsed ? '▴' : '▾'}</span>
        </button>
      </div>
      <div className="simulation-controls-body" id={bodyId} hidden={panel.collapsed}>
        <div className="simulation-row">
          <button
            className="btn btn--primary btn--sm simulation-play"
            type="button"
            onClick={simulation.togglePlaying}
            title={`Plays at ${PLAYBACK_SPEED}×`}
          >
            {simulation.playing ? 'Pause' : 'Play'}
          </button>
          <input
            className="simulation-time-input"
            aria-label="Simulation time"
            type="time"
            step="60"
            value={formatOsloTime(simulation.now)}
            onChange={(event) => {
              const instant = parseSessionInstant(`${simulation.day}T${event.currentTarget.value}:00`);
              if (instant !== null) simulation.seek(instant);
            }}
          />
          <span className="simulation-speed-tag">{PLAYBACK_SPEED}×</span>
        </div>
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
        <div className="simulation-row simulation-links">
          {switchHref && switchLabel && <a className="btn btn--ghost btn--sm" href={simulationHref(switchHref, simulation)}>{switchLabel}</a>}
          <button className="btn btn--ghost btn--sm" type="button" onClick={simulation.returnToLive}>Back to live</button>
        </div>
      </div>
    </section>,
    document.body,
  );
}
