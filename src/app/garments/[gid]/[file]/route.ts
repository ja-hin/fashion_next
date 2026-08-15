import { requireOwnedGarment } from '@/lib/garments';
import { storage, garmentKey, baseName } from '@/lib/storage';
import { handler, HttpError } from '@/lib/api';
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
 * Serve a saved garment's reference image, gated by the same ownership check as
 * the garment API. URL shape mirrors /outputs and /models.
 *
 * Never watermarked: these are the user's own product photographs, not
 * something this app generated. Marking someone's own upload would be absurd.
 *
 * `?v=thumb` / `?v=web` serve the WebP derivatives the library grid renders.
 */
export const GET = handler(
  async (req: Request, ctx: { params: Promise<{ gid: string; file: string }> }) => {
    const { gid, file } = await ctx.params;
    await requireOwnedGarment(gid);

    const name = baseName(decodeURIComponent(file));
    const variant = parseVariant(new URL(req.url).searchParams.get('v'));

    const key = garmentKey(gid, name);
    const read = variant ? await readVariant(key, variant) : null;
    const bytes = variant ? read?.bytes : await storage.get(key);
    if (!bytes) throw new HttpError(404, 'Not found');

    const ext = name.split('.').pop()?.toLowerCase() ?? 'jpg';

    return new Response(new Uint8Array(bytes), {
      headers: {
        'Content-Type': read?.webp ? 'image/webp' : (MIME[ext] ?? 'application/octet-stream'),
        'Content-Length': String(bytes.length),
        // Uploads never change once stored — a new upload is a new garment — so
        // this can cache hard. Private because it is per-user authorised.
        'Cache-Control': 'private, max-age=31536000, immutable',
      },
    });
  },
);
