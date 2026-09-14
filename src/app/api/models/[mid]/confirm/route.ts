import { handler, json, formData, str, HttpError } from '@/lib/api';
import { requireOwnedModel, updateModel, modelNameTaken, publicModel } from '@/lib/saved-models';
import { storage, modelKey, baseName } from '@/lib/storage';
import { removeDerivatives } from '@/lib/derivatives';

export const runtime = 'nodejs';

/**
 * Accept a cast draft into the roster.
 *
 * The only thing this adds is a name and the decision , the images, the
 * derivatives and the document already exist, because the preview the customer
 * has been looking at IS the model. Confirming is therefore a flag flip rather
 * than a copy, which is what makes "cast, look, keep" cost the same as "cast
 * and keep" and leaves nothing half-written if the tab is closed in between.
 *
 * Rejecting is DELETE /api/models/[mid] , the route that already deletes any
 * model, since a draft is one.
 */
export const POST = handler(async (req: Request, ctx: { params: Promise<{ mid: string }> }) => {
  const { mid } = await ctx.params;
  const { user, rec } = await requireOwnedModel(mid);

  if (!rec.draft) throw new HttpError(400, 'This model is already in your roster.');

  const fd = await formData(req);

  const name = str(fd, 'name').trim().slice(0, 80);
  if (!name) throw new HttpError(400, 'Give this model a name.');

  /*
   * Which candidate won. Everything else is deleted rather than kept as extra
   * references: the other three are people you decided against, and leaving
   * them on the model would give every later shoot three wrong faces to anchor
   * to. The chosen frame becomes the primary.
   */
  const keep = baseName(str(fd, 'keep'));
  const refs = rec.refs ?? [];
  const chosen = refs.find((r) => r.file === keep) ?? refs.find((r) => r.primary) ?? refs[0];
  if (!chosen) throw new HttpError(400, 'This draft has no frames to keep.');
  // Checked here rather than at cast time, because this is the first moment a
  // name exists , and the roster it has to be unique within is this one.
  if (await modelNameTaken(user._id, name)) {
    throw new HttpError(409, `You already have a model called "${name}".`);
  }

  for (const r of refs) {
    if (r.file === chosen.file) continue;
    await storage.remove(modelKey(mid, r.file));
    await removeDerivatives(modelKey(mid, r.file));
  }

  const kept = [{ ...chosen, pose: 'front', primary: true }];
  await updateModel(mid, { name, draft: false, refs: kept });
  return json({ model: publicModel({ ...rec, name, draft: false, refs: kept }) });
});
