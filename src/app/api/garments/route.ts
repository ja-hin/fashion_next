import crypto from 'node:crypto';
import { handler, json, requireUser, formData, str, HttpError } from '@/lib/api';
import { garments } from '@/lib/mongo';
import { publicGarment, saveGarmentDoc } from '@/lib/garments';
import { storage, garmentKey } from '@/lib/storage';
import { writeDerivatives } from '@/lib/derivatives';
import { resizeInput, BadImageError } from '@/lib/images';
import { asRole, MAX_ENSEMBLE_REFS, type RefMode, type RefRole } from '@/lib/ensemble';
import { nowIso } from '@/lib/auth';
import type { GarmentDoc } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Every garment this user may use, newest first. Admins see all. */
export const GET = handler(async () => {
  const me = await requireUser();
  // Non-admins are pinned to their own garments, always.
  const filter = me.is_admin ? {} : { owner: me._id };
  const rows = await (await garments()).find(filter).sort({ created: -1 }).toArray();

  return json({ garments: rows.map(publicGarment), is_admin: !!me.is_admin });
});

/**
 * Save a garment from tagged reference images.
 *
 * Takes the same `refs` + `roles` pair the generate route does, so whatever is
 * already tagged in the setup panel can be kept with no re-tagging — the two
 * are the same shape by design.
 */
export const POST = handler(async (req: Request) => {
  const me = await requireUser();
  const fd = await formData(req);

  const name = str(fd, 'name').trim().slice(0, 80);
  if (!name) throw new HttpError(400, 'Give this garment a name.');

  const mode: RefMode = str(fd, 'mode') === 'ensemble' ? 'ensemble' : 'same_garment';
  const category = str(fd, 'category', 'womenswear');

  const files = fd.getAll('refs').filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) throw new HttpError(400, 'Add at least one image.');
  if (files.length > MAX_ENSEMBLE_REFS) {
    throw new HttpError(400, `A garment takes at most ${MAX_ENSEMBLE_REFS} images.`);
  }

  let roles: unknown[] = [];
  try {
    const parsed = JSON.parse(str(fd, 'roles') || '[]');
    if (Array.isArray(parsed)) roles = parsed;
  } catch {
    roles = [];
  }

  const gid = crypto.randomBytes(4).toString('hex');
  const refs: GarmentDoc['refs'] = [];

  try {
    for (const [i, f] of files.entries()) {
      const bytes = await resizeInput(Buffer.from(await f.arrayBuffer()));
      const file = `ref_${i}.jpg`;
      const key = garmentKey(gid, file);
      await storage.put(key, bytes);
      // The library is a grid of thumbnails, so derivatives earn their keep here
      // as much as anywhere. See lib/derivatives.ts.
      await writeDerivatives(key, bytes);
      // Order is the manifest: it is what the prompt numbers, so it is stored
      // exactly as uploaded and never sorted.
      refs.push({ file, role: asRole(roles[i], mode) as RefRole });
    }
  } catch (e) {
    if (e instanceof BadImageError) throw new HttpError(400, e.message);
    throw e;
  }

  const doc: GarmentDoc = {
    _id: gid,
    name,
    owner: me._id,
    owner_email: me.email,
    created: nowIso(),
    category,
    mode,
    refs,
  };
  await saveGarmentDoc(doc);

  return json({ ok: true, garment: publicGarment(doc) });
});
