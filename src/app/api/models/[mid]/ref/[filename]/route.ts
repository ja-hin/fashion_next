import { handler, json, HttpError } from '@/lib/api';
import { requireOwnedModel, updateModel, loadModel, publicModel } from '@/lib/saved-models';
import { storage, modelKey, baseName } from '@/lib/storage';
import { removeDerivatives } from '@/lib/derivatives';

export const runtime = 'nodejs';

/** Remove one reference image from a saved model. */
export const DELETE = handler(
  async (_req: Request, ctx: { params: Promise<{ mid: string; filename: string }> }) => {
    const { mid, filename } = await ctx.params;
    const { rec } = await requireOwnedModel(mid);

    const file = baseName(decodeURIComponent(filename));
    const refs = rec.refs ?? [];
    const target = refs.find((r) => r.file === file);
    if (!target) throw new HttpError(404, 'Reference not found');

    // The primary is the model's thumbnail and its identity anchor, so it can
    // only go once another image has been promoted in its place.
    if (target.primary) {
      throw new HttpError(
        400,
        'Cannot remove the primary reference image. Set another image as primary first.',
      );
    }

    const next = refs.filter((r) => r.file !== file);
    if (!next.length) {
      throw new HttpError(400, 'A model must keep at least one reference image');
    }
    if (!next.some((r) => r.primary)) next[0].primary = true;

    await updateModel(mid, { refs: next });
    const key = modelKey(mid, file);
    await storage.remove(key);
    await removeDerivatives(key);

    const fresh = await loadModel(mid);
    return json({ ok: true, model: publicModel(fresh ?? { ...rec, refs: next }) });
  },
);