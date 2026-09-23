import { useEffect, useRef, useState } from 'react';
import { isScheduleSnapshot, type ScheduleSnapshot } from '../lib/schedule';

const SCHEDULE_URL = '/api/schedule';
const CACHE_KEY = 'tdc-2026-schedule-v1';
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 10_000;

export type ScheduleState = {
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

/** Fetches the schedule on startup and every five real minutes, keeping the last valid snapshot. */
export function useSchedule(): ScheduleState {
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
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
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
