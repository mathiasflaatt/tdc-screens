import {
  DUCK_SIZE,
  Timeline,
  measure,
  moveDuck,
  offscreenLeft,
  offscreenRight,
  setPose,
  type Box,
  type Point,
  type Waypoint,
} from './stagecraft';
import type { DuckRun } from './useDuckTransition';

export type SceneElements = {
  /** `.room-body`; every coordinate is relative to it, in unscaled canvas pixels. */
  stage: HTMLElement;
  duck: HTMLElement;
  sparkles: HTMLElement;
};

/** What the outgoing segment leaves behind for the incoming one. */
export type SceneMemory = { duck?: Point; row?: Box | null };

const PUSH_DISTANCE = 260;
const HOP_HEIGHT = 140;
const LIFT_EASE = 'cubic-bezier(0.2, 0.9, 0.3, 1.15)';

function hopWaypoints(from: Point, to: Point, start: number, duration: number): Waypoint[] {
  return [
    { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - HOP_HEIGHT, at: start + duration / 2, easing: 'ease-out' },
    { x: to.x, y: to.y, at: start + duration, easing: 'ease-in' },
  ];
}

/** Duck walks in from the left, shoves the featured card off the right edge and, for `advance`, hops to the next row. */
function pushOff(timeline: Timeline, scene: SceneElements, memory: SceneMemory, hopToNextRow: boolean): void {
  const { stage, duck } = scene;
  const card = stage.querySelector('.featured-card');
  if (!card) return;
  const box = measure(card, stage);
  const offLeft = offscreenLeft(stage);
  const offRight = offscreenRight(stage);
  const y = box.y + box.h / 2 - DUCK_SIZE / 2;
  const contactX = box.x - DUCK_SIZE + 16;
  const shoved: Point = { x: contactX + PUSH_DISTANCE, y };

  const waypoints: Waypoint[] = [
    { x: contactX, y, at: 900 },
    { x: contactX, y, at: 1_100 },
    { x: shoved.x, y, at: 1_700, easing: 'ease-in' },
    { x: shoved.x, y, at: 2_000 },
  ];
  memory.duck = shoved;

  const row = hopToNextRow ? stage.querySelector('.agenda-row') : null;
  memory.row = row ? measure(row, stage) : null;
  if (hopToNextRow) {
    const landing: Point = memory.row
      ? { x: memory.row.x + memory.row.w - DUCK_SIZE - 8, y: memory.row.y + memory.row.h - DUCK_SIZE + 12 }
      : { x: box.x + box.w - DUCK_SIZE, y: box.y + box.h - DUCK_SIZE };
    waypoints.push(...hopWaypoints(shoved, landing, 2_000, 600));
    memory.duck = landing;
  }
  moveDuck(timeline, duck, { x: offLeft, y }, waypoints);

  timeline.animate(card, [
    { transform: 'none', easing: 'ease-in' },
    { transform: `translateX(${PUSH_DISTANCE}px) rotate(1deg)`, offset: 0.5, easing: 'cubic-bezier(0.5, 0, 1, 0.5)' },
    { transform: `translateX(${offRight - box.x + 40}px) rotate(6deg)` },
  ], { delay: 1_100, duration: 1_200 });

  setPose(duck, 'walk', 'right');
  timeline.at(900, () => setPose(duck, 'push', 'right'));
  timeline.at(1_700, () => setPose(duck, 'idle', 'right', true));
  if (!hopToNextRow) return;
  timeline.at(2_000, () => setPose(duck, 'walk', 'left'));
  timeline.at(2_600, () => setPose(duck, 'idle', 'left'));
  timeline.animate(row, [
    { transform: 'none' },
    { transform: 'translateY(-10px) scale(1.03)' },
  ], { delay: 2_550, duration: 250, easing: 'steps(2, end)' });
}

