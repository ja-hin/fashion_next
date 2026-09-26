/**
 * FASHN , the intimate-apparel path.
 *
 * Gemini refuses to render an identifiable person's photograph in lingerie:
 * flash-lite, flash-image and pro all return IMAGE_SAFETY on the anchored call,
 * every time, whatever the prompt says. That is a policy limit, not a quality
 * one, and no engine setting gets around it.
 *
 * FASHN is a fashion-specific API whose product-to-model endpoint supports the
 * category natively AND takes the identity as a first-class input , a
 * `face_reference` image, rather than a photo smuggled into a prompt and a
 * paragraph begging the model to use only the face from it. That is the whole
 * reason this exists: it is the one route that keeps a saved model recognisable
 * on the Special Category desk.
 *
 * Lifted from the standalone tester at project/fashn-lingerie-module, which is
 * where the endpoint choices were worked out , see its README for why
 * product-to-model rather than tryon-v1.6 (that model excluded lingerie and
 * swimwear from training) and why `moderation_level` is not sent here (it only
 * exists on the try-on endpoints).
 */
import 'server-only';
import { FASHN_API_KEY } from './config';

const BASE = 'https://api.fashn.ai/v1';

/** Matched to the tester. Quality + 4K can take ~55s; the rest is headroom. */
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 110_000;

/**
 * Per-request ceiling, because one of these really did hang for five minutes
 * during testing , undici's own headers timeout was what eventually killed it.
 * Without a bound, a stalled socket holds the whole shoot open past the job's
 * budget and the customer watches a spinner for the difference.
 */
const REQUEST_TIMEOUT_MS = 45_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** FASHN's own credits, per OUTPUT IMAGE. Their authoritative table. */
export const CREDIT_TABLE: Record<GenerationMode, Record<FashnResolution, number>> = {
  fast: { '1k': 1, '2k': 2, '4k': 3 },
  balanced: { '1k': 2, '2k': 3, '4k': 4 },
  quality: { '1k': 3, '2k': 4, '4k': 5 },
};

/** A face reference costs three credits on top, per image. */
export const FACE_REFERENCE_CREDITS = 3;

export type GenerationMode = 'fast' | 'balanced' | 'quality';
export type FashnResolution = '1k' | '2k' | '4k';

/**
 * Our resolutions are upper-case and FASHN's are not, and 4K on our side is a
 * bigger render than FASHN's 4k tier , but the tiers line up one to one, so
 * this is a case fold rather than a mapping table.
 */
export const toFashnRes = (r: string): FashnResolution => {
  const v = String(r).toLowerCase();
  return v === '2k' || v === '4k' ? v : '1k';
};

/** FASHN's supported aspect ratios. Ours that do not appear here fall back. */
const ASPECTS = new Set(['3:4', '4:5', '2:3', '1:1', '9:16', '4:3', '3:2', '5:4', '16:9']);

export interface FashnCost {
  /** FASHN credits , NOT our wallet credits. Logged so the spend is visible. */
  credits: number;
  mode: GenerationMode;
  resolution: FashnResolution;
  faceReference: boolean;
}

export interface FashnResult {
  images: Buffer[];
  cost: FashnCost;
  id: string;
}

const dataUri = (b: Buffer) => `data:image/jpeg;base64,${b.toString('base64')}`;

/**
 * FASHN's `error` is sometimes a string and sometimes `{ name, message }`.
 * Named first, because the name is what decides the fix , a
 * ContentModerationError needs a different input, a bad request needs a code
 * change, and "[object Object]" tells you neither.
 */
function describeError(err: unknown): string {
  if (!err) return 'unknown';
  if (typeof err === 'string') return err;
  const e = err as { name?: string; message?: string };
  return [e.name, e.message].filter(Boolean).join(': ') || JSON.stringify(err).slice(0, 200);
}

/*
 * THERE IS DELIBERATELY NO DEFAULT PROMPT. Measured, not assumed.
 *
 * A coverage prompt used to be sent with every run , it told the endpoint to
 * pair a bottom-only garment with a matching top, on the theory that a topless
 * figure was what moderation objected to. Four controlled runs against the live
 * API say otherwise:
 *
 *   garment alone, with that prompt, no face      , completed
 *   garment alone, no prompt, no face             , completed
 *   garment + face_reference, no prompt           , completed
 *   garment + face_reference + that prompt        , ContentModerationError
 *
 * So the bottom-only garment was never the problem, and neither was the face.
 * The prompt and the face reference together were: text describing what a body
 * is and is not covered by, alongside an identity photo, is what the filter
 * stops. The prompt written to prevent a block was causing it.
 *
 * product-to-model builds its own styling from the product image and needs no
 * help doing it , every run without a prompt completed. A caller may still pass
 * one, but nothing in the app does, and anything added here should be tested
 * against a face reference before it ships.
 */

