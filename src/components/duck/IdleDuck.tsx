import { useLayoutEffect, useRef, type RefObject } from 'react';
import { DuckProp } from './PixelProps';
import { PixelDuck } from './PixelDuck';
import { DUCK_SIZE, Timeline, measure, moveDuck, offscreenRight, setPose } from './stagecraft';
import { IDLE_VISIT_MS, type IdleVisit } from './useIdleDuck';

const WALK_MS = 1_400;
/** Room between the duck and the card's right edge, so its prop sits in front of it on the card top. */
const PERCH_INSET = 40;

/** Waddles in from the right, sits on the featured card's top edge doing its thing, then waddles off. */
function playVisit(stage: HTMLElement, duck: HTMLElement): () => void {
  const timeline = new Timeline();
  const card = stage.querySelector('.featured-card');
  if (!card) {
    duck.hidden = true;
    return () => timeline.stop();
  }
  const box = measure(card, stage);
  const offRight = offscreenRight(stage);
  const perch = { x: box.x + box.w - DUCK_SIZE - PERCH_INSET, y: box.y - DUCK_SIZE + 8 };
  const leaveAt = IDLE_VISIT_MS - WALK_MS;

  moveDuck(timeline, duck, { x: offRight, y: perch.y }, [
    { ...perch, at: WALK_MS },
    { ...perch, at: leaveAt },
    { x: offRight, y: perch.y, at: IDLE_VISIT_MS },
  ]);
  setPose(duck, 'walk', 'left');
  timeline.at(WALK_MS, () => setPose(duck, 'activity', 'left'));
  timeline.at(leaveAt, () => setPose(duck, 'walk', 'right'));
  return () => timeline.stop();
}

type IdleDuckProps = { visit: IdleVisit; stageRef: RefObject<HTMLElement | null> };

/** One idle visit. Remount per visit (`key={visit.id}`). */
export function IdleDuck({ visit, stageRef }: IdleDuckProps) {
  const duckRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    const duck = duckRef.current;
    if (!stage || !duck) return;
    return playVisit(stage, duck);
  }, [stageRef]);

  return (
    <div ref={duckRef} className="duck-actor" data-kind="idle" data-activity={visit.activity} aria-hidden="true">
      <div className="duck-actor__facing">
        <div className="duck-actor__body">
          <PixelDuck className="duck-actor__sprite" />
        </div>
        <DuckProp activity={visit.activity} />
      </div>
    </div>
  );
}
