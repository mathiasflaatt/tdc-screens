import { useEffect, useRef, useState } from 'react';
import { parseSessionInstant, type ScheduleSnapshot } from '../lib/schedule';

const SIMULATION_MODE_PARAMETER = 'test';
const SIMULATION_TIME_PARAMETER = 'at';
const SIMULATION_SPEED_PARAMETER = 'speed';

export const PLAYBACK_SPEEDS = [1, 10, 60] as const;

export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number];

export type SimulationClock = {
  active: boolean;
  now: number;
  playing: boolean;
  speed: PlaybackSpeed;
  day: string;
  dayStart: number;
  dayEnd: number;
  seek: (instant: number) => void;
  togglePlaying: () => void;
  setSpeed: (speed: PlaybackSpeed) => void;
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

function currentSimulationSpeedFromUrl(): PlaybackSpeed {
  if (!simulationEnabledInUrl()) return 1;
  const value = Number(new URLSearchParams(window.location.search).get(SIMULATION_SPEED_PARAMETER));
  return PLAYBACK_SPEEDS.find((playbackSpeed) => playbackSpeed === value) ?? 1;
}

function setSimulationUrlParameters(url: URL, instant: number | null, speed: PlaybackSpeed): void {
  if (instant === null) {
    url.searchParams.delete(SIMULATION_MODE_PARAMETER);
    url.searchParams.delete(SIMULATION_TIME_PARAMETER);
    url.searchParams.delete(SIMULATION_SPEED_PARAMETER);
  } else {
    url.searchParams.set(SIMULATION_MODE_PARAMETER, 'true');
    url.searchParams.set(SIMULATION_TIME_PARAMETER, formatOsloDateTimeInput(instant).slice(11, 16));
    if (speed === 1) url.searchParams.delete(SIMULATION_SPEED_PARAMETER);
    else url.searchParams.set(SIMULATION_SPEED_PARAMETER, String(speed));
  }
}

function writeSimulationUrl(instant: number | null, speed: PlaybackSpeed): void {
  const url = new URL(window.location.href);
  setSimulationUrlParameters(url, instant, speed);
  window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
}

export function simulationHref(path: string, simulation: SimulationClock): string {
  const url = new URL(window.location.href);
  url.pathname = path;
  setSimulationUrlParameters(url, simulation.active ? simulation.now : null, simulation.speed);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function useSimulationClock(snapshot: ScheduleSnapshot | null): SimulationClock {
  const day = conferenceDate(snapshot);
  const [initialSimulationTime] = useState(() => currentSimulationTimeFromUrl(day));
  const [simulationTime, setSimulationTime] = useState(initialSimulationTime ?? Date.now());
  const [liveTime, setLiveTime] = useState(() => Date.now());
  const [active, setActive] = useState(simulationEnabledInUrl);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeedState] = useState(currentSimulationSpeedFromUrl);
  const simulationTimeRef = useRef(simulationTime);
  const dayStart = parseSessionInstant(`${day}T00:00:00`) ?? simulationTime;
  const dayEnd = conferenceDayEnd(day);

  useEffect(() => {
    if (!active) return;
    const fromUrl = currentSimulationTimeFromUrl(day);
    if (fromUrl === null) return;
    simulationTimeRef.current = fromUrl;
    setSimulationTime(fromUrl);
    writeSimulationUrl(fromUrl, speed);
  }, [active, day]);

  useEffect(() => {
    let previousRealTime = Date.now();
    const timer = window.setInterval(() => {
      const realTime = Date.now();
      const elapsed = realTime - previousRealTime;
      previousRealTime = realTime;
      setLiveTime(realTime);
      if (active && playing) {
        const next = Math.min(simulationTimeRef.current + elapsed * speed, dayEnd);
        simulationTimeRef.current = next;
        setSimulationTime(next);
        writeSimulationUrl(next, speed);
        if (next >= dayEnd) setPlaying(false);
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [active, dayEnd, playing, speed]);

  return {
    active,
    now: active ? simulationTime : liveTime,
    playing,
    speed,
    day,
    dayStart,
    dayEnd,
    seek: (instant) => {
      simulationTimeRef.current = instant;
      setActive(true);
      setSimulationTime(instant);
      writeSimulationUrl(instant, speed);
    },
    togglePlaying: () => setPlaying((value) => !value),
    setSpeed: (nextSpeed) => {
      setSpeedState(nextSpeed);
      if (active) writeSimulationUrl(simulationTimeRef.current, nextSpeed);
    },
    returnToLive: () => {
      setPlaying(false);
      setActive(false);
      setLiveTime(Date.now());
      writeSimulationUrl(null, speed);
    },
  };
}
