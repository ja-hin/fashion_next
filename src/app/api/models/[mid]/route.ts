import { handler, json, formData, HttpError } from '@/lib/api';
import {
  requireOwnedModel,
  modelNameTaken,
  updateModel,
  deleteModelDoc,
  loadModel,
  publicModel,
} from '@/lib/saved-models';
import { storage, modelPrefix } from '@/lib/storage';
import type { ModelTags } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ mid: string }> };

export const GET = handler(async (_req: Request, ctx: Ctx) => {
  const { mid } = await ctx.params;
  const { rec } = await requireOwnedModel(mid);
  return json(publicModel(rec));
});

/** Rename and/or retag. Every field is optional — only what's sent is changed. */
export const PATCH = handler(async (req: Request, ctx: Ctx) => {
  const { mid } = await ctx.params;
  const { rec } = await requireOwnedModel(mid);
  const fd = await formData(req);

  const patch: { name?: string; tags?: ModelTags } = {};

  const rawName = fd.get('name');
  if (typeof rawName === 'string' && rawName.trim()) {
    const newName = rawName.trim();
    if (await modelNameTaken(newName, rec.owner, mid)) {
      throw new HttpError(
        409,
        `You already have a model named "${newName}". Please choose a different name.`,
      );
    }
    patch.name = newName;
  }

  const tags: ModelTags = { ...(rec.tags ?? {}) };
  let tagsTouched = false;
  for (const key of ['ethnicity', 'gender', 'vibe'] as const) {
    const v = fd.get(key);
    if (typeof v === 'string') {
      tags[key] = v;
      tagsTouched = true;
    }
  }
  if (tagsTouched) patch.tags = tags;

  if (Object.keys(patch).length) await updateModel(mid, patch);

  const fresh = await loadModel(mid);
  return json({ ok: true, model: publicModel(fresh ?? rec) });
});

/** Delete the model and every reference image copied into it. */
export const DELETE = handler(async (_req: Request, ctx: Ctx) => {
  const { mid } = await ctx.params;
  await requireOwnedModel(mid);

  await storage.removePrefix(modelPrefix(mid));
  await deleteModelDoc(mid);

  return json({ ok: true });
});