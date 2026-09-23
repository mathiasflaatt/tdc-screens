/** Shared building blocks for moving the duck around the room stage. */

/** Rendered duck size in canvas pixels: 12 mascot pixels × 11. */
export const DUCK_SIZE = 132;
/** How far past the stage edge the duck parks off screen; the kiosk canvas clips it. */
export const OFFSCREEN_MARGIN = 24;
export const WALK_EASE = 'linear';

export type Box = { x: number; y: number; w: number; h: number };
export type Point = { x: number; y: number };
/** `activity` hands the body over to the idle activity animations in duck.css. */
export type Pose = 'walk' | 'push' | 'peck' | 'idle' | 'activity';
export type Facing = 'left' | 'right';
/** A duck waypoint: arrive at `at` ms after the segment starts. */
export type Waypoint = Point & { at: number; easing?: string };

export class Timeline {
  private readonly animations: Animation[] = [];
  private readonly timers: number[] = [];

  animate(element: Element | null, keyframes: Keyframe[], options: KeyframeAnimationOptions): void {
    if (!element) return;
    this.animations.push(element.animate(keyframes, { fill: 'both', ...options }));
  }

  at(ms: number, action: () => void): void {
    this.timers.push(window.setTimeout(action, ms));
  }

  stop(): void {
    this.timers.forEach((timer) => window.clearTimeout(timer));
    this.animations.forEach((animation) => animation.cancel());
  }
}

export function measure(element: Element, stage: HTMLElement): Box {
  const stageRect = stage.getBoundingClientRect();
  // The kiosk canvas is CSS-scaled to the TV; convert back to canvas pixels.
  const scale = stageRect.width / stage.offsetWidth || 1;
  const rect = element.getBoundingClientRect();
  return {
    x: (rect.left - stageRect.left) / scale,
    y: (rect.top - stageRect.top) / scale,
    w: rect.width / scale,
    h: rect.height / scale,
  };
}

export function offscreenLeft(stage: HTMLElement): number {
  return -DUCK_SIZE - stage.offsetLeft - OFFSCREEN_MARGIN;
}

export function offscreenRight(stage: HTMLElement): number {
  return stage.offsetWidth + stage.offsetLeft + OFFSCREEN_MARGIN;
}

export function moveDuck(timeline: Timeline, duck: HTMLElement, from: Point, waypoints: Waypoint[]): void {
  const duration = waypoints[waypoints.length - 1].at;
  const frames: Keyframe[] = [
    { transform: `translate(${from.x}px, ${from.y}px)`, offset: 0, easing: waypoints[0]?.easing ?? WALK_EASE },
    ...waypoints.map((point, index) => ({
      transform: `translate(${point.x}px, ${point.y}px)`,
      offset: point.at / duration,
      easing: waypoints[index + 1]?.easing ?? WALK_EASE,
    })),
  ];
  timeline.animate(duck, frames, { duration });
}

export function setPose(duck: HTMLElement, pose: Pose, facing: Facing, quack = false): void {
  duck.dataset.pose = pose;
  duck.dataset.facing = facing;
  duck.dataset.quack = String(quack);
}
