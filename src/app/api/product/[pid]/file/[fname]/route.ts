import { handler, HttpError } from '@/lib/api';
import { requireOwnedShoot, shootFilePrefix } from '@/lib/shoots';
import { storage, shootKey, baseName } from '@/lib/storage';
import { safeName } from '@/lib/settings';
import { applyWatermark, shouldWatermark } from '@/lib/watermark';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Download one image with a friendly, human-readable filename
 * (e.g. `summer_dress_arms_crossed.jpg` rather than `pose_a4f19c.jpg`).
 *
 * Watermarked for free-tier accounts, exactly as the on-screen image is — a
 * download that came out clean would make the mark pointless.
 */
export const GET = handler(
  async (_req: Request, ctx: { params: Promise<{ pid: string; fname: string }> }) => {
    const { pid, fname } = await ctx.params;
    const { user, shoot } = await requireOwnedShoot(pid);

    const file = baseName(decodeURIComponent(fname));
    const stored = await storage.get(shootKey(pid, file));
    if (!stored) throw new HttpError(404, 'File not found');

    const bytes = shouldWatermark(user) ? await applyWatermark(stored) : stored;

    const pose = shoot.manifest?.find((m) => m.file === file)?.pose ?? 'image';
    const dl = `${shootFilePrefix(shoot)}_${safeName(pose)}.jpg`;

    return new Response(new Uint8Array(bytes), {
      headers: {
        'Content-Type': 'image/jpeg',
        'Content-Length': String(bytes.length),
        'Content-Disposition': `attachment; filename="${dl}"`,
      },
    });
  },
);