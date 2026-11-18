import { Link } from 'react-router-dom';

type Fill = { d: string; c: string };
type View = { fills: Fill[]; lines: string[]; stitch: string[] };

const PEACH = '#F1DDBB';
const GOLD = '#E2B05A';
const CORAL = '#D98A6A';
const TASSEL = '#D9A58A';
const CREAM = '#EFE8D2';
const SAGE = '#B4C29A';
const TAN = '#C9A273';
const OCHRE = '#E2CB6E';
const RIB = '#D4BA58';

function circ(x: number, y: number, r: number) {
  return `M${x - r} ${y} a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0`;
}

function btn(x: number, y: number) {
  return `M${x - 1.6} ${y} a1.6 1.6 0 1 0 3.2 0 a1.6 1.6 0 1 0 -3.2 0`;
}

function fringe(x0: number, x1: number, y0: number, y1: number, splay: number) {
  const out: string[] = [];
  for (let x = x0 + 2.5; x < x1 - 1; x += 2.6) {
    const t = (x - x0) / (x1 - x0) - 0.5;
    out.push(`M${x.toFixed(1)} ${y0} L${(x + t * splay).toFixed(1)} ${y1}`);
  }
  return out;
}

function leaf(bx: number, by: number, tx: number, ty: number, w: number) {
  const mx = (bx + tx) / 2;
  const my = (by + ty) / 2;
  const dx = tx - bx;
  const dy = ty - by;
  const len = Math.hypot(dx, dy);
  const nx = (-dy / len) * w;
  const ny = (dx / len) * w;
  return `M${bx} ${by} Q${(mx + nx).toFixed(1)} ${(my + ny).toFixed(1)} ${tx} ${ty} Q${(mx - nx).toFixed(1)} ${(my - ny).toFixed(1)} ${bx} ${by} Z`;
}

function flower(x: number, y: number, r: number, pr: number): Fill[] {
  return [
    ...[0, 1, 2, 3, 4].map((i) => ({
      d: circ(+(x + r * Math.cos(i * 1.2566 - 1.5708)).toFixed(1), +(y + r * Math.sin(i * 1.2566 - 1.5708)).toFixed(1), pr),
      c: CORAL,
    })),
    { d: circ(x, y, pr * 0.8), c: GOLD },
  ];
}

function rib(x0: number, x1: number, y0: number, y1: number) {
  const out: string[] = [];
  for (let x = x0 + 2.5; x < x1 - 1; x += 2.5) out.push(`M${x.toFixed(1)} ${y0} L${x.toFixed(1)} ${y1}`);
  return out;
}

const colF =
  'M43 10 C47 11 53 11 57 10 L64 26 C67 30 67 34 65 38 C64 44 64 50 66 58 C68 72 69 88 70 104 L30 104 C31 88 32 72 34 58 C36 50 36 44 35 38 C33 34 33 30 36 26 Z M47 14 C45 19 47 24 50 24 C53 24 55 19 53 14 C51 13 49 13 47 14 Z';
const trBody = 'M30 8 L70 8 L71 15 C75 40 79 68 83 92 L58 92 C56 70 53 48 50 32 C47 48 44 70 42 92 L17 92 C21 68 25 40 29 15 Z';
const trFr: Fill[] = [
  { d: 'M17 92 L42 92 L45 114 L13 114 Z', c: CREAM },
  { d: 'M58 92 L83 92 L87 114 L55 114 Z', c: CREAM },
];
const trFrL = [...fringe(13, 45, 96, 114, 6), ...fringe(55, 87, 96, 114, 6), 'M17 96 L42.5 96', 'M58 96 L83.5 96'];
const shBody = 'M36 10 L44 7 L50 13 L56 7 L64 10 L86 32 L79 42 L70 35 L71 104 C62 110 56 106 50 108 C44 106 38 110 29 104 L30 35 L21 42 L14 32 Z';
const knBody = 'M36 12 C42 18 58 18 64 12 L72 15 C80 22 86 30 88 36 L86 76 L76 76 L73 44 L73 104 L27 104 L27 44 L24 76 L14 76 L12 36 C14 30 20 22 28 15 Z';
const cable = [
  'M45 30 C41 36 53 40 49 46 C45 52 57 56 53 62 C49 68 61 72 57 78 C53 84 59 88 55 92',
  'M55 30 C59 36 47 40 51 46 C55 52 43 56 47 62 C51 68 39 72 43 78 C47 84 41 88 45 92',
];
const print: Fill[] = [
  ...([
    [38, 66],
    [44, 61],
    [50, 59],
    [56, 61],
    [62, 66],
  ] as const).map(([tx, ty]) => ({ d: leaf(50, 90, tx, ty, 2.6), c: GOLD })),
  { d: leaf(37, 62, 43, 47, 2.2), c: GOLD },
  { d: leaf(63, 62, 57, 47, 2.2), c: GOLD },
  { d: leaf(34, 98, 40, 86, 2), c: CORAL },
  { d: leaf(66, 98, 60, 86, 2), c: CORAL },
  ...flower(50, 91, 3.2, 2.2),
  ...flower(43, 52, 1.9, 1.3),
  ...flower(57, 52, 1.9, 1.3),
];
const tassels = (() => {
  const fills: Fill[] = [];
  const lines: string[] = [];
  for (let x = 32.5; x <= 68; x += 4.4) {
    fills.push({
      d: `M${(x - 1.5).toFixed(1)} 107 L${(x + 1.5).toFixed(1)} 107 L${(x + 2.1).toFixed(1)} 115 L${(x - 2.1).toFixed(1)} 115 Z`,
      c: TASSEL,
    });
    lines.push(`M${x.toFixed(1)} 104 L${x.toFixed(1)} 107`, `M${x.toFixed(1)} 109 L${x.toFixed(1)} 115`);
  }
  return { fills, lines };
})();

