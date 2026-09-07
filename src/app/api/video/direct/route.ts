import crypto from 'node:crypto';
import { handler, json, requireUser, formData, str, HttpError } from '@/lib/api';
import { adjustBalance, getBalance } from '@/lib/auth';
import { resizeInput, BadImageError } from '@/lib/images';
import { storage, shootKey, shootUrl } from '@/lib/storage';
import { insertShoot } from '@/lib/shoots';
import { nextShootNumber, getSettings } from '@/lib/settings';
import { logEvent } from '@/lib/logs';
import { randSeed, pickLook } from '@/lib/gen';
import { sceneClause } from '@/lib/prompts';
import { MAX_ENSEMBLE_REFS } from '@/lib/ensemble';
import { generateVideo } from '@/lib/video';
import {
  VIDEO_PRESETS,
  CUSTOM_KEY,
  CUSTOM_SKELETON,
  withLock,
  normaliseAspect,
  type VideoBrief,
} from '@/lib/video-presets';
import type { ShootDoc, ShootOpts } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 300;

/** More references sharpen the garment lock; past a handful they just cost. */
const MAX_FRAMES = 4;

/**
 * Video straight from uploaded garment photos, with no shoot generated first.
 *
 * The shoot-frames route (../route.ts) starts from stills that already show the
 * model wearing the garment, so its guarantee is "keep this person". Here there
 * is no person yet , a flat-lay has none , so the guarantee moves onto the
 * garment and the model is invented once and held for the ten seconds. That is
 * the whole difference, and it lives in `withLock(..., 'garment')`.
 *
 * A shoot record is still created. Everything in this app hangs off one , the
 * gallery, the folder view, the zip, deletion , and a video floating outside
 * that would be reachable by URL and by nothing else.
 */
export const POST = handler(async (req: Request) => {
  const me = await requireUser();
  const fd = await formData(req);

  const files = fd
    .getAll('refs')
    .filter((f): f is File => f instanceof File && f.size > 0)
    .slice(0, Math.min(MAX_FRAMES, MAX_ENSEMBLE_REFS));
  if (!files.length) throw new HttpError(400, 'Upload at least one garment photo');

  let frames: Buffer[];
  try {
    frames = await Promise.all(
      files.map(async (f) => resizeInput(Buffer.from(await f.arrayBuffer()))),
    );
  } catch (e) {
    if (e instanceof BadImageError) throw new HttpError(400, e.message);
    throw e;
  }

  const custom = str(fd, 'preset') === CUSTOM_KEY;
  const preset = custom ? null : VIDEO_PRESETS[str(fd, 'preset')];
  if (!custom && !preset) throw new HttpError(400, 'Unknown video preset');

  let sent: VideoBrief | null = null;
  try {
    const raw = str(fd, 'brief');
    if (raw) sent = JSON.parse(raw) as VideoBrief;
  } catch {
    sent = null;
  }
  const usable = sent && typeof sent === 'object' && typeof sent.prompt === 'string';
  if (custom && !usable) throw new HttpError(400, 'Describe the video first');

  // 'garment' mode: the references show the clothes, not a model wearing them.
  const brief: VideoBrief = withLock(
    usable
      ? { ...(preset?.brief ?? CUSTOM_SKELETON), ...(sent as VideoBrief) }
      : (preset?.brief ?? CUSTOM_SKELETON),
    'garment',
  );

  const aspect = normaliseAspect(str(fd, 'aspect'));
  const label = preset?.label ?? 'Custom';
  const category = str(fd, 'category', 'womenswear');

  const cost = Number((await getSettings()).video_price ?? 0);
  if ((await getBalance(me._id)) < cost) {
    throw new HttpError(402, 'Insufficient balance for a video');
  }

  // Generated BEFORE the shoot is written: a failed call should leave no empty
  // shoot behind in the gallery for the customer to wonder about.
  let out;
  try {
    out = await generateVideo({ frames, brief, aspect });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Video generation failed';
    await logEvent({
      type: 'video',
      pid: '-',
      pose: `${label} · ${aspect} · from upload`,
      status: 'error',
      cost: 0,
      error: msg.slice(0, 300),
      user: me.email,
    });
    throw new HttpError(400, msg);
  }

  const pid = crypto.randomBytes(4).toString('hex');
  const opts: ShootOpts = {
    style: str(fd, 'style', 'european'),
    category,
    scene: sceneClause({
      backdrop: str(fd, 'backdrop', 'studio seamless'),
      lighting: str(fd, 'lighting', 'soft bright commercial'),
      mood: str(fd, 'mood', 'clean'),
    }),
    aspect: str(fd, 'aspect_img', '4:5'),
    framing: str(fd, 'framing', 'full_body'),
    // Always garment_in: the references are the clothes. "Extend" and "recast"
    // both mean "take the model from the photo", which is the one thing these
    // uploads cannot offer.
    input_family: 'garment_in',
    ref_mode: 'same_garment',
    allow_revealing: false,
    model_id: '',
    resolution: '1K',
    owner: me._id,
    owner_email: me.email,
  };

  // The garment images are kept, not discarded: they are the shoot's reference
  // set, so "continue this shoot" later starts from what the video was built on.
  await storage.put(shootKey(pid, 'garment.jpg'), frames[0]);
  const refRecords: ShootDoc['refs'] = [];
  for (const [i, b] of frames.entries()) {
    const file = `ref_${i}.jpg`;
    await storage.put(shootKey(pid, file), b);
    refRecords.push({ file, role: 'garment' });
  }

  const name = `video_${Date.now().toString(36)}_${aspect.replace(':', 'x')}.mp4`;
  await storage.put(shootKey(pid, name), out.video);

  const shoot: ShootDoc = {
    _id: pid,
    seed: randSeed(),
    opts,
    no: await nextShootNumber(),
    name: '',
    look: pickLook(category),
    garment_file: 'garment.jpg',
    refs: refRecords,
    hero_file: null,
    manifest: [],
    videos: [
      {
        file: name,
        preset: label,
        aspect,
        frames: refRecords.map((r) => r.file),
        created: new Date().toISOString(),
      },
    ],
    created: new Date().toISOString().replace(/\.\d+Z$/, ''),
  };
  await insertShoot(shoot);

  let balance = await getBalance(me._id);
  if (cost > 0) {
    const nb = await adjustBalance(me._id, -cost, false);
    if (nb === null) {
      // Generated but unaffordable. Everything written above is removed rather
      // than left as an unpaid shoot the customer can still open.
      await storage.removePrefix(`outputs/${pid}`);
      const { shoots } = await import('@/lib/mongo');
      await (await shoots()).deleteOne({ _id: pid });
      throw new HttpError(402, 'Balance ran out while the video was generating');
    }
    balance = nb;
  }

  await logEvent({
    type: 'video',
    pid,
    pose: `${label} · ${aspect} · from upload`,
    status: 'success',
    cost,
    file: name,
    img: shootUrl(pid, name),
    user: me.email,
    ...out.usage,
  });

  return json({
    pid,
    url: shootUrl(pid, name),
    file: name,
    aspect,
    seconds: out.seconds,
    cost,
    balance,
  });
});
