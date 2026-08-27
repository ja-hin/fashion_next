import sharp from 'sharp';
import { handler, json, requireUser, formData, str, HttpError } from '@/lib/api';
import { customiseBrief, authorBrief } from '@/lib/video';
import { analyseReference } from '@/lib/genie-director';
import { VIDEO_PRESETS, CUSTOM_KEY, type VideoBrief } from '@/lib/video-presets';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** Art direction, not detail work — the same ceiling the image director uses. */
const MAX_REF_PX = 1024;

/**
 * Genie for video: rewrite a brief, or write one from nothing.
 *
 * Free, unlike the image Genie: this is one small text call, and charging for
 * it would push customers to generate a ₹175 video against a preset that does
 * not match what they wanted rather than spend a credit refining it first.
 *
 * A reference photo is DESCRIBED, never forwarded. The video model is told to
 * use its reference images only for the model's identity and the garment, so
 * handing it a fifth image of a location would contradict the one instruction
 * the whole feature rests on. Turning the photo into a paragraph of set and
 * lighting notes puts the scene in the brief where it belongs — and it is the
 * same trick, and the same analyser, the image director already uses.
 */
export const POST = handler(async (req: Request) => {
  await requireUser();

  const fd = await formData(req);
  const presetKey = str(fd, 'preset');
  const instruction = str(fd, 'instruction').trim().slice(0, 600);

  let sent: VideoBrief | null = null;
  try {
    const raw = str(fd, 'brief');
    if (raw) sent = JSON.parse(raw) as VideoBrief;
  } catch {
    sent = null; // A malformed brief falls back to the preset's own.
  }

  // ── the reference photo, if there is one ──
  let scene = '';
  const upload = fd.get('image');
  if (upload instanceof File && upload.size > 0) {
    let bytes: Buffer;
    try {
      bytes = await sharp(Buffer.from(await upload.arrayBuffer()))
        .rotate()
        .resize({ width: MAX_REF_PX, height: MAX_REF_PX, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 90 })
        .toBuffer();
    } catch {
      throw new HttpError(400, "Couldn't read that reference image — use a JPG, PNG or WebP.");
    }
    scene = await analyseReference(bytes);
  }

  if (!instruction && !scene) {
    if (presetKey === CUSTOM_KEY) {
      throw new HttpError(400, 'Describe the video you want, or attach a reference photo');
    }
    const preset = VIDEO_PRESETS[presetKey];
    if (!preset) throw new HttpError(400, 'Unknown video preset');
    // Nothing asked for, nothing to do — and no reason to spend a model call.
    return json({ brief: sent ?? preset.brief, gist: preset.gist });
  }

  // The analysed scene leads: it is concrete where the typed line is a hint, and
  // a customer who attaches a photo AND types has told us two things about one
  // video, not two separate requests.
  const ask = [
    scene && `Recreate this setting exactly: ${scene}`,
    instruction,
  ]
    .filter(Boolean)
    .join('\n\n');

  // No preset behind it: the description IS the brief, so Genie writes the shot
  // list too. This is the "completely new scene" path.
  if (presetKey === CUSTOM_KEY) {
    const out = await authorBrief(ask);
    return json({ ...out, scene_used: !!scene });
  }

  const preset = VIDEO_PRESETS[presetKey];
  if (!preset) throw new HttpError(400, 'Unknown video preset');

  const base: VideoBrief =
    sent && typeof sent === 'object' && typeof sent.prompt === 'string'
      ? { ...preset.brief, ...sent }
      : preset.brief;

  const out = await customiseBrief(base, ask);
  return json({ ...out, scene_used: !!scene });
});
