import { handler, json, HttpError } from '@/lib/api';
import { adjustBalance, getBalance } from '@/lib/auth';
import { requireOwnedShoot, pushVideo } from '@/lib/shoots';
import { getSettings } from '@/lib/settings';
import { storage, shootKey, shootUrl, baseName } from '@/lib/storage';
import { logEvent } from '@/lib/logs';
import { generateVideo } from '@/lib/video';
import {
  VIDEO_PRESETS,
  CUSTOM_KEY,
  CUSTOM_SKELETON,
  withLock,
  normaliseAspect,
  type VideoBrief,
} from '@/lib/video-presets';

export const runtime = 'nodejs';
/**
 * Generation is a ~60s model call plus the file poll behind it. The default
 * would cut the request off mid-generation and bill the customer for a video
 * they never receive.
 */
export const maxDuration = 300;

/** More references sharpen the identity lock; past a handful they just cost. */
const MAX_FRAMES = 4;

/**
 * Generate one 10-second video from a shoot's own frames.
 *
 * The frames are read from storage by filename rather than uploaded by the
 * client: the browser already has them on screen, but re-posting the bytes
 * would let a caller pass any image at all and bill it to someone else's shoot.
 *
 * Charging is deliberately AFTER a successful generation, unlike Genie. A video
 * is 35 credits and takes a minute — taking that up front and refunding on
 * failure means a customer watches their balance drop and hopes. See the note
 * in lib/gen.ts for the same reasoning on images.
 */
export const POST = handler(async (req: Request) => {
  // Parsed defensively and inside the handler's error contract: an unparseable
  // body is a 400 the caller can act on, not a 500 that reads as our fault.
  let body: {
    pid?: string;
    files?: string[];
    preset?: string;
    aspect?: string;
    brief?: VideoBrief;
    gist?: string;
    custom?: string;
  };
  try {
    body = await req.json();
  } catch {
    throw new HttpError(400, 'Expected a JSON body');
  }

  // requireOwnedShoot authenticates before it looks anything up, so a caller
  // with no session gets 401 rather than a 400 that describes the payload.
  const { user, shoot } = await requireOwnedShoot((body.pid ?? '').trim());
  const pid = shoot._id;

  const custom = body.preset === CUSTOM_KEY;
  const preset = custom ? null : VIDEO_PRESETS[body.preset ?? ''];
  if (!custom && !preset) throw new HttpError(400, 'Unknown video preset');

  // The brief the client sends has usually been through the Genie, so it is
  // trusted for its wording — but only as an object of the right shape, and
  // merged onto a base so a missing slot is a default rather than undefined.
  // A custom brief has no preset behind it, so the skeleton is the base and the
  // brief itself is required: there is nothing to fall back to.
  const sent = body.brief;
  const usable = sent && typeof sent === 'object' && typeof sent.prompt === 'string';
  if (custom && !usable) throw new HttpError(400, 'Describe the video first');

  const baseBrief: VideoBrief = usable
    ? { ...(preset?.brief ?? CUSTOM_SKELETON), ...(sent as VideoBrief) }
    : (preset?.brief ?? CUSTOM_SKELETON);

  const label = preset?.label ?? 'Custom';

  const aspect = normaliseAspect(body.aspect);

  /*
   * Only files this shoot actually holds. A name that is in neither list is a
   * stale UI or someone reaching for another folder.
   *
   * References count as well as generated stills: a shoot made straight to
   * video has no stills, and refusing on that basis would mean it could never
   * produce a second clip despite having exactly what a clip needs.
   */
  const stills = new Set(shoot.manifest.map((m) => m.file));
  const refs = new Set((shoot.refs ?? []).map((r) => r.file));
  const files = (body.files ?? [])
    .map((f) => baseName(String(f)))
    .filter((f) => stills.has(f) || refs.has(f))
    .slice(0, MAX_FRAMES);
  if (!files.length) throw new HttpError(400, 'Pick at least one frame from this shoot');

  /*
   * Which guarantee the brief carries, decided by what was actually picked.
   * A generated still shows the model wearing the garment, so "keep this
   * person" means something. A flat-lay reference does not, so the lock moves
   * onto the garment and the model is invented — the same call the direct
   * upload route makes.
   */
  const lock: 'model' | 'garment' = files.some((f) => stills.has(f)) ? 'model' : 'garment';

  // withLock, not a trust check: the identity guarantee is what a customer is
  // paying 35 credits for, so it is applied at the last moment before the call
  // rather than assumed to have survived the round trip through the client.
  const brief: VideoBrief = withLock(baseBrief, lock);

  const frames: Buffer[] = [];
  for (const f of files) {
    const b = await storage.get(shootKey(pid, f));
    if (b) frames.push(b);
  }
  if (!frames.length) throw new HttpError(404, 'Those frames are no longer on disk');

  const s = await getSettings();
  const cost = Number(s.video_price ?? 0);

  // Checked before the call so a customer who cannot afford it is told in a
  // second rather than after a minute of generating.
  if ((await getBalance(user._id)) < cost) {
    throw new HttpError(402, 'Insufficient balance for a video');
  }

  try {
    const out = await generateVideo({ frames, brief, aspect });

    const name = `video_${Date.now().toString(36)}_${aspect.replace(':', 'x')}.mp4`;
    await storage.put(shootKey(pid, name), out.video);

    // Registered on the shoot, not just written to its folder. Storage is where
    // the bytes live; this list is what makes them appear anywhere — the grid,
    // the gallery and the zip all read the document, never the directory.
    await pushVideo(pid, {
      file: name,
      preset: label,
      aspect,
      frames: files,
      created: new Date().toISOString(),
    });

    // Charged only now, and refused rather than allowed negative — a wallet
    // spent elsewhere during the minute this took must not go below zero.
    let balance = await getBalance(user._id);
    if (cost > 0) {
      const nb = await adjustBalance(user._id, -cost, false);
      if (nb === null) {
        // Generated but unaffordable: keep the file (they may top up) and say
        // so plainly rather than silently handing over an unpaid video.
        await storage.remove(shootKey(pid, name));
        await (await import('@/lib/mongo'))
          .shoots()
          .then((c) => c.updateOne({ _id: pid }, { $pull: { videos: { file: name } } }));
        throw new HttpError(402, 'Balance ran out while the video was generating');
      }
      balance = nb;
    }

    await logEvent({
      type: 'video',
      pid,
      shoot: shoot.name,
      pose: `${label} · ${aspect}`,
      status: 'success',
      cost,
      file: name,
      img: shootUrl(pid, name),
      user: user.email,
      ...out.usage,
    });

    return json({
      url: shootUrl(pid, name),
      file: name,
      aspect,
      seconds: out.seconds,
      cost,
      balance,
      gist: body.gist ?? preset?.gist ?? label,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Video generation failed';
    await logEvent({
      type: 'video',
      pid,
      shoot: shoot.name,
      pose: `${label} · ${aspect}`,
      status: 'error',
      cost: 0,
      error: msg.slice(0, 300),
      user: user.email,
    });
    if (e instanceof HttpError) throw e;
    throw new HttpError(400, msg);
  }
});
