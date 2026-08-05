import { requireOwnedModel } from '@/lib/saved-models';
import { storage, modelKey, baseName } from '@/lib/storage';
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
 * Serve a saved model's reference image, gated by the same ownership check as
 * the model API. URL shape (/models/<mid>/<file>) matches the old app.
 */
export const GET = handler(
  async (_req: Request, ctx: { params: Promise<{ mid: string; file: string }> }) => {
    const { mid, file } = await ctx.params;
    await requireOwnedModel(mid);

    const name = baseName(decodeURIComponent(file));
    const bytes = await storage.get(modelKey(mid, name));
    if (!bytes) throw new HttpError(404, 'Not found');

    const ext = name.split('.').pop()?.toLowerCase() ?? 'jpg';

    return new Response(new Uint8Array(bytes), {
      headers: {
        'Content-Type': MIME[ext] ?? 'application/octet-stream',
        'Content-Length': String(bytes.length),
        'Cache-Control': 'private, max-age=31536000, immutable',
      },
    });
  },
);