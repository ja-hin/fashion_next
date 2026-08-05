/**
 * The AI provider layer.
 *
 * Two modes, decided once at boot by whether GEMINI_API_KEY is set:
 *   "gemini"  live generation
 *   "mock"    DEMO placeholders, so the whole app is clickable with no key
 *
 * Note on concurrency: the Python original stashed the requested output
 * resolution and the last call's token usage in `threading.local()`. Node runs
 * many generations on one event loop, where that pattern would leak state
 * between concurrent shoots — so both are passed and returned explicitly here.
 */
import 'server-only';
import { GoogleGenAI } from '@google/genai';
import {
  GEMINI_API_KEY,
  PROVIDER,
  BASE_MODEL_ID,
  HERO_MODEL_ID,
  LOG_PROMPTS,
} from './config';
import { mockGenerate } from './images';
import { usdCost } from './logs';
import { GENIE_SYSTEM } from './prompts';
import type { Resolution } from './types';

/** Token usage captured from one AI call, for the Logs tab. */
export interface Usage {
  ai_model: string;
  in_tok: number;
  out_tok: number;
  tot_tok: number;
  usd: number;
}

export interface GenResult {
  image: Buffer;
  usage: Usage;
}

let _client: GoogleGenAI | null = null;
function client(): GoogleGenAI {
  if (!_client) _client = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  return _client;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function readUsage(modelId: string, resp: unknown): Usage {
  try {
    const um = (resp as { usageMetadata?: Record<string, number> })?.usageMetadata;
    const pin = Number(um?.promptTokenCount ?? 0) || 0;
    const pout = Number(um?.candidatesTokenCount ?? 0) || 0;
    const tot = Number(um?.totalTokenCount ?? 0) || pin + pout;
    return { ai_model: modelId, in_tok: pin, out_tok: pout, tot_tok: tot, usd: usdCost(modelId, pin, pout) };
  } catch {
    return { ai_model: modelId, in_tok: 0, out_tok: 0, tot_tok: 0, usd: 0 };
  }
}

/** flash-lite only emits 1K; 2K/4K require the heavier flash-image model. */
function resolveModel(modelId?: string | null, imageSize?: Resolution | null): string {
  const model = modelId || BASE_MODEL_ID;
  const needsHero = imageSize === '2K' || imageSize === '4K';
  return needsHero && model === BASE_MODEL_ID ? HERO_MODEL_ID : model;
}

/**
 * Dump the outgoing prompt to the server console when LOG_PROMPTS is on.
 * Logged per attempt, not per call, so reseeds and retries are each visible
 * with the seed they actually used.
 */
function logPrompt(
  opts: {
    prompt: string;
    garment?: Buffer | null;
    hero?: Buffer | null;
    seed?: number | null;
    ar?: string | null;
    pose?: string;
    modelId?: string | null;
    imageSize?: Resolution | null;
  },
  attempt: number,
  tries: number,
): void {
  if (!LOG_PROMPTS) return;
  const refs = [opts.garment && 'garment', opts.hero && 'hero'].filter(Boolean);
  console.log(
    [
      '',
      '─── AI PROMPT ' + '─'.repeat(56),
      `engine   ${PROVIDER === 'mock' ? 'mock (DEMO)' : resolveModel(opts.modelId, opts.imageSize)}`,
      `pose     ${opts.pose ?? '—'}`,
      `seed     ${opts.seed ?? '—'}   attempt ${attempt}/${tries}`,
      `ar       ${opts.ar ?? '—'}   size ${opts.imageSize ?? '1K'}`,
      `images   ${refs.length ? refs.join(' + ') : 'none (text only)'}`,
      '',
      opts.prompt,
      '─'.repeat(70),
      '',
    ].join('\n'),
  );
}

/** One live Gemini image call. Throws on block / empty result. */
async function geminiGenerate(opts: {
  prompt: string;
  garment?: Buffer | null;
  hero?: Buffer | null;
  seed?: number | null;
  ar?: string | null;
  allowRevealing?: boolean;
  modelId?: string | null;
  imageSize?: Resolution | null;
}): Promise<GenResult> {
  const parts: Array<Record<string, unknown>> = [];
  if (opts.garment) {
    parts.push({ inlineData: { data: opts.garment.toString('base64'), mimeType: 'image/jpeg' } });
  }
  if (opts.hero) {
    parts.push({ inlineData: { data: opts.hero.toString('base64'), mimeType: 'image/jpeg' } });
  }
  parts.push({ text: opts.prompt });

  const model = resolveModel(opts.modelId, opts.imageSize);

  const imageConfig: Record<string, string> = {};
  if (opts.ar) imageConfig.aspectRatio = opts.ar;
  if (opts.imageSize) imageConfig.imageSize = opts.imageSize;

  const config: Record<string, unknown> = {
    responseModalities: ['IMAGE', 'TEXT'],
    temperature: 1.0,
  };
  if (opts.seed) config.seed = opts.seed;
  if (opts.allowRevealing) {
    // Relaxed only when the caller explicitly opts in. gen.ts forces this off
    // for the kidswear category — child-safety filters are never relaxed.
    config.safetySettings = [
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
    ];
  }
  if (Object.keys(imageConfig).length) config.imageConfig = imageConfig;

  const resp = await client().models.generateContent({
    model,
    contents: [{ role: 'user', parts }],
    config,
  } as Parameters<GoogleGenAI['models']['generateContent']>[0]);

  const usage = readUsage(model, resp);

  const candidates = resp?.candidates ?? [];
  if (!candidates.length) throw new Error('AI: no result');

  const c = candidates[0];
  const finish = String(c?.finishReason ?? '');
  if (!c?.content || finish.includes('SAFETY') || finish.includes('OTHER')) {
    throw new Error(`blocked (${finish})`);
  }

  for (const p of c.content.parts ?? []) {
    const inline = (p as { inlineData?: { mimeType?: string; data?: string } }).inlineData;
    if (inline?.data && String(inline.mimeType ?? '').startsWith('image/')) {
      return { image: Buffer.from(inline.data, 'base64'), usage };
    }
  }
  throw new Error('AI: no image');
}

/**
 * Generate one image, with the retry policy of the original `produce()`:
 *   - rate limits (429 / RESOURCE_EXHAUSTED) always retry, backing off 3s, 6s
 *   - soft content blocks (IMAGE_OTHER) retry only when `retryBlock` is set;
 *     the saved-model path turns that off so it can reseed instead, which
 *     preserves the locked identity rather than rolling the dice on the same seed
 *   - anything else fails immediately
 */
export async function produce(opts: {
  prompt: string;
  garment?: Buffer | null;
  hero?: Buffer | null;
  seed?: number | null;
  ar?: string | null;
  allowRevealing?: boolean;
  pose?: string;
  tries?: number;
  retryBlock?: boolean;
  modelId?: string | null;
  imageSize?: Resolution | null;
}): Promise<GenResult> {
  const tries = opts.tries ?? 3;
  const retryBlock = opts.retryBlock ?? true;
  let last: unknown = null;

  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      logPrompt(opts, attempt + 1, tries);
      if (PROVIDER === 'gemini') return await geminiGenerate(opts);
      const image = await mockGenerate(opts.seed ?? null, opts.ar ?? '4:5', opts.pose ?? 'pose');
      return {
        image,
        usage: { ai_model: 'demo', in_tok: 0, out_tok: 0, tot_tok: 0, usd: 0 },
      };
    } catch (e) {
      last = e;
      const msg = String((e as Error)?.message ?? e);
      const transient = msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED');
      const softBlock = msg.includes('IMAGE_OTHER');
      if ((transient || (softBlock && retryBlock)) && attempt < tries - 1) {
        await sleep(3000 * (attempt + 1));
        continue;
      }
      throw e;
    }
  }
  throw last instanceof Error ? last : new Error(String(last));
}

/**
 * Prompt Genie: sharpen a pose/scene description. Constrained by GENIE_SYSTEM
 * so it can never change the model's identity or the garment.
 */
export async function genieText(userText: string): Promise<{ text: string; usage: Usage | null }> {
  const input = userText ?? '';

  if (PROVIDER === 'mock') {
    const base = input.trim().replace(/[.\s]+$/, '') || 'a natural pose';
    return {
      text: `${base}, cinematic soft light, sharp focus on the garment, editorial composition, natural confident expression.`,
      usage: null,
    };
  }

  const model = BASE_MODEL_ID;
  const resp = await client().models.generateContent({
    model,
    contents: [{ role: 'user', parts: [{ text: `${GENIE_SYSTEM}\n\nUser: ${input}` }] }],
  } as Parameters<GoogleGenAI['models']['generateContent']>[0]);

  const usage = readUsage(model, resp);
  const text = (resp?.text ?? '').trim();
  return { text: text || input, usage };
}

export { PROVIDER };