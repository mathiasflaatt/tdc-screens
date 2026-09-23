import { useEffect, useRef, useState } from 'react';
import { getSharedBreak, type ScheduleSnapshot } from '../../lib/schedule';
import type { IdleActivity } from './PixelProps';

/** A break the duck might drop by in: lunch means food, any other break a random activity. */
export type IdleBreak = { key: string; kind: 'lunch' | 'break' };

export type IdleVisit = { id: number; activity: IdleActivity };

/** Real milliseconds after the break starts before the duck arrives, picked uniformly. */
export const IDLE_ARRIVAL_MS: readonly [number, number] = [20_000, 90_000];
/** How long one visit lasts, walk-in and walk-out included. */
export const IDLE_VISIT_MS = 16_000;

const BREAK_ACTIVITIES: readonly IdleActivity[] = ['coffee', 'book', 'nap'];

/** Small deterministic PRNG (mulberry32): the same seed yields the same sequence on every screen. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** Room ids that get a duck this break: at least one, at most half the rooms, varying break to break. */
function duckRoomsFor(breakStart: number, roomIds: string[]): string[] {
  const random = seededRandom(breakStart / 60_000);
  const count = 1 + Math.floor(random() * Math.ceil(roomIds.length / 2));
  const shuffled = [...roomIds];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swap]] = [shuffled[swap], shuffled[index]];
  }
  return shuffled.slice(0, count);
}

/**
 * Every shared break, a few rooms' screens (never all) get a duck visit.
 * Screens never talk to each other, so each works out the same answer from the schedule alone.
 */
export function idleBreakFor(snapshot: ScheduleSnapshot, roomId: string, now: number): IdleBreak | null {
  const sharedBreak = getSharedBreak(snapshot, now);
  if (!sharedBreak) return null;
  const hosts = duckRoomsFor(sharedBreak.start, snapshot.rooms.map((room) => room.id));
  return hosts.includes(roomId) ? { key: String(sharedBreak.start), kind: sharedBreak.kind } : null;
}

function pickActivity(kind: IdleBreak['kind']): IdleActivity {
  if (kind === 'lunch') return 'eat';
  return BREAK_ACTIVITIES[Math.floor(Math.random() * BREAK_ACTIVITIES.length)];
}

function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

/**
 * Sends the duck over once during `idleBreak` to eat, have a coffee, read or nap.
 * `busy` (a schedule transition in progress) cancels a visit and holds off a pending one.
 */
export function useIdleDuck(idleBreak: IdleBreak | null, busy: boolean): IdleVisit | null {
  const [visit, setVisit] = useState<IdleVisit | null>(null);
  const visitCount = useRef(0);
  /** Breaks the duck has already visited on this screen. */
  const visited = useRef(new Set<string>());
  const breakKey = idleBreak?.key ?? null;
  const breakKind = idleBreak?.kind ?? 'break';

  useEffect(() => {
    if (busy) setVisit(null);
  }, [busy]);

  useEffect(() => {
    if (!visit) return;
    const leave = window.setTimeout(() => setVisit(null), IDLE_VISIT_MS);
    return () => window.clearTimeout(leave);
  }, [visit]);

  useEffect(() => {
    if (breakKey === null || visit || busy || prefersReducedMotion() || visited.current.has(breakKey)) return;
    const [min, max] = IDLE_ARRIVAL_MS;
    const arrive = window.setTimeout(() => {
      visited.current.add(breakKey);
      visitCount.current += 1;
      setVisit({ id: visitCount.current, activity: pickActivity(breakKind) });
    }, min + Math.random() * (max - min));
    return () => window.clearTimeout(arrive);
  }, [breakKey, breakKind, busy, visit]);

  return busy ? null : visit;
}
