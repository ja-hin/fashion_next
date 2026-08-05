/**
 * Saved models — a reusable person whose identity anchors future shoots.
 *
 * Reference images are COPIED into the model's own storage folder when it's
 * saved, so a model survives deletion of the shoot it came from.
 */
import 'server-only';
import { savedModels } from './mongo';
import { storage, modelKey, modelUrl } from './storage';
import type { ModelDoc, ModelRef, PublicModel, UserDoc } from './types';

export async function loadModel(mid: string): Promise<ModelDoc | null> {
  if (!mid) return null;
  return (await savedModels()).findOne({ _id: mid });
}

export async function saveModelDoc(doc: ModelDoc): Promise<void> {
  await (await savedModels()).replaceOne({ _id: doc._id }, doc, { upsert: true });
}

export async function updateModel(mid: string, patch: Partial<ModelDoc>): Promise<void> {
  const { _id: _ignored, ...rest } = patch;
  await (await savedModels()).updateOne({ _id: mid }, { $set: rest });
}

export async function deleteModelDoc(mid: string): Promise<void> {
  await (await savedModels()).deleteOne({ _id: mid });
}

/**
 * A user may see and use their own models; admins see all. Legacy records with
 * no owner are visible to admins only.
 */
export function canSeeModel(user: UserDoc, rec: ModelDoc | null): boolean {
  if (!rec) return false;
  return !!user.is_admin || rec.owner === user._id;
}

/**
 * A model the current user is allowed to touch, plus that user.
 * 401 signed out, 404 missing, 403 someone else's.
 */
export async function requireOwnedModel(
  mid: string,
): Promise<{ user: UserDoc; rec: ModelDoc }> {
  const { requireUser, HttpError } = await import('./api');
  const user = await requireUser();
  const rec = await loadModel(mid);
  if (!rec) throw new HttpError(404, 'Model not found');
  if (!canSeeModel(user, rec)) {
    throw new HttpError(403, 'This model belongs to another user.');
  }
  return { user, rec };
}

/** Case-insensitive duplicate-name check, scoped to one owner. */
export async function modelNameTaken(
  name: string,
  owner: string,
  excludeMid?: string,
): Promise<boolean> {
  const n = (name ?? '').trim();
  if (!n) return false;
  const filter: Record<string, unknown> = {
    owner,
    // Anchored, case-insensitive exact match. The name is regex-escaped so a
    // model called "A+B" can't be read as a pattern.
    name: { $regex: `^${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
  };
  if (excludeMid) filter._id = { $ne: excludeMid };
  return (await (await savedModels()).countDocuments(filter, { limit: 1 })) > 0;
}

export function primaryFile(rec: ModelDoc): string | null {
  const refs = rec.refs ?? [];
  const p = refs.find((r) => r.primary);
  if (p) return p.file;
  return refs.length ? refs[0].file : null;
}

/** The browser-facing shape of a saved model. */
export function publicModel(rec: ModelDoc): PublicModel {
  const mid = rec._id;
  const pf = primaryFile(rec);
  const refs = rec.refs ?? [];
  return {
    id: mid,
    name: rec.name ?? '',
    created: rec.created ?? '',
    source: rec.source ?? 'shoot',
    source_shoot: rec.source_shoot ?? '',
    tags: rec.tags ?? {},
    thumb: pf ? modelUrl(mid, pf) : '',
    ref_count: refs.length,
    has_character_sheet: refs.some((r) => r.charsheet === 'grid'),
    kept_batch: rec.kept_batch ?? '',
    refs: refs.map((r) => ({
      file: r.file,
      pose: r.pose ?? 'image',
      primary: !!r.primary,
      charsheet: r.charsheet ?? '',
      batch: r.batch ?? '',
      url: modelUrl(mid, r.file),
    })),
  };
}

/**
 * Bytes of the FRONT frame from the model's most recent character-sheet batch,
 * or null when the model has no sheet yet.
 *
 * A single clean front-facing photo is used as the identity anchor (hero_bytes)
 * for new shoots — that feeds the same one-garment-image + one-reference-image
 * path that every working recast/extend flow already relies on.
 *
 * "Most recent" means the last grid ref in array order: character-sheet batches
 * are always appended, never reordered.
 */
export async function latestCharsheetFrontFrame(mid: string): Promise<Buffer | null> {
  const rec = await loadModel(mid);
  if (!rec) return null;

  const refs = rec.refs ?? [];
  const grids = refs.filter((r) => r.charsheet === 'grid');
  if (!grids.length) return null;

  const batch = grids[grids.length - 1].batch;
  const frames = refs.filter((r) => r.charsheet === 'frame' && r.batch === batch);
  if (!frames.length) return null;

  const front: ModelRef | undefined = frames.find((r) => r.pose === 'front') ?? frames[0];
  if (!front) return null;

  return storage.get(modelKey(mid, front.file));
}