const VIEWS: Record<string, View> = {
  dress: {
    fills: [
      { d: colF, c: PEACH },
      ...print,
      { d: 'M42 4 C46 2 54 2 58 4 L57 10 C53 9 47 9 43 10 Z', c: PEACH },
      { d: 'M50 4 C44 -3 39 2 46 6 Z', c: PEACH },
      { d: 'M50 4 C56 -3 61 2 54 6 Z', c: PEACH },
      { d: circ(50, 4.5, 2), c: GOLD },
      ...tassels.fills,
      { d: circ(50, 37, 2), c: PEACH },
    ],
    lines: ['M36 28 C44 30 48 34 50 37', 'M64 28 C56 30 52 34 50 37', 'M35.5 35 C42 34 46 35 48 37', 'M64.5 35 C58 34 54 35 52 37', 'M35 40 C45 42 55 42 65 40', ...tassels.lines],
    stitch: ['M31 101 L69 101'],
  },
  shirt: {
    fills: [
      { d: shBody, c: SAGE },
      { d: 'M44 7 L50 13 L56 7 L59 12 L50 20 L41 12 Z', c: SAGE },
      ...[28, 42, 56, 70, 84].map((y) => ({ d: circ(50, y, 1.6), c: CREAM })),
    ],
    lines: ['M47.5 20 L47.5 107', 'M52.5 20 L52.5 107', 'M33 46 L44 46 L44 58 L38.5 61 L33 58 Z', 'M17.5 29.5 L24.5 39.5', 'M82.5 29.5 L75.5 39.5', 'M30 35 L36 10', 'M70 35 L64 10'],
    stitch: ['M33 49 L44 49', 'M30 101 C38 106 44 103 50 105 C56 103 62 106 70 101'],
  },
  trouser: {
    fills: [{ d: trBody, c: TAN }, ...trFr],
    lines: ['M29.5 15 L70.5 15', 'M50 15 L50 32', 'M32 15 C34 22 37 25 41 26', 'M68 15 C66 22 63 25 59 26', 'M38 8 L38 15', 'M62 8 L62 15', ...trFrL],
    stitch: ['M54 15 L54 27 C54 30 52 31.5 50 32', 'M30 11.5 L70 11.5'],
  },
  knit: {
    fills: [
      { d: knBody, c: OCHRE },
      { d: 'M36 12 C42 18 58 18 64 12 L61 15 C56 21 44 21 39 15 Z', c: RIB },
    ],
    lines: [...cable, 'M27 96 L73 96', ...rib(27, 73, 96, 104), 'M14.2 70 L24.4 70', 'M85.8 70 L75.6 70', ...rib(14, 24.5, 70, 76), ...rib(75.5, 86, 70, 76), 'M27 44 L28 15', 'M73 44 L72 15'],
    stitch: [],
  },
};

const GHOSTS = [
  { key: 'dress', label: 'Style name and number', opacity: 1, background: '#F3EFE6' },
  { key: 'shirt', label: 'Colourways', opacity: 0.85, background: 'transparent' },
  { key: 'trouser', label: 'Production stage', opacity: 0.7, background: 'transparent' },
  { key: 'knit', label: 'Ex-factory date', opacity: 0.55, background: 'transparent' },
] as const;

function GhostFlat({ name }: { name: string }) {
  const view = VIEWS[name];
  return (
    <svg viewBox="0 -4 100 124" aria-hidden="true">
      {view.fills.map((fill) => (
        <path key={fill.d} d={fill.d} fill={fill.c} fillRule="evenodd" />
      ))}
      {view.lines.map((d) => (
        <path key={d} d={d} />
      ))}
      {view.stitch.map((d) => (
        <path key={d} d={d} strokeWidth="0.6" strokeDasharray="1.6 1.4" />
      ))}
    </svg>
  );
}

export function EmptyGhosts() {
  return (
    <div className="empty-ghosts">
      {GHOSTS.map((ghost) => (
        <Link className="empty-ghost" key={ghost.key} to="/styles/sample" style={{ opacity: ghost.opacity }} aria-label="Open the empty style card">
          <div className="swatch" style={{ background: ghost.background }}>
            <GhostFlat name={ghost.key} />
          </div>
          <span className="empty-ghost-bar" />
          <div className="empty-ghost-chips">
            <span />
            <span />
          </div>
          <div className="empty-ghost-dots">
            {Array.from({ length: 9 }, (_, index) => (
              <span key={index} />
            ))}
          </div>
          <span className="empty-ghost-label">{ghost.label}</span>
        </Link>
      ))}
    </div>
  );
}
