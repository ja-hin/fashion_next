import { requireOwnedShoot } from '@/lib/shoots';
import { storage, shootKey, baseName } from '@/lib/storage';
import { handler, HttpError } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
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
 */
export const GET = handler(
  async (_req: Request, ctx: { params: Promise<{ pid: string; file: string }> }) => {
    const { pid, file } = await ctx.params;
    await requireOwnedShoot(pid);

    const name = baseName(decodeURIComponent(file));
    const bytes = await storage.get(shootKey(pid, name));
    if (!bytes) throw new HttpError(404, 'Not found');

    const ext = name.split('.').pop()?.toLowerCase() ?? 'jpg';

    return new Response(new Uint8Array(bytes), {
      headers: {
        'Content-Type': MIME[ext] ?? 'application/octet-stream',
        'Content-Length': String(bytes.length),
        // Filenames are content-addressed (random suffix per image) and never
        // rewritten, so they're safe to cache hard — but privately, since the
        // response is per-user authorised.
        'Cache-Control': 'private, max-age=31536000, immutable',
      },
    });
  },
);