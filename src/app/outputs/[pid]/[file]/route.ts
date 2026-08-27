import { requireOwnedShoot } from '@/lib/shoots';
import { storage, shootKey, baseName } from '@/lib/storage';
import { handler, HttpError } from '@/lib/api';
import { applyWatermark, shouldWatermark, imageCacheHeaders } from '@/lib/watermark';
import { parseVariant, readVariant } from '@/lib/derivatives';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  mp4: 'video/mp4',
};

/**
 * Serve a generated shoot image.
 *
 * The old app mounted this folder as public static files — anyone with a URL
 * could read anyone's images. Here it goes through the same ownership check as
 * the rest of the shoot API, so customers' shoots aren't world-readable.
 *
 * The URL shape (/outputs/<pid>/<file>) is unchanged, so every image URL stored
 * in a migrated log row still resolves.
 *
 * Free-tier accounts get the watermark stamped on here, on the way out — the
 * bytes on disk are always clean. See lib/watermark.ts.
 *
 * `?v=thumb` / `?v=web` serve the small WebP derivatives the UI renders; without
 * it the untouched original comes back, which is what the download routes and
 * every pre-existing stored URL rely on. See lib/derivatives.ts.
 */
export const GET = handler(
  async (req: Request, ctx: { params: Promise<{ pid: string; file: string }> }) => {
    const { pid, file } = await ctx.params;
    const { user } = await requireOwnedShoot(pid);

    const name = baseName(decodeURIComponent(file));

    // ── video ──────────────────────────────────────────────────────────
    // A generated clip lives in the same shoot folder and behind the same
    // ownership check, but none of what follows applies to it: there are no
    // WebP derivatives of an mp4, and sharp cannot watermark one. It also has
    // to answer Range requests — Safari will not play a video at all from a
    // plain 200, and seeking anywhere needs it.
    if (name.toLowerCase().endsWith('.mp4')) {
      const bytes = await storage.get(shootKey(pid, name));
      if (!bytes) throw new HttpError(404, 'Not found');

      const range = req.headers.get('range');
      const m = range?.match(/bytes=(\d*)-(\d*)/);
      if (m) {
        const start = m[1] ? Number(m[1]) : 0;
        const end = m[2] ? Math.min(Number(m[2]), bytes.length - 1) : bytes.length - 1;
        if (start >= bytes.length || start > end) {
          return new Response(null, {
            status: 416,
            headers: { 'Content-Range': `bytes */${bytes.length}` },
          });
        }
        const slice = bytes.subarray(start, end + 1);
        return new Response(new Uint8Array(slice), {
          status: 206,
          headers: {
            'Content-Type': 'video/mp4',
            'Content-Length': String(slice.length),
            'Content-Range': `bytes ${start}-${end}/${bytes.length}`,
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'private, max-age=3600',
          },
        });
      }
      return new Response(new Uint8Array(bytes), {
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Length': String(bytes.length),
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'private, max-age=3600',
        },
      });
    }

    const variant = parseVariant(new URL(req.url).searchParams.get('v'));
    const wm = shouldWatermark(user);
    // The variant is part of the identity of the response, so thumb and web
    // can't collide in the browser cache under one ETag.
    const { etag, cacheControl } = imageCacheHeaders(`${pid}/${name}/${variant ?? 'orig'}`, wm);

    // Revalidation hit — the watermark state is baked into the ETag, so a user
    // who has paid since their last visit misses here and gets clean bytes.
    if (req.headers.get('if-none-match') === etag) {
      return new Response(null, {
        status: 304,
        headers: { ETag: etag, 'Cache-Control': cacheControl },
      });
    }

    const key = shootKey(pid, name);
    const read = variant ? await readVariant(key, variant) : null;
    const stored = variant ? read?.bytes : await storage.get(key);
    if (!stored) throw new HttpError(404, 'Not found');

    // A derivative that fell back to the original is still JPEG/PNG, so the
    // content type follows what was actually read rather than what was asked for.
    const isWebp = !!read?.webp;
    const ext = name.split('.').pop()?.toLowerCase() ?? 'jpg';
    const bytes = wm ? await applyWatermark(stored, isWebp ? 'webp' : 'jpeg') : stored;

    const type = isWebp
      ? 'image/webp'
      : wm
        ? 'image/jpeg' // watermarking a non-WebP always re-encodes as JPEG
        : (MIME[ext] ?? 'application/octet-stream');

    return new Response(new Uint8Array(bytes), {
      headers: {
        'Content-Type': type,
        'Content-Length': String(bytes.length),
        ETag: etag,
        // Private because the response is per-user authorised — and, for a
        // watermarked image, revalidated because a purchase can make it clean.
        'Cache-Control': cacheControl,
      },
    });
  },
);