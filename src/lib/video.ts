/**
 * The video provider layer.
 *
 * Ported from the Omni video studio tester. One 10-second fashion video is
 * generated from the stills of an existing shoot: those frames are the
 * reference lock, so the person and the garment in the video are the ones the
 * customer already approved rather than a fresh invention.
 *
 * Mirrors lib/gemini.ts deliberately — same two modes decided by the same key,
 * same Usage shape for the Logs tab, same "throw with a readable message"
 * contract — so the two providers are read as one layer, not two.
 */
import 'server-only';
import { GoogleGenAI } from '@google/genai';
import { GEMINI_API_KEY, PROVIDER, TEXT_MODEL_ID, VIDEO_MODEL_ID } from './config';
import type { Usage } from './gemini';
import {
  REFERENCE_LOCK,
  CUSTOM_SKELETON,
  withLock,
  type VideoBrief,
} from './video-presets';

export interface VideoResult {
  /** The finished mp4. */
  video: Buffer;
  usage: Usage;
  /** Wall-clock seconds the model took, for the log row. */
  seconds: number;
}

/**
 * Gemini's published Omni rates, which are NOT the image rates in lib/logs.ts —
 * output is an order of magnitude dearer per token. Used only to record what a
 * generation cost us; what the customer pays is the credits grid.
 */
const USD_PER_1M_IN = 1.5;
const USD_PER_1M_OUT = 17.5;

let _client: GoogleGenAI | null = null;
function client(): GoogleGenAI {
  if (!_client) _client = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  return _client;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function readUsage(model: string, interaction: unknown): Usage {
  const u = (interaction as { usage?: Record<string, number> })?.usage ?? {};
  const num = (k: string) => Number(u?.[k] ?? 0) || 0;
  const inTok = num('total_input_tokens');
  // Thought tokens are billed at the output rate, so they belong in the output
  // column rather than being dropped — they are most of the bill on a video.
  const outTok = num('total_output_tokens') + num('total_thought_tokens');
  const usd = (inTok / 1e6) * USD_PER_1M_IN + (outTok / 1e6) * USD_PER_1M_OUT;
  return {
    ai_model: model,
    in_tok: inTok,
    out_tok: outTok,
    tot_tok: inTok + outTok,
    usd: Math.round(usd * 1e4) / 1e4,
  };
}

/**
 * Pull the finished mp4 out of an interaction.
 *
 * The May-2026 Interactions schema returns output as a `steps` array of typed
 * content blocks, so a video arrives as a `{type:'video'}` block carrying either
 * the bytes or a Files URI. The pre-2.0 `output_video` field is still checked
 * after that: it costs one property read and it is what a cached or replayed
 * older response looks like.
 *
 * Either way the URI branch is the common one — Google hands back a file that
 * is still processing, so it has to be polled before it can be downloaded.
 */
async function videoBytes(interaction: Record<string, unknown>): Promise<Buffer> {
  let uri: string | null = null;

  for (const step of (interaction.steps as Array<Record<string, unknown>>) ?? []) {
    for (const part of (step.content as Array<Record<string, unknown>>) ?? []) {
      if (part.type !== 'video') continue;
      if (typeof part.data === 'string') {
        const b = Buffer.from(part.data, 'base64');
        // A handful of bytes is an error payload, not a video.
        if (b.length > 1000) return b;
      }
      uri = uri ?? ((part.uri as string) || null);
    }
  }

  // Legacy shape, pre-2.0 SDK.
  const legacy = interaction.output_video as { data?: string; uri?: string } | undefined;
  if (legacy?.data) {
    const b = Buffer.from(legacy.data, 'base64');
    if (b.length > 1000) return b;
  }
  uri = uri ?? legacy?.uri ?? null;

  if (uri) {
    // A Files URI is handed back before the file is ready. Poll until Google
    // says ACTIVE — downloading early returns a truncated or empty body.
    const id = uri.includes('/files/')
      ? uri.split('/files/')[1].split(/[:?/]/)[0]
      : null;
    if (id) {
      for (let i = 0; i < 200; i++) {
        let state: string | null = null;
        try {
          const info = (await client().files.get({ name: 'files/' + id })) as {
            state?: string | { name?: string };
          };
          state =
            typeof info.state === 'string' ? info.state : (info.state?.name ?? null);
        } catch {
          // A transient lookup failure is not fatal — keep polling.
        }
        if (state === 'ACTIVE') break;
        if (state === 'FAILED') throw new Error('Google reported the video failed processing.');
        await sleep(3000);
      }
    }
    const dl = uri.includes('alt=media')
      ? uri
      : uri.split('?')[0].replace(/\/+$/, '') + ':download?alt=media';
    const res = await fetch(dl, { headers: { 'x-goog-api-key': GEMINI_API_KEY } });
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > 1000) return buf;
    }
  }

  throw new Error(
    'The video model returned nothing downloadable. If the brief tripped a ' +
      'content filter, this is what that looks like — try a different preset.',
  );
}

