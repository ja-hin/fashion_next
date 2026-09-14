import { handler, json, formData, str, HttpError } from '@/lib/api';
import { requireOwnedModel, updateModel, loadModel, publicModel } from '@/lib/saved-models';
import { storage, modelKey, baseName } from '@/lib/storage';
import { writeDerivatives } from '@/lib/derivatives';
import { adjustBalance, getBalance } from '@/lib/auth';
import { getSettings, shootCost } from '@/lib/settings';
import { produce } from '@/lib/gemini';
import { logEvent } from '@/lib/logs';
import { PROVIDER } from '@/lib/config';
import { buildCastRefinePrompt } from '@/lib/prompts';
import type { ModelRef } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 120;

/** Enough to ask for a few things at once, few enough to stay one instruction. */
const MAX_NUDGES = 6;

/**
 * Nudge a candidate , stage two of three.
 *
 * Image-to-image with the chosen frame as the input, which is the whole
 * difference between this and casting again: the face is held and only the
 * named changes are applied, so several passes converge on one person instead
 * of rolling a new one each time.
 *
 * The result is APPENDED rather than replacing its source. Refining is a guess
 * as much as casting is, and a nudge that made things worse has to be
 * abandonable , so every pass stays on the draft and the customer picks which
 * one to keep.
 */
export const POST = handler(async (req: Request, ctx: { params: Promise<{ mid: string }> }) => {
  const { mid } = await ctx.params;
  const { user, rec } = await requireOwnedModel(mid);

  if (!rec.draft) throw new HttpError(400, 'This model is already in your roster.');
  if (PROVIDER !== 'gemini') {
    throw new HttpError(400, 'Refining requires a live Gemini API key.');
  }

  const fd = await formData(req);

  const from = baseName(str(fd, 'from'));
  const src = (rec.refs ?? []).find((r) => r.file === from);
  if (!src) throw new HttpError(404, 'That frame is not part of this draft.');

  let nudges: string[] = [];
  try {
    const raw = JSON.parse(str(fd, 'nudges') || '[]') as unknown;
    if (Array.isArray(raw)) {
      nudges = raw
        .map((n) => String(n).replace(/[\r\n]+/g, ' ').trim().slice(0, 120))
        .filter(Boolean)
        .slice(0, MAX_NUDGES);
    }
  } catch {
    nudges = [];
  }
  if (!nudges.length) throw new HttpError(400, 'Queue at least one nudge.');

  const bytes = await storage.get(modelKey(mid, from));
  if (!bytes) throw new HttpError(404, 'That frame is no longer on disk.');

  const settings = await getSettings();
  const perImage = shootCost(settings, { model_id: '' }, '1K');
  if ((await getBalance(user._id)) < perImage) {
    throw new HttpError(402, `A refine costs ${perImage} credit${perImage === 1 ? '' : 's'}.`);
  }

  const prompt = buildCastRefinePrompt(nudges);

  let out;
  try {
    // `hero` is the identity slot , the same one a saved-model shoot anchors
    // to. Passing the candidate there is what makes this an edit.
    out = await produce({
      prompt,
      garment: null,
      hero: bytes,
      seed: null,
      ar: '4:5',
      allowRevealing: false,
      pose: 'refine',
    });
  } catch (e) {
    const msg = String((e as Error)?.message ?? e);
    await logEvent({
      type: 'charsheet',
      pid: '-',
      pose: 'refine',
      model: mid,
      status: 'error',
      cost: 0,
      error: msg.slice(0, 300),
      user: user.email,
    });
    throw new HttpError(502, `Refine failed: ${msg}`);
  }

  const refs = rec.refs ?? [];
  // Numbered past everything on the draft, so a filename is never reused after
  // a frame has been deleted.
  const n = refs.length;
  const fn = `refine_${n}.jpg`;
  const key = modelKey(mid, fn);
  await storage.put(key, out.image);
  await writeDerivatives(key, out.image);

  const next: ModelRef[] = [...refs, { file: fn, pose: `refine ${n}`, primary: false }];
  await updateModel(mid, { refs: next });

  await adjustBalance(user._id, -perImage);
  await logEvent({
    type: 'charsheet',
    pid: '-',
    pose: 'refine',
    model: mid,
    status: 'success',
    cost: perImage,
    file: fn,
    user: user.email,
    ...out.usage,
  });

  const fresh = await loadModel(mid);
  return json({
    model: publicModel(fresh ?? { ...rec, refs: next }),
    file: fn,
    cost: perImage,
    balance: await getBalance(user._id),
  });
});
