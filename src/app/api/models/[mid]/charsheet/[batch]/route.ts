import { handler, json, HttpError } from '@/lib/api';
import { requireOwnedModel, updateModel, loadModel, publicModel } from '@/lib/saved-models';
import { storage, modelKey } from '@/lib/storage';
import type { ModelRef } from '@/lib/types';

export const runtime = 'nodejs';

/** Delete one whole character-sheet batch (its grid and all six frames). */
export const DELETE = handler(
  async (_req: Request, ctx: { params: Promise<{ mid: string; batch: string }> }) => {
    const { mid, batch } = await ctx.params;
    const { rec } = await requireOwnedModel(mid);

    const keep: ModelRef[] = [];
    let removed = 0;

    for (const r of rec.refs ?? []) {
      if (r.charsheet && r.batch === batch) {
        await storage.remove(modelKey(mid, r.file));
        removed++;
      } else {
        keep.push(r);
      }
    }

    if (removed === 0) throw new HttpError(404, 'Character sheet batch not found');

    await updateModel(mid, {
      refs: keep,
      // Clear the "kept" flag if the batch just deleted was the kept one.
      ...(rec.kept_batch === batch ? { kept_batch: '' } : {}),
    });

    const fresh = await loadModel(mid);
    return json({ ok: true, model: publicModel(fresh!) });
  },
);