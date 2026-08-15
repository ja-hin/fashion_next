import { handler, json, formData, str, HttpError } from '@/lib/api';
import { requireOwnedGarment, deleteGarmentDoc, updateGarment, publicGarment, loadGarment } from '@/lib/garments';
import { storage, garmentPrefix } from '@/lib/storage';

export const runtime = 'nodejs';

/** Rename a saved garment. */
export const PATCH = handler(
  async (req: Request, ctx: { params: Promise<{ gid: string }> }) => {
    const { gid } = await ctx.params;
    await requireOwnedGarment(gid);

    const name = str(await formData(req), 'name').trim().slice(0, 80);
    if (!name) throw new HttpError(400, 'Give this garment a name.');

    await updateGarment(gid, { name });
    const fresh = await loadGarment(gid);
    return json({ ok: true, garment: fresh ? publicGarment(fresh) : null });
  },
);

/**
 * Delete a garment and its images.
 *
 * Shoots already made from it are untouched — their references were copied into
 * the shoot's own folder when it was created, exactly so that deleting the
 * library entry cannot break finished work.
 */
export const DELETE = handler(
  async (_req: Request, ctx: { params: Promise<{ gid: string }> }) => {
    const { gid } = await ctx.params;
    await requireOwnedGarment(gid);

    await deleteGarmentDoc(gid);
    // removePrefix takes the derivatives with it — they live in the same folder.
    await storage.removePrefix(garmentPrefix(gid));

    return json({ ok: true });
  },
);
