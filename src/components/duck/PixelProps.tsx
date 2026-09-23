/** Pixel-art props for the idle duck, drawn in the same chunky style as the mascot. */

export type IdleActivity = 'coffee' | 'book' | 'nap' | 'eat';

type PixelArt = { rows: readonly string[]; palette: Record<string, string> };

const COFFEE_MUG: PixelArt = {
  rows: [
    'wwwww..',
    'wcccwww',
    'wwwww.w',
    'wwwww.w',
    'wwwwwww',
    'wwwww..',
    '.www...',
  ],
  palette: { w: '#F4F1E8', c: '#6B3E26' },
};

const OPEN_BOOK: PixelArt = {
  rows: [
    '.wwww..wwww.',
    'wwllwwwwllww',
    'wwwwwwwwwwww',
    'wllwwwwwwllw',
    'wwwwwwwwwwww',
    'pppppsspppp.',
    '.ppppsspppp.',
  ],
  palette: { w: '#F4F1E8', l: '#9AA0B5', p: '#8B5CF6', s: '#5B3BB0' },
};

const SANDWICH: PixelArt = {
  rows: [
    '..bbbbbbbb..',
    '.gggggggggg.',
    '.rrrrrrrrrr.',
    '..bbbbbbbb..',
  ],
  palette: { b: '#E0A45A', g: '#6CCB5F', r: '#E2574C' },
};

const PLATE: PixelArt = {
  rows: [
    'pppppppppppp',
    '.pppppppppp.',
  ],
  palette: { p: '#F4F1E8' },
};

function PixelArtSvg({ art, className }: { art: PixelArt; className: string }) {
  const width = Math.max(...art.rows.map((row) => row.length));
  return (
    <svg className={className} viewBox={`0 0 ${width} ${art.rows.length}`} shapeRendering="crispEdges" aria-hidden="true">
      {art.rows.flatMap((row, y) => [...row].flatMap((pixel, x) => {
        const fill = art.palette[pixel];
        return fill ? [<rect key={`${x}-${y}`} x={x} y={y} width={1.02} height={1.02} fill={fill} />] : [];
      }))}
    </svg>
  );
}

/** Held in front of the duck's beak; flips with the duck because it lives inside the facing wrapper. */
export function DuckProp({ activity }: { activity: IdleActivity }) {
  switch (activity) {
    case 'coffee':
      return (
        <div className="duck-prop duck-prop--coffee">
          <span className="duck-prop__steam" />
          <PixelArtSvg art={COFFEE_MUG} className="duck-prop__art" />
        </div>
      );
    case 'book':
      return <div className="duck-prop duck-prop--book"><PixelArtSvg art={OPEN_BOOK} className="duck-prop__art" /></div>;
    case 'eat':
      return (
        <div className="duck-prop duck-prop--eat">
          <PixelArtSvg art={SANDWICH} className="duck-prop__food" />
          <PixelArtSvg art={PLATE} className="duck-prop__plate" />
        </div>
      );
    case 'nap':
      return <div className="duck-prop duck-prop--nap"><span>z</span><span>z</span><span>Z</span></div>;
  }
}