/** The next talk rises from where its agenda row was into the featured slot, the duck riding on top. */
function pullUp(timeline: Timeline, scene: SceneElements, memory: SceneMemory): void {
  const { stage, duck } = scene;
  const card = stage.querySelector('.featured-card');
  const offRight = offscreenRight(stage);
  const from = memory.duck ?? { x: offRight, y: 0 };
  if (!card) {
    exitRight(timeline, duck, from, 0, offRight);
    return;
  }
  const box = measure(card, stage);
  const row = memory.row;
  const origin = row
    ? {
      dx: row.x + row.w / 2 - (box.x + box.w / 2),
      dy: row.y + row.h / 2 - (box.y + box.h / 2),
      sx: row.w / box.w,
      sy: Math.min(1, (row.h * 1.6) / box.h),
    }
    : { dx: 0, dy: 320, sx: 0.6, sy: 0.4 };

  timeline.animate(card, [
    { transform: `translate(${origin.dx}px, ${origin.dy}px) scale(${origin.sx}, ${origin.sy})`, opacity: 0.7 },
    { transform: 'none', opacity: 1 },
  ], { duration: 900, easing: LIFT_EASE });
  timeline.animate(stage.querySelector('.room-agenda'), [
    { transform: 'translateY(48px)', opacity: 0 },
    { transform: 'none', opacity: 1 },
  ], { delay: 500, duration: 500, easing: 'ease-out' });

  // Middle of the top edge: clear of the status pill (left) and the time range (right).
  const perch: Point = { x: box.x + box.w / 2 - DUCK_SIZE / 2, y: box.y - DUCK_SIZE + 26 };
  moveDuck(timeline, duck, from, [
    { ...perch, at: 900, easing: LIFT_EASE },
    { ...perch, at: 1_050 },
    { x: offRight, y: perch.y, at: 1_900 },
  ]);
  setPose(duck, 'idle', 'left');
  timeline.at(900, () => setPose(duck, 'idle', 'right', true));
  timeline.at(1_050, () => setPose(duck, 'walk', 'right'));
}

function exitRight(timeline: Timeline, duck: HTMLElement, from: Point, start: number, offRight: number): void {
  moveDuck(timeline, duck, from, [{ ...from, at: start + 1 }, { x: offRight, y: from.y, at: start + 1_000 }]);
  setPose(duck, 'walk', 'right');
}

/** Duck waddles in from the right and pecks the status pill until the talk goes live. */
function peckPill(timeline: Timeline, scene: SceneElements, memory: SceneMemory): void {
  const { stage, duck } = scene;
  const pill = stage.querySelector('.status-pill');
  if (!pill) return;
  const box = measure(pill, stage);
  const offRight = offscreenRight(stage);
  const beside: Point = { x: box.x + box.w - 10, y: box.y + box.h - DUCK_SIZE + 18 };
  memory.duck = beside;
  moveDuck(timeline, duck, { x: offRight, y: beside.y }, [{ ...beside, at: 1_100 }]);
  setPose(duck, 'walk', 'left');
  timeline.at(1_100, () => setPose(duck, 'peck', 'left'));
}

/** The pill pops to "Happening now" with a burst of pixels; the duck quacks and leaves. */
function celebrateLive(timeline: Timeline, scene: SceneElements, memory: SceneMemory): void {
  const { stage, duck, sparkles } = scene;
  const pill = stage.querySelector('.status-pill');
  const offRight = offscreenRight(stage);
  const from = memory.duck ?? { x: offRight, y: 0 };
  if (pill) {
    const box = measure(pill, stage);
    sparkles.style.transform = `translate(${box.x + box.w / 2}px, ${box.y + box.h / 2}px)`;
    sparkles.dataset.active = 'true';
    timeline.animate(pill, [
      { transform: 'scale(1.45) rotate(-5deg)' },
      { transform: 'scale(0.9) rotate(2deg)', offset: 0.6 },
      { transform: 'none' },
    ], { duration: 450, easing: 'steps(5, end)' });
  }
  setPose(duck, 'idle', 'left', true);
  moveDuck(timeline, duck, from, [{ ...from, at: 450 }, { x: offRight, y: from.y, at: 1_500 }]);
  timeline.at(450, () => setPose(duck, 'walk', 'right'));
}

function fadeInEmpty(timeline: Timeline, scene: SceneElements, memory: SceneMemory): void {
  const { stage, duck } = scene;
  const offRight = offscreenRight(stage);
  timeline.animate(stage.querySelector('.featured-card'), [
    { transform: 'scale(0.92)', opacity: 0 },
    { transform: 'none', opacity: 1 },
  ], { duration: 500, easing: 'steps(4, end)' });
  exitRight(timeline, duck, memory.duck ?? { x: offRight, y: 0 }, 200, offRight);
}

/** Plays one stage of a duck run against the current DOM; returns a function that cancels it. */
export function playScene(run: DuckRun, scene: SceneElements, memory: SceneMemory): () => void {
  const timeline = new Timeline();
  const incoming = run.stage === 'incoming';
  if (run.kind === 'promote') (incoming ? celebrateLive : peckPill)(timeline, scene, memory);
  else if (incoming) (run.kind === 'advance' ? pullUp : fadeInEmpty)(timeline, scene, memory);
  else pushOff(timeline, scene, memory, run.kind === 'advance');
  return () => {
    timeline.stop();
    delete scene.sparkles.dataset.active;
  };
}
