import sharp from 'sharp';
import { GoogleGenAI } from '@google/genai';
import { handler, json, requireUser, formData, HttpError } from '@/lib/api';
import { GEMINI_API_KEY, PROVIDER, TEXT_MODEL_ID } from '@/lib/config';
import {
  ROLES_FOR,
  MAX_ENSEMBLE_REFS,
  asRole,
  isRoleFor,
  type RefMode,
  type RefRole,
} from '@/lib/ensemble';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** Classification only , the detail that matters is the item's kind, not its texture. */
const DETECT_PX = 512;

/**
 * Asked of every image alongside its role.
 *
 * The image model will not dress a figure in underwear, and what it does
 * instead is worse than refusing: it invents a top and returns someone in
 * briefs. Catching it here stops the shoot before a credit is spent and says
 * why, rather than handing back a frame nobody can use and a Retry button that
 * will never produce a different answer.
 */
const RESTRICTED_RULE = [
  'Also set "restricted": true for an image whose item is underwear, lingerie, briefs,',
  'a bra, a thong or other intimate apparel worn next to the skin. Swimwear, activewear,',
  'sports bras and crop tops are NOT restricted , they are ordinary catalogue categories.',
  'When unsure, set it false.',
].join(' ');

/**
 * The two modes ask genuinely different questions of the same picture , "which
 * item is this?" versus "which side of this garment am I looking at?" , so each
 * gets its own instructions rather than one prompt with a swapped word list.
 */
/**
 * The attribute block, asked of every image in BOTH modes.
 *
 * Appended rather than written into each prompt, for the same reason
 * RESTRICTED_RULE is: one copy cannot drift out of step with the other.
 *
 * Nearly free. The image tokens dominate the cost of this call and these add a
 * few dozen output tokens, so the marginal price of asking is close to zero ,
 * which is what makes it worth asking for things we do not use yet.
 *
 * `""` for anything not visible is stated explicitly. Without it the model
 * invents a plausible answer rather than admitting the photo does not show it,
 * and a confident guess is worse than a blank.
 */
const ATTRIBUTES_RULE = [
  'For EVERY image also return these fields. Use "" (empty string) for anything you cannot',
  'actually see , never guess:',
  '"category": one of womenswear, menswear, kidswear, footwear, accessory, or "" if unclear.',
  '"gender": one of female, male, child, unisex, or "" if unclear.',
  '"garment_type": the specific item in 1-3 words, e.g. "banarasi saree", "linen shirt", "bra".',
  '"colour": the dominant colour in plain words. "colour_secondary": a second colour, or "".',
  '"fabric": the apparent material, e.g. cotton, linen, denim, silk, knit.',
  '"pattern": one of solid, striped, checked, floral, printed, embroidered, or "".',
  '"sleeve_length": full, three-quarter, half, short, sleeveless, or "".',
  '"neckline": e.g. round, v-neck, collar, square, halter, or "".',
  '"fit": slim, regular, relaxed, oversized, or "".',
  '"length": e.g. cropped, hip, knee, midi, ankle, floor, or "".',
  '"occasion": casual, formal, festive, party, sports, or "".',
  '"has_person": true if a person is wearing or holding the item, else false.',
  '"is_flat_lay": true if the item is laid flat or on a ghost mannequin with no person, else false.',
  '"quality_issue": name ONE visible problem , blurry, low resolution, harsh shadow, watermark,',
  'cropped , or "" if the photo is clean.',
  '"restricted_reason": when restricted is true, name the item in 2-4 words, else "".',
].join(' ');

