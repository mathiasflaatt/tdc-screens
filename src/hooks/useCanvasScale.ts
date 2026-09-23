import { useEffect, useState } from 'react';

function fitScale(width: number, height: number): number {
  return Math.min(window.innerWidth / width, window.innerHeight / height);
}

/** Uniform scale that fits a fixed-size canvas inside the viewport. */
export function useCanvasScale(width: number, height: number): number {
  const [scale, setScale] = useState(() => fitScale(width, height));
  useEffect(() => {
    const update = () => setScale(fitScale(width, height));
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [width, height]);
  return scale;
}
