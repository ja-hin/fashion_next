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

  let garment: Buffer;
  try {
    garment = await resizeInput(await fileBuffer(fd, 'garment'));
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
    input_family: str(fd, 'input_family', 'garment_in') as ShootOpts['input_family'],
    allow_revealing: bool(fd, 'allow_revealing'),
    model_id: modelId,
    resolution,
    owner: me._id,
    owner_email: me.email,
  };

  const pid = crypto.randomBytes(4).toString('hex');
  await storage.put(shootKey(pid, 'garment.jpg'), garment);

  const shoot: ShootDoc = {
    _id: pid,
    seed: randSeed(),
    opts,
    no: await nextShootNumber(),
    name: '',
    look: pickLook(category),
    garment_file: 'garment.jpg',
    hero_file: null,
    manifest: [],
    created: new Date().toISOString().replace(/\.\d+Z$/, ''),
  };
  await insertShoot(shoot);

  const jobId = createJob(1);
  runBackground(jobId, () => runProduct(jobId, pid, shoot, garment));

  return json({ job_id: jobId, total: 1, provider: PROVIDER });
});