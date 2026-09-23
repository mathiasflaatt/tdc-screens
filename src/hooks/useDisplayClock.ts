import { useEffect, useState } from 'react';

/** Source of the instant that drives display selection. Live displays use `Date.now`. */
export type DisplayClock = () => number;

const TICK_MS = 1000;

/** Re-reads the injected clock every second, independently of schedule polling. */
export function useDisplayClock(clock: DisplayClock): number {
  const [now, setNow] = useState(clock);
  useEffect(() => {
    setNow(clock());
    const timer = window.setInterval(() => setNow(clock()), TICK_MS);
    return () => window.clearInterval(timer);
  }, [clock]);
  return now;
}