const SYSTEM: Record<RefMode, string> = {
  ensemble: [
    'You are a fashion catalogue assistant. You are given several product images that belong to',
    'ONE hero shot, each showing a DIFFERENT item. For EACH image, in the exact order given,',
    `classify what it shows using ONLY roles from this list: ${ROLES_FOR.ensemble.join(', ')}.`,
    '"garment" means a dress or one-piece that covers the whole body; use "top" and "bottom"',
    'only for separates.',
    'Use "back" when an image is clearly the REVERSE VIEW of a garment shown in another image ,',
    'the same colour and fabric photographed from behind, typically with no front print, a rear',
    'neckline or a back zip. It is a second view, not another item.',
    'If an image shows a person wearing the item, classify the ITEM, not the person.',
    'Return STRICT JSON only , an array with one object per image, in order:',
    '[{"index":0,"role":"top","confidence":0.0-1.0,"reason":"few words"}]',
    'confidence is your certainty; reason is a short phrase naming what you saw.',
    'No prose, no code fences, JSON only.',
  ].join(' '),

  same_garment: [
    'You are a fashion catalogue assistant. Every image you are given shows THE SAME SINGLE',
    'GARMENT photographed from a different angle. For EACH image, in the exact order given, say',
    `WHICH VIEW it is, using ONLY these values: ${ROLES_FOR.same_garment.join(', ')}.`,
    '"front" faces the camera; "back" is the reverse; "side" is a profile;',
    '"detail" is a close crop of texture, trims, stitching or hardware; "label" shows printed',
    'text, a care tag or brand artwork.',
    'Judge the VIEW, not the garment type , every image is the same garment.',
    'If an image shows a person wearing it, judge which side of them faces the camera.',
    'Return STRICT JSON only , an array with one object per image, in order:',
    '[{"index":0,"role":"front","confidence":0.0-1.0,"reason":"few words"}]',
    'confidence is your certainty; reason is a short phrase naming what you saw.',
    'No prose, no code fences, JSON only.',
  ].join(' '),
};

/*
 * Every field below is clamped on the way out.
 *
 * `role` has gone through asRole() since day one for a reason: an unchecked
 * string from a model can end up in a prompt, and a prompt is an instruction.
 * These are metadata today, but "today" is not a guarantee , the cheapest place
 * to make that safe is here, once, rather than at each future call site.
 */
const CATEGORIES = ['womenswear', 'menswear', 'kidswear', 'footwear', 'accessory'] as const;
const GENDERS = ['female', 'male', 'child', 'unisex'] as const;

/** A short free-text field: a string, trimmed, length-capped, lower-cased. */
const text = (v: unknown, max = 30): string =>
  typeof v === 'string' ? v.trim().toLowerCase().slice(0, max) : '';

/** Free text restricted to a known vocabulary , anything else becomes ''. */
const oneOf = (v: unknown, allowed: readonly string[]): string =>
  allowed.includes(text(v)) ? text(v) : '';

/** Strict: only a real boolean true counts, so "true" or 1 cannot sneak through. */
const flag = (v: unknown): boolean => v === true;

/** The attribute half of one row, kept apart so the fallback can reuse it. */
const EMPTY_ATTRS = {
  category: '',
  gender: '',
  garment_type: '',
  colour: '',
  colour_secondary: '',
  fabric: '',
  pattern: '',
  sleeve_length: '',
  neckline: '',
  fit: '',
  length: '',
  occasion: '',
  has_person: false,
  is_flat_lay: false,
  quality_issue: '',
  restricted_reason: '',
};

function attrs(row: Record<string, unknown>) {
  return {
    category: oneOf(row.category, CATEGORIES),
    gender: oneOf(row.gender, GENDERS),
    garment_type: text(row.garment_type, 40),
    colour: text(row.colour),
    colour_secondary: text(row.colour_secondary),
    fabric: text(row.fabric),
    pattern: text(row.pattern),
    sleeve_length: text(row.sleeve_length),
    neckline: text(row.neckline),
    fit: text(row.fit),
    length: text(row.length),
    occasion: text(row.occasion),
    has_person: flag(row.has_person),
    is_flat_lay: flag(row.is_flat_lay),
    quality_issue: text(row.quality_issue, 60),
    restricted_reason: text(row.restricted_reason, 80),
  };
}

let _client: GoogleGenAI | null = null;
const client = () => (_client ??= new GoogleGenAI({ apiKey: GEMINI_API_KEY }));

