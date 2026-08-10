import crypto from 'node:crypto';
import { handler, json, requireUser, formData, str, HttpError } from '@/lib/api';
import { getShoot, ownsShoot, shootNoStr } from '@/lib/shoots';
import { storage, shootKey, modelKey, baseName } from '@/lib/storage';
import { writeDerivatives } from '@/lib/derivatives';
import { modelNameTaken, saveModelDoc, publicModel } from '@/lib/saved-models';
import { GENDER_BY_CAT } from '@/lib/prompts';
import { nowIso } from '@/lib/auth';
import type { ModelDoc, ModelRef } from '@/lib/types';

export const runtime = 'nodejs';

/**
 * Save selected shots from a shoot as a reusable model.
 *
 * The chosen images are COPIED into the model's own storage folder, so the
 * model keeps working even if the source shoot is later deleted.
 */
export const POST = handler(async (req: Request) => {
  const me = await requireUser();
  const fd = await formData(req);

  const pid = str(fd, 'pid');
  const shoot = await getShoot(pid);
  if (!shoot) throw new HttpError(404, 'Unknown shoot');
  if (!ownsShoot(me, shoot)) throw new HttpError(403, 'Not your shoot');

  let selected: string[];
  try {
    selected = JSON.parse(str(fd, 'files'));
    if (!Array.isArray(selected) || !selected.length) throw new Error('empty');
  } catch {
    throw new HttpError(400, 'No images selected');
  }

  const finalName = str(fd, 'name').trim() || `Model ${crypto.randomBytes(4).toString('hex')}`;
  if (await modelNameTaken(finalName, me._id)) {
    throw new HttpError(
      409,
      `You already have a model named "${finalName}". Please choose a different name.`,
    );
  }

  const opts = shoot.opts ?? {};
  const heroFile = shoot.hero_file ?? null;
  const poses = new Map((shoot.manifest ?? []).map((m) => [m.file, m.pose ?? 'image']));

  const mid = crypto.randomBytes(4).toString('hex');
  const refs: ModelRef[] = [];

  for (const raw of selected) {
    const fn = baseName(raw);
    const bytes = await storage.get(shootKey(pid, fn));
    if (!bytes) continue;
    const key = modelKey(mid, fn);
    await storage.put(key, bytes);
    await writeDerivatives(key, bytes);
    refs.push({ file: fn, pose: poses.get(fn) ?? 'image', primary: fn === heroFile });
  }

  if (!refs.length) {
    throw new HttpError(400, 'None of the selected images were found');
  }
  // A model must always have exactly one primary — that's its thumbnail and the
  // identity anchor for character-sheet generation.
  if (!refs.some((r) => r.primary)) refs[0].primary = true;

  const rec: ModelDoc = {
    _id: mid,
    name: finalName,
    owner: me._id,
    owner_email: me.email,
    created: nowIso(),
    source: 'shoot',
    source_pid: pid,
    source_shoot: shootNoStr(shoot.no),
    tags: {
      ethnicity: str(fd, 'ethnicity') || opts.style || '',
      gender: str(fd, 'gender') || GENDER_BY_CAT[opts.category ?? ''] || '',
      vibe: str(fd, 'vibe') || '',
    },
    refs,
  };

  await saveModelDoc(rec);
  return json({ ok: true, id: mid, model: publicModel(rec) });
});