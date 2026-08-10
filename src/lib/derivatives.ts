/**
 * Display derivatives — the WebP copies the browser actually renders.
 *
 * The original bytes a generation produced are NEVER modified and never served
 * to a gallery. They sit in storage untouched and come back out only through the
 * download routes, so "what the customer downloads" stays exactly what the model
 * produced. Everything on screen is a WebP derivative instead:
 *
 *    outputs/<pid>/pose_x.jpg              the original — downloads only
 *    outputs/<pid>/pose_x.jpg.web.webp     1400px — result grid, lightbox
 *    outputs/<pid>/pose_x.jpg.thumb.webp   400px  — gallery cards, pickers
 *
 * A gallery card is 230px wide and used to pull a 2–3 MB full-resolution JPEG;
 * it now pulls ~20 KB. That single ratio is the whole point of this module.
 *
 * Derivative keys are the original key plus a suffix, which keeps them in the
 * same folder — so `removePrefix` on a shoot still takes everything with it.
 */
import 'server-only';
import sharp from 'sharp';
import { storage } from './storage';

export type ImageVariant = 'web' | 'thumb';

const SPEC: Record<ImageVariant, { width: number; quality: number }> = {
  web: { width: 1400, quality: 80 },
  thumb: { width: 400, quality: 75 },
};

export const VARIANTS = Object.keys(SPEC) as ImageVariant[];

/** Storage key of one derivative of `key`. */
export const variantKey = (key: string, v: ImageVariant) => `${key}.${v}.webp`;

/** Every derivative key belonging to `key`. */
export const variantKeys = (key: string) => VARIANTS.map((v) => variantKey(key, v));

/** Read a `?v=` query value, ignoring anything that isn't a known variant. */
export function parseVariant(v: string | null | undefined): ImageVariant | null {
  return v === 'web' || v === 'thumb' ? v : null;
}

function encode(src: Buffer, v: ImageVariant): Promise<Buffer> {
  const { width, quality } = SPEC[v];
  return (
    sharp(src)
      // Uploaded "extend" photos come straight off a phone and can carry an EXIF
      // rotation. Bake it in before resizing, or the derivative is sideways.
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality })
      .toBuffer()
  );
}

/**
 * Build and store both derivatives for an image that has just been written.
 *
 * Never throws. By the time this runs the original is already saved and the
 * user's wallet has already been charged — losing that over a failed thumbnail
 * would be absurd, and `readVariant` falls back to the original anyway.
 */
export async function writeDerivatives(key: string, src: Buffer): Promise<void> {
  await Promise.all(
    VARIANTS.map(async (v) => {
      try {
        await storage.put(variantKey(key, v), await encode(src, v));
      } catch (e) {
        console.error(`[derivatives] ${v} failed for ${key} — display falls back to the original`, e);
      }
    }),
  );
}

/** Drop an image's derivatives. Call wherever the original is removed. */
export async function removeDerivatives(key: string): Promise<void> {
  await Promise.all(variantKeys(key).map((k) => storage.remove(k)));
}

/**
 * Two things can ask for the same missing derivative at once — a gallery of 20
 * cards, or React rendering the same card twice. Share the encode rather than
 * running it twice and racing on the write.
 */
const inFlight = new Map<string, Promise<Buffer | null>>();

function backfill(key: string, v: ImageVariant, orig: Buffer): Promise<Buffer | null> {
  const vk = variantKey(key, v);
  let p = inFlight.get(vk);
  if (!p) {
    p = encode(orig, v)
      .then(async (out) => {
        await storage.put(vk, out);
        return out;
      })
      .catch((e) => {
        console.error(`[derivatives] backfill of ${vk} failed — serving the original`, e);
        return null;
      })
      .finally(() => inFlight.delete(vk));
    inFlight.set(vk, p);
  }
  return p;
}

export interface VariantRead {
  bytes: Buffer;
  /** False when the derivative was unavailable and these are the original bytes. */
  webp: boolean;
}

/**
 * Bytes to serve for a requested variant.
 *
 * Missing derivatives are generated on first request and kept, so every image
 * created before this module existed becomes fast after one view — there is no
 * migration to run. Null means the original itself is gone (a genuine 404).
 */
export async function readVariant(key: string, v: ImageVariant): Promise<VariantRead | null> {
  const hit = await storage.get(variantKey(key, v));
  if (hit) return { bytes: hit, webp: true };

  const orig = await storage.get(key);
  if (!orig) return null;

  const made = await backfill(key, v, orig);
  return made ? { bytes: made, webp: true } : { bytes: orig, webp: false };
}