/**
 * Ask the text model to rewrite the brief from a plain-English instruction.
 *
 * Deliberately edits slots rather than appending to the prompt: "shoot it at
 * sunset" should change `background`, not bolt a second setting onto the end of
 * a shot list that still says "seamless studio backdrop".
 *
 * Falls back to appending when anything goes wrong, so a Genie outage costs the
 * customer a less precise brief rather than their whole generation.
 */
export async function customiseBrief(
  brief: VideoBrief,
  instruction: string,
): Promise<{ brief: VideoBrief; gist: string }> {
  const fallback = () => ({
    brief: { ...brief, prompt: brief.prompt + ' Additional direction: ' + instruction },
    gist: 'Custom: ' + instruction,
  });
  if (PROVIDER === 'mock') return fallback();

  const system =
    'You edit a JSON brief for an AI fashion-video generator. Return ONLY a JSON object ' +
    'with two keys: "brief" and "gist". In "brief", change ONLY what the user\'s request ' +
    'implies (setting/background, lighting, mood, pace, camera style, music). NEVER change ' +
    'or remove the reference-lock wording that keeps the model\'s identity and the exact ' +
    'garment consistent, and never remove "no additional people" or "no text, no logos". ' +
    'Keep the shot timecodes and duration unless the user explicitly asks to change them. ' +
    '"gist" is ONE short plain-English line describing the final plan (setting, mood, pace, ' +
    'music) with no JSON or technical terms.\n\nCurrent brief:\n' +
    JSON.stringify(brief) +
    '\n\nUser request:\n' +
    instruction +
    '\n\nReturn only the JSON, no markdown.';

  try {
    const res = await client().models.generateContent({
      model: TEXT_MODEL_ID,
      contents: system,
    });
    let txt = (res.text ?? '').trim();
    if (txt.includes('```')) {
      const fenced = txt.split('```');
      txt = (fenced[1] ?? txt).replace(/^json/i, '').trim();
    }
    const obj = JSON.parse(txt) as { brief?: VideoBrief; gist?: string };
    const next = obj.brief && typeof obj.brief === 'object' ? obj.brief : brief;

    // The Genie is told to leave the lock alone; this is what happens when it
    // does not. Putting it back beats refusing the edit — the customer gets
    // their change AND keeps the identity guarantee they are paying for.
    return {
      brief: withLock({ ...brief, ...next }),
      gist: (obj.gist ?? '').trim() || 'Custom: ' + instruction,
    };
  } catch {
    return fallback();
  }
}

/**
 * Write a whole brief from a plain-English description — no preset behind it.
 *
 * The preset path edits slots on an existing shot list; this one authors the
 * shot list too, which is what "a completely new scene" actually needs. The
 * model is given the brief's shape and the 10-second structure and asked to
 * fill it, then the result is merged onto a skeleton so a missing slot is a
 * default rather than `undefined`, and the lock is prepended — the model is
 * never told the lock, so it can never include it, and a scene description
 * asking for neon signage would otherwise quietly override "no text, no logos".
 */
