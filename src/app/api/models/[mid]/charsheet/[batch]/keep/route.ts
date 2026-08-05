import { handler, json, HttpError } from '@/lib/api';
import { requireOwnedModel, updateModel, loadModel, publicModel } from '@/lib/saved-models';

export const runtime = 'nodejs';

/**
 * Mark a character-sheet batch as explicitly kept.
 *
 * Persisted on the model record so the "Saved ✓" state survives a page refresh
 * and re-opening the modal — it used to be JS-memory-only and reset on load.
 */
export const POST = handler(
  async (_req: Request, ctx: { params: Promise<{ mid: string; batch: string }> }) => {
    const { mid, batch } = await ctx.params;
    const { rec } = await requireOwnedModel(mid);

    const exists = (rec.refs ?? []).some((r) => r.charsheet && r.batch === batch);
    if (!exists) throw new HttpError(404, 'Character sheet batch not found');

    await updateModel(mid, { kept_batch: batch });

    const fresh = await loadModel(mid);
    return json({ ok: true, model: publicModel(fresh!) });
  },
);