/**
 * Shoot records — the replacement for data/shoots/<pid>.json plus the
 * in-memory PRODUCTS dict the Python app rebuilt on every boot.
 *
 * Because shoots now live in MongoDB, they're durable, queryable and shared
 * across restarts without a load_shoots() scan on startup.
 *
 * One deliberate schema change: the old records stored ABSOLUTE filesystem
 * paths (pdir / garment_path / hero_path), which broke whenever the app folder
 * moved and needed re-anchoring logic on every load. Here only the *filename*
 * is stored, and the storage layer resolves it — so a shoot record is portable
 * between machines by construction.
 */
import 'server-only';
import { shoots } from './mongo';
import { safeName, shootNoStr } from './settings';
import type { ShootDoc, UserDoc, ManifestItem } from './types';

export async function getShoot(pid: string): Promise<ShootDoc | null> {
  if (!pid) return null;
  return (await shoots()).findOne({ _id: pid });
}

export async function insertShoot(doc: ShootDoc): Promise<void> {
  await (await shoots()).insertOne(doc);
}

export async function updateShoot(pid: string, patch: Partial<ShootDoc>): Promise<void> {
  const { _id: _ignored, ...rest } = patch;
  await (await shoots()).updateOne({ _id: pid }, { $set: rest });
}

/** Append one image to a shoot's manifest atomically. */
export async function pushManifest(pid: string, item: ManifestItem): Promise<void> {
  await (await shoots()).updateOne({ _id: pid }, { $push: { manifest: item } });
}

export async function deleteShoot(pid: string): Promise<void> {
  await (await shoots()).deleteOne({ _id: pid });
}

/** True when this user may touch this shoot. Admins own everything. */
export function ownsShoot(user: UserDoc | null, shoot: ShootDoc | null): boolean {
  if (!user || !shoot) return false;
  return !!user.is_admin || shoot.opts?.owner === user._id;
}

/**
 * The signed-in user plus a shoot they're allowed to touch.
 * 401 when signed out, 404 when the shoot is gone, 403 when it isn't theirs.
 */
export async function requireOwnedShoot(
  pid: string,
): Promise<{ user: UserDoc; shoot: ShootDoc }> {
  const { requireUser, HttpError } = await import('./api');
  const user = await requireUser();
  const shoot = await getShoot(pid);
  if (!shoot) throw new HttpError(404, 'Unknown shoot');
  if (!ownsShoot(user, shoot)) throw new HttpError(403, 'Not your shoot');
  return { user, shoot };
}

/**
 * The filename prefix for a shoot's downloads — the user's chosen name when
 * they've set one, otherwise the sequential shoot number (S0007).
 */
export function shootFilePrefix(shoot: ShootDoc): string {
  const nm = (shoot.name ?? '').trim();
  return nm ? safeName(nm) : shootNoStr(shoot.no);
}

export { shootNoStr, safeName };