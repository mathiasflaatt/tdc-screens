import { useEffect, useRef, useState } from 'react';
import { parseSessionInstant, type ScheduleSnapshot } from '../lib/schedule';

const SIMULATION_MODE_PARAMETER = 'test';
const SIMULATION_TIME_PARAMETER = 'at';
const LEGACY_SPEED_PARAMETER = 'speed';

/** Simulated minutes per real second while playing. */
export const PLAYBACK_SPEED = 60;

export type SimulationClock = {
  active: boolean;
  now: number;
  playing: boolean;
  day: string;
  dayStart: number;
  dayEnd: number;
  /** Increments on every seek or return to live, so views can tell jumps from ordinary ticking. */
  jumps: number;
  seek: (instant: number) => void;
  togglePlaying: () => void;
  returnToLive: () => void;
};

function formatOsloDateTimeInput(instant: number): string {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Oslo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant).map((part) => [part.type, part.value]));
  const day = `${parts.year}-${parts.month}-${parts.day}`;
  const time = `${parts.hour}:${parts.minute}`;
  return `${day}T${time}`;
}

function conferenceDate(snapshot: ScheduleSnapshot | null): string {
  const sessionStarts = snapshot?.sessions
    .map((session) => parseSessionInstant(session.startsAt))
    .filter((instant): instant is number => instant !== null) ?? [];
  return sessionStarts.length > 0
    ? formatOsloDateTimeInput(Math.min(...sessionStarts)).slice(0, 10)
    : formatOsloDateTimeInput(Date.now()).slice(0, 10);
}

function conferenceDayEnd(day: string): number {
  const nextDate = new Date(`${day}T00:00:00Z`);
  nextDate.setUTCDate(nextDate.getUTCDate() + 1);
  const nextMidnight = parseSessionInstant(`${nextDate.toISOString().slice(0, 10)}T00:00:00`);
  const startOfDay = parseSessionInstant(`${day}T00:00:00`);
  return (nextMidnight ?? (startOfDay ?? Date.now()) + 86_400_000) - 60_000;
}

function simulationEnabledInUrl(): boolean {
  return new URLSearchParams(window.location.search).get(SIMULATION_MODE_PARAMETER) === 'true';
}

function currentSimulationTimeFromUrl(day: string): number | null {
  if (!simulationEnabledInUrl()) return null;
  const value = new URLSearchParams(window.location.search).get(SIMULATION_TIME_PARAMETER);
  const currentOsloTime = formatOsloDateTimeInput(Date.now()).slice(11, 16);
  const time = value && /^\d{2}:\d{2}$/.test(value) ? value : currentOsloTime;
  return parseSessionInstant(`${day}T${time}:00`);
}

function setSimulationUrlParameters(url: URL, instant: number | null): void {
  // Older preview links carried a speed; playback is now always PLAYBACK_SPEED.
  url.searchParams.delete(LEGACY_SPEED_PARAMETER);
  if (instant === null) {
    url.searchParams.delete(SIMULATION_MODE_PARAMETER);
    url.searchParams.delete(SIMULATION_TIME_PARAMETER);
  } else {
    url.searchParams.set(SIMULATION_MODE_PARAMETER, 'true');
    url.searchParams.set(SIMULATION_TIME_PARAMETER, formatOsloDateTimeInput(instant).slice(11, 16));
  }
}

function writeSimulationUrl(instant: number | null): void {
  const url = new URL(window.location.href);
  setSimulationUrlParameters(url, instant);
  window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
}

export function simulationHref(path: string, simulation: SimulationClock): string {
  const url = new URL(window.location.href);
  url.pathname = path;
  setSimulationUrlParameters(url, simulation.active ? simulation.now : null);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function useSimulationClock(snapshot: ScheduleSnapshot | null): SimulationClock {
  const day = conferenceDate(snapshot);
  const [initialSimulationTime] = useState(() => currentSimulationTimeFromUrl(day));
  const [simulationTime, setSimulationTime] = useState(initialSimulationTime ?? Date.now());
  const [liveTime, setLiveTime] = useState(() => Date.now());
  const [active, setActive] = useState(simulationEnabledInUrl);
  const [playing, setPlaying] = useState(false);
  const [jumps, setJumps] = useState(0);
  const simulationTimeRef = useRef(simulationTime);
  const dayStart = parseSessionInstant(`${day}T00:00:00`) ?? simulationTime;
  const dayEnd = conferenceDayEnd(day);

  useEffect(() => {
    if (!active) return;
    const fromUrl = currentSimulationTimeFromUrl(day);
    if (fromUrl === null) return;
    simulationTimeRef.current = fromUrl;
    setSimulationTime(fromUrl);
    writeSimulationUrl(fromUrl);
  }, [active, day]);

  useEffect(() => {
    let previousRealTime = Date.now();
    const timer = window.setInterval(() => {
      const realTime = Date.now();
      const elapsed = realTime - previousRealTime;
      previousRealTime = realTime;
      setLiveTime(realTime);
      if (active && playing) {
        const next = Math.min(simulationTimeRef.current + elapsed * PLAYBACK_SPEED, dayEnd);
        simulationTimeRef.current = next;
        setSimulationTime(next);
        writeSimulationUrl(next);
        if (next >= dayEnd) setPlaying(false);
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [active, dayEnd, playing]);

  return {
    active,
    now: active ? simulationTime : liveTime,
    playing,
    day,
    dayStart,
    dayEnd,
    jumps,
    seek: (instant) => {
      setJumps((count) => count + 1);
      simulationTimeRef.current = instant;
      setActive(true);
      setSimulationTime(instant);
      writeSimulationUrl(instant);
    },
    togglePlaying: () => setPlaying((value) => !value),
    returnToLive: () => {
      setJumps((count) => count + 1);
      setPlaying(false);
      setActive(false);
      setLiveTime(Date.now());
      writeSimulationUrl(null);
    },
  };
}