export async function authorBrief(
  description: string,
): Promise<{ brief: VideoBrief; gist: string }> {
  const fallback = () => ({
    brief: withLock({
      ...CUSTOM_SKELETON,
      background: description,
      prompt:
        `Create a polished 10-second fashion video. ${description} ` +
        '0-3s: full-body establishing shot. 3-6s: three-quarter view showing fit and ' +
        'silhouette. 6-8s: close-up on the garment detail. 8-10s: final full-body pose, ' +
        'gentle push-in, clean ending. The music resolves and fades out smoothly over the ' +
        'final second, then silence.',
    }),
    gist: description,
  });
  if (PROVIDER === 'mock') return fallback();

  const system =
    'You are a fashion-film director. Write a complete brief for an AI video generator ' +
    'as JSON with exactly these keys: duration, style, background, prompt, ' +
    'camera{movement,transitions,framing}, music, quality. The video is exactly 10 ' +
    'seconds, so "prompt" must contain a shot list with timecodes covering 0-10s and must ' +
    'end by saying the music resolves and fades out over the final second. The video is ' +
    'built from reference photographs of one model in one garment, so never describe a ' +
    'different person, a different outfit, additional people, on-screen text, signage or ' +
    'logos. Also return "gist": ONE short plain line for the customer describing the ' +
    'setting, mood, pace and music, with no JSON or technical terms.\n\n' +
    'The customer describes the video they want:\n' +
    description +
    '\n\nReturn only {"brief":{...},"gist":"..."} with no markdown.';

  try {
    const res = await client().models.generateContent({
      model: TEXT_MODEL_ID,
      contents: system,
    });
    let txt = (res.text ?? '').trim();
    if (txt.includes('```')) {
      const fenced = txt.split('```');
      txt = (fenced[1] ?? txt).replace(/^json/i, '').trim();
    }
    const obj = JSON.parse(txt) as { brief?: Partial<VideoBrief>; gist?: string };
    if (!obj.brief || typeof obj.brief.prompt !== 'string') return fallback();

    return {
      brief: withLock({
        ...CUSTOM_SKELETON,
        ...obj.brief,
        camera: { ...CUSTOM_SKELETON.camera, ...(obj.brief.camera ?? {}) },
      }),
      gist: (obj.gist ?? '').trim() || description,
    };
  } catch {
    return fallback();
  }
}

/**
 * One video generation.
 *
 * `frames` are the shoot stills that lock identity, in the order the customer
 * picked them. More than one is a `reference_to_video` task; a single frame is
 * `image_to_video`. Text-only is never reached from the studio — a video with
 * no reference has nothing to keep consistent — but the model supports it and
 * the task name is set correctly if it ever is.
 */
export async function generateVideo(opts: {
  frames: Buffer[];
  brief: VideoBrief;
  aspect: string;
}): Promise<VideoResult> {
  const t0 = Date.now();

  if (PROVIDER === 'mock') {
    // Enough of an mp4 container for a player to load and report a duration.
    await sleep(1200);
    return {
      video: Buffer.from(
        'AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAAAhtZGF0',
        'base64',
      ),
      usage: { ai_model: 'mock', in_tok: 0, out_tok: 0, tot_tok: 0, usd: 0 },
      seconds: 1.2,
    };
  }

  // Typed as the SDK's own content union rather than a loose record, so a
  // mis-shaped part is a build error rather than a 400 a minute into a paid call.
  const input: Array<
    | { type: 'image'; data: string; mime_type: string }
    | { type: 'text'; text: string }
  > = opts.frames.map((b) => ({
    type: 'image' as const,
    data: b.toString('base64'),
    mime_type: 'image/jpeg',
  }));
  // The brief goes in as JSON rather than prose: the model reads the slots, and
  // it is the same object the Genie edits, so what ships is what was shown.
  input.push({ type: 'text' as const, text: JSON.stringify(opts.brief) });

  const task =
    opts.frames.length > 1
      ? 'reference_to_video'
      : opts.frames.length === 1
        ? 'image_to_video'
        : 'text_to_video';

  // Typed against the SDK rather than cast to a bag of unknowns: the May-2026
  // schema change surfaced as a 400 at runtime precisely because this call was
  // untyped. Written this way, the next one is a build failure.
  const interaction = await client().interactions.create({
    model: VIDEO_MODEL_ID,
    input,
    response_format: { type: 'video', aspect_ratio: opts.aspect, delivery: 'uri' },
    generation_config: { video_config: { task } },
  });

  const video = await videoBytes(interaction as unknown as Record<string, unknown>);
  return {
    video,
    usage: readUsage(VIDEO_MODEL_ID, interaction),
    seconds: Math.round((Date.now() - t0) / 100) / 10,
  };
}