/**
 * Garment in, on-model shot out, optionally locked to a face.
 *
 * Throws on anything that is not a finished job, so the caller can fall through
 * to whatever it does for a refusal , this is one more way of generating a
 * hero, not a separate feature with its own error surface.
 */
export async function productToModel(opts: {
  /** The garment. FASHN takes ONE product image, not a manifest. */
  garment: Buffer;
  /** The saved model's character-sheet frame , the identity lock. */
  face?: Buffer | null;
  resolution?: string;
  aspect?: string | null;
  mode?: GenerationMode;
  /** Extra styling direction. The endpoint builds its own scene without it. */
  prompt?: string;
  seed?: number | null;
}): Promise<FashnResult> {
  if (!FASHN_API_KEY) throw new Error('FASHN_API_KEY is not set');

  const resolution = toFashnRes(opts.resolution ?? '1K');
  const mode: GenerationMode = opts.mode ?? 'balanced';
  const face = opts.face ?? null;

  const inputs: Record<string, unknown> = {
    product_image: dataUri(opts.garment),
    resolution,
    generation_mode: mode,
    num_images: 1,
    output_format: 'png',
    return_base64: false,
  };
  if (face) inputs.face_reference = dataUri(face);
  if (opts.aspect && ASPECTS.has(opts.aspect)) inputs.aspect_ratio = opts.aspect;
  // Only when a caller actually asks for one , see the note above.
  if (opts.prompt?.trim()) inputs.prompt = opts.prompt.trim();
  if (typeof opts.seed === 'number' && Number.isFinite(opts.seed)) inputs.seed = opts.seed;

  // ── 1. start the job ──
  const runRes = await fetch(`${BASE}/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${FASHN_API_KEY}` },
    body: JSON.stringify({ model_name: 'product-to-model', inputs }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const runJson = (await runRes.json().catch(() => ({}))) as Record<string, unknown>;
  if (!runRes.ok || !runJson?.id) {
    // FASHN returns `error` as an object on some failures and a string on
    // others. String() on the object gives "[object Object]", which is the
    // least useful thing a log can say about why a shoot did not run.
    throw new Error(`FASHN run failed (${runRes.status}): ${describeError(runJson?.error)}`);
  }
  const id = String(runJson.id);

  // ── 2. poll ──
  const started = Date.now();
  let outputs: string[] = [];
  while (Date.now() - started < POLL_TIMEOUT_MS) {
    await sleep(POLL_INTERVAL_MS);

    let s: Record<string, unknown>;
    try {
      const r = await fetch(`${BASE}/status/${id}`, {
        headers: { Authorization: `Bearer ${FASHN_API_KEY}` },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      s = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    } catch {
      continue; // transient blip , keep polling rather than failing the shoot
    }

    const status = String(s?.status ?? 'unknown');
    if (status === 'completed') {
      outputs = (s.output as string[]) ?? [];
      break;
    }
    if (status === 'failed') {
      throw new Error(`FASHN failed: ${describeError(s?.error)}`);
    }
    // starting | in_queue | processing , keep going
  }

  if (!outputs.length) {
    throw new Error('FASHN timed out before returning an image');
  }

  // ── 3. bring the pixels home ──
  // FASHN hands back URLs on its own storage. Everything downstream , the
  // gallery, derivatives, download, later poses , works on bytes we hold, so
  // they are fetched here rather than referenced.
  const images: Buffer[] = [];
  for (const url of outputs) {
    const r = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (!r.ok) throw new Error(`FASHN output unreachable (${r.status})`);
    images.push(Buffer.from(await r.arrayBuffer()));
  }

  return {
    images,
    id,
    cost: {
      credits: CREDIT_TABLE[mode][resolution] + (face ? FACE_REFERENCE_CREDITS : 0),
      mode,
      resolution,
      faceReference: !!face,
    },
  };
}
