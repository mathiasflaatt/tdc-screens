import type { ReactNode } from 'react';
import { useCanvasScale } from '../hooks/useCanvasScale';
import { formatOsloTime, type DisplaySpeaker } from '../lib/schedule';
import { Wordmark } from './brand';

export const ROOM_CANVAS = { width: 1080, height: 1920 } as const;
export const COMMON_CANVAS = { width: 1920, height: 1080 } as const;

type KioskCanvasProps = {
  width: number;
  height: number;
  className: string;
  label: string;
  children: ReactNode;
};

/** Fixed-size kiosk canvas scaled uniformly so FullHD and 4K TVs render identically. */
export function KioskCanvas({ width, height, className, label, children }: KioskCanvasProps) {
  const scale = useCanvasScale(width, height);
  return (
    <div className="kiosk-viewport">
      <main
        className={`kiosk-canvas ${className}`}
        aria-label={label}
        style={{ width, height, transform: `translate(-50%, -50%) scale(${scale})` }}
      >
        {children}
      </main>
    </div>
  );
}

export function StaleNotice() {
  return <p className="stale-notice" role="status">Schedule may be out of date</p>;
}

type KioskHeaderProps = { title?: string; now: number; stale: boolean };

/** Title left, large wordmark centred, Oslo clock right; without a title the wordmark leads. */
export function KioskHeader({ title, now, stale }: KioskHeaderProps) {
  return (
    <header className={title ? 'kiosk-header' : 'kiosk-header kiosk-header--untitled'}>
      {title && <h1 className="kiosk-title">{title}</h1>}
      <Wordmark label="TDC" />
      <div className="kiosk-clock-wrap">
        <time className="kiosk-clock" aria-label="Oslo local time" dateTime={new Date(now).toISOString()}>
          {formatOsloTime(now)}
        </time>
        {stale && <StaleNotice />}
      </div>
    </header>
  );
}

function initialsOf(name: string): string {
  return name.split(/\s+/).filter(Boolean).map((part) => part[0]).slice(0, 2).join('').toLocaleUpperCase();
}

function Speaker({ speaker }: { speaker: DisplaySpeaker }) {
  return (
    <li className="speaker">
      {speaker.portraitUrl ? (
        <img className="speaker-portrait" src={speaker.portraitUrl} alt={`${speaker.name} portrait`} />
      ) : (
        <span className="speaker-portrait speaker-portrait--fallback" aria-hidden="true">{initialsOf(speaker.name)}</span>
      )}
      <span className="speaker-name">{speaker.name}</span>
    </li>
  );
}

export function SpeakerList({ speakers }: { speakers: DisplaySpeaker[] }) {
  if (speakers.length === 0) return null;
  return (
    <ul className="speaker-list" aria-label="Speakers">
      {speakers.map((speaker) => <Speaker key={speaker.id} speaker={speaker} />)}
    </ul>
  );
}
