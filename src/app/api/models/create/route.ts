import crypto from 'node:crypto';
import { handler, json, requireUser, formData, str, num, HttpError } from '@/lib/api';
import { saveModelDoc, publicModel } from '@/lib/saved-models';
import { storage, modelKey } from '@/lib/storage';
import { writeDerivatives } from '@/lib/derivatives';
import { adjustBalance, getBalance, nowIso } from '@/lib/auth';
import { getSettings, shootCost } from '@/lib/settings';
import { produce } from '@/lib/gemini';
import { logEvent } from '@/lib/logs';
import { PROVIDER } from '@/lib/config';
import { buildCastPrompt, STYLES } from '@/lib/prompts';
import { traitOption, castSummary, type CastPicks } from '@/lib/model-traits';
import type { ModelDoc, ModelRef } from '@/lib/types';

export const runtime = 'nodejs';
/** Up to four sequential image calls. */
export const maxDuration = 300;

/** Four is the point: casting is a choice, and one roll of the dice is not. */
const MAX_CANDIDATES = 4;

/**
 * Cast candidates from a description , stage one of three.
 *
 * The draft model doc IS the casting session. Each candidate is a ref on it,
 * which means every one already has a real file, real derivatives and a real
 * URL, and the refine and confirm stages are ordinary edits to a document that
 * exists. Nothing is invented for the in-between state, and nothing is left
 * behind if the tab closes , drafts are hidden from the roster and deletable.
 *
 * Charged per candidate as each lands: a run that produces three of four bills
 * for three.
 */
export const POST = handler(async (req: Request) => {
  const me = await requireUser();

  if (PROVIDER !== 'gemini') {
    throw new HttpError(400, 'Casting a model requires a live Gemini API key.');
  }

  const fd = await formData(req);
  const count = Math.max(1, Math.min(MAX_CANDIDATES, num(fd, 'count', 4) ?? 4));

  const picks: CastPicks = {
    gender: str(fd, 'gender') === 'man' ? 'man' : 'woman',
    // Kept as free text and clamped rather than parsed into a band: an exact
    // age is a real casting instruction and "aged 34" is more use to the model
    // than "in her 30s".
    age: String(Math.max(0, Math.min(90, Number(str(fd, 'age')) || 0)) || ''),
    skin: str(fd, 'skin'),
    body: str(fd, 'body'),
    hairstyle: str(fd, 'hairstyle'),
    haircolour: str(fd, 'haircolour'),
    vibe: str(fd, 'vibe'),
  };
  const free = str(fd, 'text');
  const style = STYLES[str(fd, 'style')] ? str(fd, 'style') : '';

  const prompt = buildCastPrompt({
    gender: picks.gender,
    ethnicity: style,
    age: picks.age,
    skinPhrase: traitOption('skin', picks.skin)?.phrase,
    body: picks.body,
    hairstyle: picks.hairstyle,
    haircolour: picks.haircolour,
    vibe: picks.vibe,
    free,
  });

  const settings = await getSettings();
  const perImage = shootCost(settings, { model_id: '' }, '1K');
  if ((await getBalance(me._id)) < perImage * count) {
    throw new HttpError(402, `Casting ${count} candidates costs ${perImage * count} credits.`);
  }

  const mid = crypto.randomBytes(4).toString('hex');
  const refs: ModelRef[] = [];
  let spent = 0;

  for (let i = 0; i < count; i++) {
    let out;
    try {
      // A different seed per candidate , same brief, four different people.
      // Without this the four would be near-identical and there would be
      // nothing to choose between.
      out = await produce({
        prompt,
        garment: null,
        hero: null,
        seed: 1000 + i,
        ar: '4:5',
        allowRevealing: false,
        pose: `candidate ${i + 1}`,
      });
    } catch (e) {
      const msg = String((e as Error)?.message ?? e);
      await logEvent({
        type: 'charsheet',
        pid: '-',
        pose: `candidate ${i + 1}`,
        model: mid,
        status: 'error',
        cost: 0,
        error: msg.slice(0, 300),
        user: me.email,
      });
      // Nothing at all is a failure worth reporting; some candidates is a
      // shorter line-up, which is still a choice.
      if (!refs.length) throw new HttpError(502, `Could not cast: ${msg}`);
      break;
    }

    const fn = `cand_${i}.jpg`;
    const key = modelKey(mid, fn);
    await storage.put(key, out.image);
    await writeDerivatives(key, out.image);
    // The first is primary only so the doc is always valid; the customer's
    // choice overwrites this at confirm time.
    refs.push({ file: fn, pose: `candidate ${i + 1}`, primary: i === 0 });

    await adjustBalance(me._id, -perImage);
    spent += perImage;

    await logEvent({
      type: 'charsheet',
      pid: '-',
      pose: `candidate ${i + 1}`,
      model: mid,
      status: 'success',
      cost: perImage,
      file: fn,
      user: me.email,
      ...out.usage,
    });
  }

  const doc: ModelDoc = {
    _id: mid,
    name: `Draft ${mid}`,
    owner: me._id,
    owner_email: me.email,
    created: nowIso(),
    source: 'studio',
    source_pid: '',
    source_shoot: '',
    tags: { ethnicity: style, gender: picks.gender, vibe: castSummary(picks) },
    refs,
    draft: true,
  };
  await saveModelDoc(doc);

  return json({
    model: publicModel(doc),
    prompt,
    cost: spent,
    balance: await getBalance(me._id),
  });
});
