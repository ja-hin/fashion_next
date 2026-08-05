import { handler, json } from '@/lib/api';
import { requireOwnedShoot, deleteShoot } from '@/lib/shoots';
import { storage, shootPrefix } from '@/lib/storage';

export const runtime = 'nodejs';

/**
 * Delete a whole shoot: every generated image, the garment reference, and the
 * shoot record. Irreversible — the UI confirms before calling this.
 *
 * Saved models made from this shoot are deliberately untouched: their reference
 * images were copied at save time precisely so they'd outlive the shoot.
 */
export const DELETE = handler(
  async (_req: Request, ctx: { params: Promise<{ pid: string }> }) => {
    const { pid } = await ctx.params;
    await requireOwnedShoot(pid);

    await storage.removePrefix(shootPrefix(pid));
    await deleteShoot(pid);

    return json({ ok: true, pid });
  },
);