/**
 * Guess what each uploaded ensemble reference is.
 *
 * Purely a convenience: the roles it returns are pre-selected in the UI and the
 * user can change any of them before generating. Which is why a failure here
 * returns low-confidence defaults rather than an error , a wrong guess the user
 * can correct beats blocking the upload.
 *
 * Free, and deliberately so: this is one cheap text call, it runs automatically
 * on every upload, and charging for a guess the user may have to fix would be
 * hard to defend.
 */
export const POST = handler(async (req: Request) => {
  await requireUser();
  const fd = await formData(req);

  const mode: RefMode = fd.get('mode') === 'same_garment' ? 'same_garment' : 'ensemble';
  const files = fd.getAll('refs').filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) throw new HttpError(400, 'No images to classify.');
  if (files.length > MAX_ENSEMBLE_REFS) {
    throw new HttpError(400, `An ensemble takes at most ${MAX_ENSEMBLE_REFS} images.`);
  }

  /* `restricted: false` on the fallback deliberately. A classification that did
     not happen is not evidence of anything, and refusing a shoot because the
     classifier was unreachable would turn a network blip into a rejected
     upload. The image model's own filter still sits behind this. */
  const fallback = files.map<{
    role: RefRole;
    confidence: number;
    reason: string;
    restricted: boolean;
  } & typeof EMPTY_ATTRS>(() => ({
    role: asRole(null, mode),
    confidence: 0,
    reason: '',
    restricted: false,
    ...EMPTY_ATTRS,
  }));

  if (PROVIDER === 'mock') {
    return json({
      results: files.map((_, i) => ({
        role: ROLES_FOR[mode][i % ROLES_FOR[mode].length],
        confidence: 0.55,
        reason: 'demo mode , no AI key set',
        restricted: false,
        ...EMPTY_ATTRS,
      })),
    });
  }

  let shrunk: Buffer[];
  try {
    shrunk = await Promise.all(
      files.map(async (f) =>
        sharp(Buffer.from(await f.arrayBuffer()))
          .rotate()
          .resize({ width: DETECT_PX, height: DETECT_PX, fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 80 })
          .toBuffer(),
      ),
    );
  } catch {
    throw new HttpError(400, 'One of those images could not be read , use JPG, PNG or WebP.');
  }

  // Each image is labelled inline so "in the order given" is unambiguous to the
  // model rather than something it has to infer from part ordering.
  const parts: Array<Record<string, unknown>> = [];
  shrunk.forEach((b, i) => {
    parts.push({ text: `Image ${i + 1}:` });
    parts.push({ inlineData: { mimeType: 'image/jpeg', data: b.toString('base64') } });
  });
  // Appended to whichever mode prompt applies, rather than written into both,
  // so the rule cannot drift between them.
  parts.push({ text: SYSTEM[mode] + ' ' + RESTRICTED_RULE + ' ' + ATTRIBUTES_RULE });

  try {
    const resp = await client().models.generateContent({
      model: TEXT_MODEL_ID,
      contents: [{ role: 'user', parts }],
      config: { responseMimeType: 'application/json', temperature: 0 },
    } as Parameters<GoogleGenAI['models']['generateContent']>[0]);

    const raw = (resp?.text ?? '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    const arr: unknown = JSON.parse(raw);
    if (!Array.isArray(arr)) throw new Error('not an array');

    // Indexed positionally, never by the model's own "index" field , a wrong
    // index there would silently retag the wrong image.
    const results = files.map((_, i) => {
      const row = (arr[i] ?? {}) as Record<string, unknown>;
      const conf = Number(row.confidence);
      return {
        role: asRole(row.role, mode),
        confidence: Number.isFinite(conf) ? Math.max(0, Math.min(1, conf)) : 0.5,
        reason: String(row.reason ?? '').slice(0, 90),
        // Flag anything the model itself wasn't sure of, so the UI can ask.
        unsure: !isRoleFor(row.role, mode) || (Number.isFinite(conf) && conf < 0.6),
        // Strict equality: anything but an explicit true is treated as allowed.
        restricted: row.restricted === true,
        ...attrs(row),
      };
    });

    return json({ results });
  } catch (e) {
    console.error('[ensemble] auto-detect failed , falling back to manual tagging', e);
    return json({ results: fallback.map((r) => ({ ...r, unsure: true })) });
  }
});
