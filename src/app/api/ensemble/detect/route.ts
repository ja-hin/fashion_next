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

/** Classification only — the detail that matters is the item's kind, not its texture. */
const DETECT_PX = 512;

/**
 * The two modes ask genuinely different questions of the same picture — "which
 * item is this?" versus "which side of this garment am I looking at?" — so each
 * gets its own instructions rather than one prompt with a swapped word list.
 */
const SYSTEM: Record<RefMode, string> = {
  ensemble: [
    'You are a fashion catalogue assistant. You are given several product images that belong to',
    'ONE hero shot, each showing a DIFFERENT item. For EACH image, in the exact order given,',
    `classify what it shows using ONLY roles from this list: ${ROLES_FOR.ensemble.join(', ')}.`,
    '"garment" means a dress or one-piece that covers the whole body; use "top" and "bottom"',
    'only for separates.',
    'Use "back" when an image is clearly the REVERSE VIEW of a garment shown in another image —',
    'the same colour and fabric photographed from behind, typically with no front print, a rear',
    'neckline or a back zip. It is a second view, not another item.',
    'If an image shows a person wearing the item, classify the ITEM, not the person.',
    'Return STRICT JSON only — an array with one object per image, in order:',
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
    'Judge the VIEW, not the garment type — every image is the same garment.',
    'If an image shows a person wearing it, judge which side of them faces the camera.',
    'Return STRICT JSON only — an array with one object per image, in order:',
    '[{"index":0,"role":"front","confidence":0.0-1.0,"reason":"few words"}]',
    'confidence is your certainty; reason is a short phrase naming what you saw.',
    'No prose, no code fences, JSON only.',
  ].join(' '),
};

let _client: GoogleGenAI | null = null;
const client = () => (_client ??= new GoogleGenAI({ apiKey: GEMINI_API_KEY }));

/**
 * Guess what each uploaded ensemble reference is.
 *
 * Purely a convenience: the roles it returns are pre-selected in the UI and the
 * user can change any of them before generating. Which is why a failure here
 * returns low-confidence defaults rather than an error — a wrong guess the user
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

  const fallback = files.map<{ role: RefRole; confidence: number; reason: string }>(() => ({
    role: asRole(null, mode),
    confidence: 0,
    reason: '',
  }));

  if (PROVIDER === 'mock') {
    return json({
      results: files.map((_, i) => ({
        role: ROLES_FOR[mode][i % ROLES_FOR[mode].length],
        confidence: 0.55,
        reason: 'demo mode — no AI key set',
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
    throw new HttpError(400, 'One of those images could not be read — use JPG, PNG or WebP.');
  }

  // Each image is labelled inline so "in the order given" is unambiguous to the
  // model rather than something it has to infer from part ordering.
  const parts: Array<Record<string, unknown>> = [];
  shrunk.forEach((b, i) => {
    parts.push({ text: `Image ${i + 1}:` });
    parts.push({ inlineData: { mimeType: 'image/jpeg', data: b.toString('base64') } });
  });
  parts.push({ text: SYSTEM[mode] });

  try {
    const resp = await client().models.generateContent({
      model: TEXT_MODEL_ID,
      contents: [{ role: 'user', parts }],
      config: { responseMimeType: 'application/json', temperature: 0 },
    } as Parameters<GoogleGenAI['models']['generateContent']>[0]);

    const raw = (resp?.text ?? '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    const arr: unknown = JSON.parse(raw);
    if (!Array.isArray(arr)) throw new Error('not an array');

    // Indexed positionally, never by the model's own "index" field — a wrong
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
      };
    });

    return json({ results });
  } catch (e) {
    console.error('[ensemble] auto-detect failed — falling back to manual tagging', e);
    return json({ results: fallback.map((r) => ({ ...r, unsure: true })) });
  }
});
