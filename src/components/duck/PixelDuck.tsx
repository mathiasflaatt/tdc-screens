/** The TDC 2026 hero mascot (2026.trondheimdc.no), one character per pixel, facing right. */
const DUCK_PIXELS = [
  '......aaa...',
  '.....caaaa..',
  '.....caaga..',
  '.....caaaaef',
  '.....dcaaa..',
  '......dcc...',
  'a....aaaaa..',
  'ahaaaaaabac.',
  'aaaaaaaabac.',
  'haabbbbbccc.',
  '.dccccccccd.',
  '..dddddddd..',
] as const;

/** Mascot colours, deliberately not UI tokens: the duck looks the same on every theme. */
const DUCK_PALETTE: Record<string, string> = {
  a: '#FFDA58',
  b: '#E27535',
  c: '#FAA31F',
  d: '#EB7924',
  e: '#CE5D4E',
  f: '#F58577',
  g: '#2A304D',
  h: '#FAA420',
};

const GRID_SIZE = DUCK_PIXELS.length;

const DUCK_RECTS = DUCK_PIXELS.flatMap((row, y) =>
  [...row].flatMap((pixel, x) => {
    const fill = DUCK_PALETTE[pixel];
    if (!fill) return [];
    // The eye is addressable so the napping duck can close it from CSS.
    const className = pixel === 'g' ? 'pixel-duck__eye' : undefined;
    return [<rect key={`${x}-${y}`} className={className} x={x} y={y} width={1.02} height={1.02} fill={fill} />];
  }),
);

export function PixelDuck({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox={`0 0 ${GRID_SIZE} ${GRID_SIZE}`}
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
    >
      {DUCK_RECTS}
    </svg>
  );
}
