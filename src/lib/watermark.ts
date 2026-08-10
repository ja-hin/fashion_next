/**
 * Free-tier watermarking.
 *
 * Generated images are ALWAYS stored clean. The watermark is applied at serve
 * time, on the way out, based on whether the requesting account has ever paid.
 * That is what makes the unlock retroactive: the moment a Razorpay payment is
 * credited, every image the user has ever generated starts serving clean, with
 * no re-processing and no second copy on disk.
 *
 * The mark is the brand logo repeated diagonally across the whole frame at low
 * opacity — deliberately not croppable, because a free-tier image is a preview
 * of what the paid product looks like, not a deliverable.
 */
import 'server-only';
import path from 'node:path';
import sharp from 'sharp';
import { WATERMARK_ENABLED, WATERMARK_LOGO, WATERMARK_OPACITY } from './config';
import type { UserDoc } from './types';

const LOGO_PATH = path.join(process.cwd(), 'public', WATERMARK_LOGO);

/** Tilt of each stamp, in degrees. Negative = bottom-left to top-right. */
const ANGLE = -30;
/** Logo width as a fraction of the image width. */
const RELATIVE_WIDTH = 0.2;
const MIN_TILE_PX = 90;
const MAX_TILE_PX = 420;
/** Transparent padding around each stamp, as a fraction of the logo width. */
const GAP_RATIO = 0.5;

const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 } as const;
const JPEG = { quality: 90, mozjpeg: true } as const;
const WEBP = { quality: 80 } as const;

const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), hi);

/**
 * Building a tile costs a resize, an alpha multiply and a rotate. The result
 * depends only on the logo width, so bucket it to the nearest 20px and cache —
 * a gallery of 30 images then builds one tile instead of thirty.
 */
const tileCache = new Map<number, Promise<Buffer>>();

async function buildTile(logoW: number): Promise<Buffer> {
  const { data, info } = await sharp(LOGO_PATH)
    .ensureAlpha()
    .resize({ width: logoW, fit: 'inside' })
    .toBuffer({ resolveWithObject: true });

  // Multiply the logo's own alpha by WATERMARK_OPACITY. `dest-in` keeps the
  // destination only where the source has alpha, so a flat translucent layer
  // scales the whole mask uniformly and leaves the logo's shape intact.
  const faded = await sharp(data)
    .composite([
      {
        input: {
          create: {
            width: info.width,
            height: info.height,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: WATERMARK_OPACITY },
          },
        },
        blend: 'dest-in',
      },
    ])
    .png()
    .toBuffer();

  const gap = Math.round(logoW * GAP_RATIO);

  // Rotate first, then pad: padding a rotated stamp keeps the gap even, whereas
  // rotating a padded one shrinks the spacing along the tilt axis.
  return sharp(faded)
    .rotate(ANGLE, { background: TRANSPARENT })
    .extend({
      top: Math.round(gap / 2),
      bottom: Math.round(gap / 2),
      left: Math.round(gap / 2),
      right: Math.round(gap / 2),
      background: TRANSPARENT,
    })
    .png()
    .toBuffer();
}

function tileFor(logoW: number): Promise<Buffer> {
  const bucket = clamp(Math.round(logoW / 20) * 20, MIN_TILE_PX, MAX_TILE_PX);
  let t = tileCache.get(bucket);
  if (!t) {
    t = buildTile(bucket).catch((e) => {
      tileCache.delete(bucket); // don't cache a failure — the next request retries
      throw e;
    });
    tileCache.set(bucket, t);
  }
  return t;
}

/**
 * Stamp the tiled logo across an image.
 *
 * `format` decides how the marked result is re-encoded. Downloads take the
 * default JPEG; on-screen images are already WebP derivatives (see
 * lib/derivatives.ts) and must stay WebP, or marking a 20 KB thumbnail would
 * hand the browser back a full-size JPEG and undo the whole saving.
 *
 * Because the mark is applied to the derivative rather than the original, a
 * free-tier gallery now composites 400px thumbnails instead of 2048px masters —
 * the same picture for the user, a fraction of the CPU.
 *
 * On any failure the ORIGINAL bytes are returned rather than an error: a
 * missing or corrupt logo file is a deployment problem, and a gallery of broken
 * thumbnails is a worse outcome than an unmarked image. The log line is loud
 * because it does mean free images are going out clean.
 */
export async function applyWatermark(
  buf: Buffer,
  format: 'jpeg' | 'webp' = 'jpeg',
): Promise<Buffer> {
  try {
    const meta = await sharp(buf).metadata();
    const width = meta.width ?? 1024;
    const tile = await tileFor(Math.round(width * RELATIVE_WIDTH));

    const marked = sharp(buf).composite([{ input: tile, tile: true, blend: 'over' }]);

    return await (format === 'webp' ? marked.webp(WEBP) : marked.jpeg(JPEG)).toBuffer();
  } catch (e) {
    console.error('[watermark] FAILED — serving the image unmarked', e);
    return buf;
  }
}

// ── who gets marked ─────────────────────────────────────────────────

/**
 * True when this account's images must carry the watermark.
 *
 * Paid once → clean forever, including everything generated on the free credits
 * beforehand. Admins are staff rather than customers and are never marked, so
 * demos and support screenshots come out clean.
 */
export function shouldWatermark(user: UserDoc): boolean {
  if (!WATERMARK_ENABLED) return false;
  if (user.is_admin) return false;
  return !user.first_paid_at;
}

/**
 * Cache headers for an image response.
 *
 * A watermarked image must revalidate, because a purchase can turn it clean at
 * any moment and a year-long immutable cache would keep showing the mark. Once
 * the account has paid the bytes really are final, so those cache hard. The
 * ETag carries the watermark state, so revalidation after a purchase returns
 * fresh bytes instead of a 304.
 */
export function imageCacheHeaders(key: string, watermarked: boolean) {
  return {
    etag: `"${watermarked ? 'wm' : 'clean'}-${key}"`,
    cacheControl: watermarked
      ? 'private, max-age=0, must-revalidate'
      : 'private, max-age=31536000, immutable',
  };
}
