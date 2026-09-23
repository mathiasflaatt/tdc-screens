import { useLayoutEffect, useRef, type CSSProperties, type RefObject } from 'react';
import { playScene, type SceneMemory } from './choreography';
import { PixelDuck } from './PixelDuck';
import type { DuckRun } from './useDuckTransition';

const SPARKLE_COUNT = 8;

type DuckActorProps = { run: DuckRun; stageRef: RefObject<HTMLElement | null> };

/** The mascot doing one schedule change by hand. Remount per run (`key={run.id}`). */
export function DuckActor({ run, stageRef }: DuckActorProps) {
  const duckRef = useRef<HTMLDivElement>(null);
  const sparklesRef = useRef<HTMLDivElement>(null);
  const memory = useRef<SceneMemory>({});

  // Layout effect: each stage's animations must be in place before the swapped DOM is painted.
  useLayoutEffect(() => {
    const stage = stageRef.current;
    const duck = duckRef.current;
    const sparkles = sparklesRef.current;
    if (!stage || !duck || !sparkles) return;
    return playScene(run, { stage, duck, sparkles }, memory.current);
  }, [run, stageRef]);

  return (
    <>
      <div ref={duckRef} className="duck-actor" data-kind={run.kind} aria-hidden="true">
        <div className="duck-actor__facing">
          <div className="duck-actor__body">
            <PixelDuck className="duck-actor__sprite" />
          </div>
        </div>
        <span className="duck-actor__quack">Quack!</span>
      </div>
      <div ref={sparklesRef} className="duck-sparkles" aria-hidden="true">
        {Array.from({ length: SPARKLE_COUNT }, (_, index) => (
          <span key={index} style={{ '--sparkle-turn': `${index / SPARKLE_COUNT}turn` } as CSSProperties} />
        ))}
      </div>
    </>
  );
}
