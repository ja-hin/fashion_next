import crypto from 'node:crypto';
import {
  handler,
  json,
  requireUser,
  formData,
  str,
  bool,
  fileBuffer,
  HttpError,
} from '@/lib/api';
import { resizeInput, BadImageError } from '@/lib/images';
import { storage, shootKey } from '@/lib/storage';
import { insertShoot } from '@/lib/shoots';
import { loadModel } from '@/lib/saved-models';
import { nextShootNumber, normaliseResolution } from '@/lib/settings';
import { createJob, runBackground } from '@/lib/jobs';
import { runProduct, randSeed, pickLook } from '@/lib/gen';
import { sceneClause } from '@/lib/prompts';
import { PROVIDER } from '@/lib/config';
import { asRole, MAX_ENSEMBLE_REFS, type RefMode, type RefRole } from '@/lib/ensemble';
import type { ShootDoc, ShootOpts } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 300;

export const POST = handler(async (req: Request) => {
  const me = await requireUser();
  const fd = await formData(req);

  const resolution = normaliseResolution(str(fd, 'resolution', '1K'));
  const modelId = str(fd, 'model_id').trim();
  const category = str(fd, 'category', 'womenswear');

  // A saved model can only anchor a shoot once it has a character sheet — that
  // sheet is what makes the face reproducible across poses.
  if (modelId) {
    const rec = await loadModel(modelId);
    if (!rec) throw new HttpError(404, 'Selected model not found');
    if (!(rec.refs ?? []).some((r) => r.charsheet === 'grid')) {
      throw new HttpError(
        400,
        'Selected model has no character sheet yet — generate one before using it in a shoot.',
      );
    }
  }

  const family = str(fd, 'input_family', 'garment_in') as ShootOpts['input_family'];
  const ensemble = family === 'ensemble';
  // Same-garment shoots keep input_family 'garment_in' — they are still one
  // garment, just photographed from several angles — so the mode is decided by
  // whether tagged references were sent rather than by a new family value.
  const refMode: RefMode = ensemble ? 'ensemble' : 'same_garment';

  /**
   * An ensemble hero is built from several tagged product shots rather than one
   * garment. They arrive as repeated `refs` parts with a parallel `roles` array,
   * and the pairing is POSITIONAL — the prompt numbers them "Image 1", "Image
   * 2"… so upload order is the manifest and must survive intact.
   */
  let refs: Array<{ bytes: Buffer; role: RefRole }> = [];
  const sentRefs = fd.getAll('refs').some((f) => f instanceof File && f.size > 0);
  if (sentRefs) {
    const files = fd.getAll('refs').filter((f): f is File => f instanceof File && f.size > 0);
    if (!files.length) throw new HttpError(400, 'Add at least one product image for an ensemble.');
    if (files.length > MAX_ENSEMBLE_REFS) {
      throw new HttpError(400, `An ensemble takes at most ${MAX_ENSEMBLE_REFS} images.`);
    }

    let roles: unknown[] = [];
    try {
      const parsed = JSON.parse(str(fd, 'roles') || '[]');
      if (Array.isArray(parsed)) roles = parsed;
    } catch {
      roles = [];
    }

    try {
      refs = await Promise.all(
        files.map(async (f, i) => ({
          bytes: await resizeInput(Buffer.from(await f.arrayBuffer())),
          // asRole() falls back rather than throwing: a missing or unknown role
          // should cost fidelity on one item, not reject the whole shoot.
          role: asRole(roles[i], refMode),
        })),
      );
    } catch (e) {
      if (e instanceof BadImageError) throw new HttpError(400, e.message);
      throw e;
    }
  }

  // The first reference doubles as the shoot's garment image, so everything
  // that already expects `garment_file` — the folder view, "recast", resume —
  // keeps working on an ensemble shoot without special-casing.
  let garment: Buffer;
  try {
    garment = refs.length ? refs[0].bytes : await resizeInput(await fileBuffer(fd, 'garment'));
  } catch (e) {
    if (e instanceof BadImageError) throw new HttpError(400, e.message);
    throw e;
  }

  const backdrop = str(fd, 'backdrop', 'studio seamless');
  const lighting = str(fd, 'lighting', 'soft bright commercial');
  const mood = str(fd, 'mood', 'clean');

  const opts: ShootOpts = {
    style: str(fd, 'style', 'european'),
    category,
    scene: sceneClause({ backdrop, lighting, mood }),
    aspect: str(fd, 'aspect', '4:5'),
    framing: str(fd, 'framing', 'three_quarter'),
    input_family: family,
    allow_revealing: bool(fd, 'allow_revealing'),
    model_id: modelId,
    resolution,
    owner: me._id,
    owner_email: me.email,
  };

  const pid = crypto.randomBytes(4).toString('hex');
  await storage.put(shootKey(pid, 'garment.jpg'), garment);

  const refRecords: ShootDoc['refs'] = [];
  for (const [i, r] of refs.entries()) {
    const file = `ref_${i}.jpg`;
    await storage.put(shootKey(pid, file), r.bytes);
    refRecords.push({ file, role: r.role });
  }

  const shoot: ShootDoc = {
    _id: pid,
    seed: randSeed(),
    opts,
    no: await nextShootNumber(),
    name: '',
    look: pickLook(category),
    garment_file: 'garment.jpg',
    ...(refRecords.length ? { refs: refRecords } : {}),
    hero_file: null,
    manifest: [],
    created: new Date().toISOString().replace(/\.\d+Z$/, ''),
  };
  await insertShoot(shoot);

  const jobId = createJob(1);
  runBackground(jobId, () => runProduct(jobId, pid, shoot, garment));

  return json({ job_id: jobId, total: 1, provider: PROVIDER });
});