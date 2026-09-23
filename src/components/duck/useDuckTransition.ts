import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { RoomDisplayState, ScheduleSnapshot } from '../../lib/schedule';

/**
 * - promote: the featured talk starts; the duck pecks its status pill live.
 * - advance: another session takes over; the duck pushes the old card off and pulls the next one up.
 * - clear: the room is done; the duck pushes the last card off.
 */
export type DuckTransitionKind = 'promote' | 'advance' | 'clear';

export type RoomFrame = { display: RoomDisplayState; now: number };

export type DuckRun = {
  id: number;
  kind: DuckTransitionKind;
  /** The room as it looked just before the boundary; shown until the duck swaps it. */
  outgoing: RoomFrame;
  /** `outgoing` while the duck deals with the old card, `incoming` once the new state is on screen. */
  stage: 'outgoing' | 'incoming';
};

/** When the room swaps to its new state and how long the duck stays after that, in real milliseconds. */
export const DUCK_TIMING: Record<DuckTransitionKind, { swapAt: number; after: number }> = {
  promote: { swapAt: 1_500, after: 1_500 },
  advance: { swapAt: 2_800, after: 1_900 },
  clear: { swapAt: 2_300, after: 1_300 },
};

/** Largest forward clock step still treated as ordinary ticking (one 60× playback tick is 60 s). */
const MAX_NATURAL_TICK_MS = 2 * 60_000;

function displayKey(display: RoomDisplayState): string {
  return `${display.phase}:${display.session?.id ?? ''}`;
}

export function classifyTransition(previous: RoomDisplayState, next: RoomDisplayState): DuckTransitionKind | null {
  if (!previous.session) return null;
  if (!next.session) return 'clear';
  if (previous.session.id !== next.session.id) return 'advance';
  return next.phase === 'live' && previous.phase !== 'live' ? 'promote' : null;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

type Observation = RoomFrame & { key: string; snapshot: ScheduleSnapshot; jumps: number };

/**
 * Starts a duck run when the room's featured state changes because the clock ticked over a boundary.
 * Seeks (`jumps` changed), first renders and schedule refreshes swap instantly.
 */
export function useDuckTransition(
  display: RoomDisplayState,
  now: number,
  snapshot: ScheduleSnapshot,
  jumps: number,
): DuckRun | null {
  const [run, setRun] = useState<DuckRun | null>(null);
  const lastSeen = useRef<Observation | null>(null);
  const runCount = useRef(0);
  const key = displayKey(display);

  // Layout effect so the transition starts before the new state is ever painted.
  useLayoutEffect(() => {
    const previous = lastSeen.current;
    lastSeen.current = { display, now, snapshot, key, jumps };
    if (!previous || previous.key === key) return;

    const kind = classifyTransition(previous.display, display);
    const isNaturalTick = previous.snapshot === snapshot && previous.jumps === jumps &&
      now > previous.now && now - previous.now <= MAX_NATURAL_TICK_MS;
    if (!kind || !isNaturalTick || prefersReducedMotion()) {
      setRun(null);
      return;
    }
    runCount.current += 1;
    setRun({ id: runCount.current, kind, outgoing: { display: previous.display, now: previous.now }, stage: 'outgoing' });
  });

  useEffect(() => {
    if (!run) return;
    const { id, kind } = run;
    const { swapAt, after } = DUCK_TIMING[kind];
    const swap = window.setTimeout(() => setRun((current) => current?.id === id ? { ...current, stage: 'incoming' } : current), swapAt);
    const finish = window.setTimeout(() => setRun((current) => current?.id === id ? null : current), swapAt + after);
    return () => {
      window.clearTimeout(swap);
      window.clearTimeout(finish);
    };
    // Timers belong to one run; stage updates of the same run must not restart them.
  }, [run?.id]);

  return run;
}
