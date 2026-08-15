/**
 * Saved garments — a reusable product, tagged once.
 *
 * Photographing a garment properly means several frames: front, back, a side, a
 * detail, the label. Tagging those is what stops the back being invented (see
 * lib/ensemble.ts), and it is work nobody wants to repeat every time they shoot
 * the same product. A saved garment keeps that work.
 *
 * Images are COPIED into the garment's own folder, exactly as saved models do,
 * so a garment survives deletion of the shoot it came from.
 */
import 'server-only';
import { garments } from './mongo';
import { garmentUrl } from './storage';
import type { GarmentDoc, PublicGarment, UserDoc } from './types';

export async function loadGarment(gid: string): Promise<GarmentDoc | null> {
  if (!gid) return null;
  return (await garments()).findOne({ _id: gid });
}

export async function saveGarmentDoc(doc: GarmentDoc): Promise<void> {
  await (await garments()).replaceOne({ _id: doc._id }, doc, { upsert: true });
}

export async function updateGarment(gid: string, patch: Partial<GarmentDoc>): Promise<void> {
  const { _id: _ignored, ...rest } = patch;
  await (await garments()).updateOne({ _id: gid }, { $set: rest });
}

export async function deleteGarmentDoc(gid: string): Promise<void> {
  await (await garments()).deleteOne({ _id: gid });
}

/** A user sees their own garments; admins see all. */
export function canSeeGarment(user: UserDoc, rec: GarmentDoc | null): boolean {
  if (!rec) return false;
  return !!user.is_admin || rec.owner === user._id;
}

/**
 * A garment the current user may touch, plus that user.
 * 401 signed out, 404 missing, 403 someone else's.
 */
export async function requireOwnedGarment(
  gid: string,
): Promise<{ user: UserDoc; rec: GarmentDoc }> {
  const { requireUser, HttpError } = await import('./api');
  const user = await requireUser();
  const rec = await loadGarment(gid);
  if (!rec) throw new HttpError(404, 'Garment not found');
  if (!canSeeGarment(user, rec)) throw new HttpError(403, 'Not your garment');
  return { user, rec };
}

/**
 * The card image. Prefers the front, because a rack of garments identified by
 * their label frames is unusable — falls back to whatever is first.
 */
export function coverFile(rec: GarmentDoc): string | null {
  const refs = rec.refs ?? [];
  return refs.find((r) => r.role === 'front')?.file ?? refs[0]?.file ?? null;
}

export function publicGarment(rec: GarmentDoc): PublicGarment {
  const gid = rec._id;
  const refs = rec.refs ?? [];
  const cover = coverFile(rec);

  return {
    id: gid,
    name: rec.name ?? '',
    created: rec.created ?? '',
    category: rec.category ?? '',
    mode: rec.mode ?? 'same_garment',
    thumb: cover ? garmentUrl(gid, cover) : '',
    ref_count: refs.length,
    refs: refs.map((r) => ({ file: r.file, role: r.role, url: garmentUrl(gid, r.file) })),
  };
}
