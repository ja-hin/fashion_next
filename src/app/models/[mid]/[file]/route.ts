import { requireOwnedModel } from '@/lib/saved-models';
import { storage, modelKey, baseName } from '@/lib/storage';
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
};

/**
 * Serve a saved model's reference image, gated by the same ownership check as
 * the model API. URL shape (/models/<mid>/<file>) matches the old app.
 *
 * Character sheets are generated (and charged for) like any other image, so
 * free-tier accounts see them watermarked too.
 *
 * `?v=thumb` / `?v=web` serve the WebP derivatives the UI renders; without it
 * the untouched original comes back. See lib/derivatives.ts.
 */
export const GET = handler(
  async (req: Request, ctx: { params: Promise<{ mid: string; file: string }> }) => {
    const { mid, file } = await ctx.params;
    const { user } = await requireOwnedModel(mid);

    const name = baseName(decodeURIComponent(file));
    const variant = parseVariant(new URL(req.url).searchParams.get('v'));
    const wm = shouldWatermark(user);
    const { etag, cacheControl } = imageCacheHeaders(`${mid}/${name}/${variant ?? 'orig'}`, wm);

    if (req.headers.get('if-none-match') === etag) {
      return new Response(null, {
        status: 304,
        headers: { ETag: etag, 'Cache-Control': cacheControl },
      });
    }

    const key = modelKey(mid, name);
    const read = variant ? await readVariant(key, variant) : null;
    const stored = variant ? read?.bytes : await storage.get(key);
    if (!stored) throw new HttpError(404, 'Not found');

    const isWebp = !!read?.webp;
    const ext = name.split('.').pop()?.toLowerCase() ?? 'jpg';
    const bytes = wm ? await applyWatermark(stored, isWebp ? 'webp' : 'jpeg') : stored;

    const type = isWebp
      ? 'image/webp'
      : wm
        ? 'image/jpeg'
        : (MIME[ext] ?? 'application/octet-stream');

    return new Response(new Uint8Array(bytes), {
      headers: {
        'Content-Type': type,
        'Content-Length': String(bytes.length),
        ETag: etag,
        'Cache-Control': cacheControl,
      },
    });
  },
);