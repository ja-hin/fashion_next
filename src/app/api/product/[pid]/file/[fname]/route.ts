import { handler, HttpError } from '@/lib/api';
import { requireOwnedShoot, shootFilePrefix } from '@/lib/shoots';
import { storage, shootKey, baseName } from '@/lib/storage';
import { safeName } from '@/lib/settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Download one image with a friendly, human-readable filename
 * (e.g. `summer_dress_arms_crossed.jpg` rather than `pose_a4f19c.jpg`).
 */
export const GET = handler(
  async (_req: Request, ctx: { params: Promise<{ pid: string; fname: string }> }) => {
    const { pid, fname } = await ctx.params;
    const { shoot } = await requireOwnedShoot(pid);

    const file = baseName(decodeURIComponent(fname));
    const bytes = await storage.get(shootKey(pid, file));
    if (!bytes) throw new HttpError(404, 'File not found');

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