/**
 * Image processing — the sharp port of the Pillow code in the old main.py.
 *
 * Four live operations:
 *   resizeInput        cap an upload at MAX_IMG_PX and normalise it to JPEG
 *   mockGenerate       the DEMO-mode placeholder image (no AI key needed)
 *   composeDisplayGrid tile 6 character-sheet frames into one 2x3 display grid
 *   looksHeadless      heuristic: is this on-model photo cropped at the head?
 */
import 'server-only';
import sharp from 'sharp';
import { MAX_IMG_PX } from './config';
import { AR_SIZE } from './prompts';

const JPEG = { quality: 92, mozjpeg: true } as const;

/** Thrown when an upload isn't a readable image — surfaced to the user as a 400. */
export class BadImageError extends Error {
  constructor(message = 'Could not read that image. Please upload a JPG, PNG, WebP or AVIF file.') {
    super(message);
    this.name = 'BadImageError';
  }
}

/**
 * Normalise an uploaded garment reference: strip alpha, cap the long edge at
 * MAX_IMG_PX and re-encode as JPEG. Everything downstream assumes JPEG bytes.
 */
export async function resizeInput(buf: Buffer): Promise<Buffer> {
  let meta: sharp.Metadata;
  try {
    meta = await sharp(buf).metadata();
  } catch {
    throw new BadImageError();
  }
  if (!meta.width || !meta.height) throw new BadImageError();

  try {
    let img = sharp(buf).rotate().flatten({ background: '#ffffff' });
    if (Math.max(meta.width, meta.height) > MAX_IMG_PX) {
      img = img.resize({
        width: meta.width >= meta.height ? MAX_IMG_PX : undefined,
        height: meta.height > meta.width ? MAX_IMG_PX : undefined,
        fit: 'inside',
        withoutEnlargement: true,
      });
    }
    return await img.jpeg(JPEG).toBuffer();
  } catch {
    throw new BadImageError();
  }
}

/** Deterministic PRNG so a given seed always yields the same demo image. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const escXml = (s: string) =>
  String(s ?? '').replace(/[<>&"']/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]!,
  );

/**
 * DEMO-mode placeholder: a seeded gradient with a simple figure and a caption.
 * Lets the whole flow be clicked through end to end with no API key.
 */
export async function mockGenerate(
  seed: number | null,
  ar: string,
  pose: string,
): Promise<Buffer> {
  const [w, h] = AR_SIZE[ar] ?? AR_SIZE['4:5'];
  const rnd = mulberry32(seed || 1);

  const top = [
    150 + Math.floor(rnd() * 76),
    140 + Math.floor(rnd() * 76),
    135 + Math.floor(rnd() * 76),
  ];
  const bot = top.map((c) => Math.max(0, c - 45));
  const rgb = (c: number[]) => `rgb(${c[0]},${c[1]},${c[2]})`;

  const cx = Math.floor(w / 2);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="${rgb(top)}"/><stop offset="100%" stop-color="${rgb(bot)}"/>
  </linearGradient></defs>
  <rect width="${w}" height="${h}" fill="url(#g)"/>
  <ellipse cx="${cx}" cy="165" rx="95" ry="95" fill="rgb(228,206,190)"/>
  <rect x="${cx - 160}" y="260" width="320" height="${Math.max(0, h - 300)}" fill="rgb(236,236,236)"/>
  <text x="28" y="46" font-family="sans-serif" font-size="26" font-weight="700" fill="rgb(25,25,25)">DEMO · ${escXml(pose)}</text>
  <text x="28" y="78" font-family="sans-serif" font-size="20" fill="rgb(25,25,25)">seed ${seed ?? 0} · ${escXml(ar)}</text>
</svg>`;

  return sharp(Buffer.from(svg)).jpeg(JPEG).toBuffer();
}

/**
 * Assemble 6 individual hi-res frames into one 2x3 display grid for the model
 * folder view. Each frame is resized to a consistent cell, then tiled with a
 * thin black separator (the black background shows through the gaps).
 */
export async function composeDisplayGrid(frames: Buffer[]): Promise<Buffer> {
  const COLS = 2;
  const ROWS = 3;
  const CELL_W = 400;
  const CELL_H = 533; // ~4:5 per cell
  const SEP = 4; // black separator, in px

  const gridW = CELL_W * COLS + SEP * (COLS + 1);
  const gridH = CELL_H * ROWS + SEP * (ROWS + 1);

  const cells = await Promise.all(
    frames.slice(0, COLS * ROWS).map(async (fb, idx) => {
      const row = Math.floor(idx / COLS);
      const col = idx % COLS;
      const input = await sharp(fb)
        .resize(CELL_W, CELL_H, { fit: 'fill', kernel: 'lanczos3' })
        .toBuffer();
      return {
        input,
        left: SEP + col * (CELL_W + SEP),
        top: SEP + row * (CELL_H + SEP),
      };
    }),
  );

  return sharp({
    create: {
      width: gridW,
      height: gridH,
      channels: 3,
      background: { r: 0, g: 0, b: 0 }, // black = the separator colour
    },
  })
    .composite(cells)
    .jpeg(JPEG)
    .toBuffer();
}

/**
 * Best-effort: true when an uploaded on-model photo looks like it's missing or
 * cropped at the head. Deliberately conservative — it only flags when the top
 * centre band has body content but almost no skin tone, i.e. shoulders and
 * garment with the head cut off above the frame.
 *
 * A false negative just means we skip the head-completion pass, so erring
 * towards "not headless" is the safe direction.
 */
export async function looksHeadless(buf: Buffer): Promise<boolean> {
  try {
    const { data, info } = await sharp(buf)
      .rotate()
      .resize(360, 480, { fit: 'inside', withoutEnlargement: true })
      .removeAlpha()
      .toColorspace('srgb')
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { width: w, height: h, channels } = info;
    if (!w || !h) return false;

    const at = (x: number, y: number): [number, number, number] => {
      const i = (y * w + x) * channels;
      return [data[i], data[i + 1], data[i + 2]];
    };

    const cx0 = Math.trunc(w * 0.3);
    const cx1 = Math.trunc(w * 0.7);
    if (cx1 <= cx0) return false;

    const bg = at(4 < w ? 4 : 0, 4 < h ? 4 : 0);
    const diff = (p: [number, number, number], q: [number, number, number]) =>
      Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) + Math.abs(p[2] - q[2]);

    // Where does actual content start, down the centre of the frame?
    let contentTop: number | null = null;
    for (let y = 0; y < h; y++) {
      let n = 0;
      let hits = 0;
      for (let x = cx0; x < cx1; x += 4) {
        n++;
        if (diff(at(x, y), bg) > 45) hits++;
      }
      if (n > 0 && hits > n * 0.25) {
        contentTop = y;
        break;
      }
    }
    if (contentTop === null) return false;

    // How much of the top band is skin-toned?
    let skin = 0;
    let tot = 0;
    const bandBottom = Math.trunc(h * 0.32);
    for (let y = contentTop; y < bandBottom; y++) {
      for (let x = cx0; x < cx1; x += 4) {
        const [r, g, b] = at(x, y);
        tot++;
        if (r > 120 && r >= g && g >= b && r - b > 12 && r + g + b > 250) skin++;
      }
    }
    if (tot === 0) return true;

    // Content near the top but almost no skin → shoulders/garment, head cropped.
    return skin / tot < 0.06;
  } catch {
    return false;
  }
}