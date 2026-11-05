/** Line drawings from the range-board reference. They illustrate a garment type. They are not product photos. */
const FLATS = {
  dress: ['M38 10 L46 14 Q50 19 54 14 L62 10 L72 22 L64 30 L66 48 L82 108 L18 108 L34 48 L36 30 L28 22 Z', 'M34 48 L66 48'],
  shirt: ['M36 12 L44 9 L50 20 L56 9 L64 12 L88 36 L80 46 L70 38 L70 106 L30 106 L30 38 L20 46 L12 36 Z', 'M50 20 L50 106'],
  trouser: ['M28 10 L72 10 L76 110 L56 110 L50 40 L44 110 L24 110 Z', 'M28 18 L72 18'],
  jacket: ['M34 12 L44 9 L50 14 L56 9 L66 12 L90 40 L82 50 L72 42 L72 108 L28 108 L28 42 L18 50 L10 40 Z', 'M44 9 L50 52 L56 9'],
  skirt: ['M32 14 L68 14 L84 106 L16 106 Z', 'M32 22 L68 22'],
  knit: ['M36 14 Q50 24 64 14 L88 32 L84 74 L74 72 L72 44 L72 106 L28 106 L28 44 L26 72 L16 74 L12 32 Z', 'M28 98 L72 98'],
} as const;

const NAMED_COLOURS: Record<string, string> = {
  black: '#1D1D1B',
  white: '#F7F4EE',
  chalk: '#EFEDE6',
  ivory: '#F3EDE2',
  cream: '#F4EFE4',
  navy: '#2A3142',
  ink: '#2A3142',
  blue: '#6E8198',
  sage: '#A7B59A',
  green: '#7E8F62',
  olive: '#6C6B45',
  khaki: '#9C8F6A',
  stone: '#C9C1B1',
  sand: '#D8CDB8',
  beige: '#D8CDB8',
  brown: '#8A6A4A',
  rust: '#A4552F',
  coral: '#C97F66',
  pink: '#D8A5A1',
  red: '#A45048',
  peach: '#E5BBA4',
  butter: '#E9D98A',
  yellow: '#E9D98A',
  gold: '#C4A35A',
  grey: '#B7B1A8',
  gray: '#B7B1A8',
  charcoal: '#4A423A',
  bone: '#EDE8DC',
  frost: '#E8E6DF',
};

export function garmentPaths(name: string): readonly [string, string] {
  const text = name.toLowerCase();
  if (/skirt/.test(text)) return FLATS.skirt;
  if (/trouser|pant|short/.test(text)) return FLATS.trouser;
  if (/jacket|coat|blazer/.test(text)) return FLATS.jacket;
  if (/knit|sweater|jumper|cardigan/.test(text)) return FLATS.knit;
  if (/shirt|blouse|\btop\b|tee|cami/.test(text)) return FLATS.shirt;
  return FLATS.dress;
}

export function colourChips(value: string): { name: string; hex: string }[] {
  const parts = value
    .split(/\s*(?:,|\/|&|\+)\s*/)
    .map((part) => part.trim())
    .filter((part) => part && part !== '—');
  return parts.slice(0, 4).map((name) => ({ name, hex: hexForColour(name) }));
}

export function washFor(hex: string | undefined): string {
  if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return '#E6E0D4';
  const value = Number.parseInt(hex.slice(1), 16);
  const mix = (channel: number) => Math.round(channel * 0.28 + 237 * 0.72);
  return `rgb(${mix(value >> 16)}, ${mix((value >> 8) & 255)}, ${mix(value & 255)})`;
}

function hexForColour(name: string): string {
  const key = name.toLowerCase();
  if (NAMED_COLOURS[key]) return NAMED_COLOURS[key];
  for (const [word, hex] of Object.entries(NAMED_COLOURS)) {
    if (key.includes(word)) return hex;
  }
  return '#E4DDD0';
}
