/**
 * Genie — the conversational art director behind the Add Pose drawer.
 *
 * Port of the standalone genie_studio prototype. The difference from the older
 * one-shot Prompt Genie (lib/gemini.ts `genieText`) is that this one knows what
 * shoot it is working on: the MODEL and the GARMENT are locked by the hero, and
 * the only things it may move are pose, framing and the scene. That anchor is
 * what turns "make it better" from a vague rewrite into a usable direction.
 *
 * It returns a SPEC, not prose — pose text plus framing/backdrop/mood/lighting —
 * because the drawer applies those straight onto the Add Pose card's selects.
 * Which is also why the scene fields are constrained to the app's own
 * vocabulary (lib/scene-vocab.ts): a poetic "sunlit terrace" would land on a
 * <Select> with no matching option and render as blank.
 */
import 'server-only';
import { GoogleGenAI } from '@google/genai';
import { GEMINI_API_KEY, PROVIDER, TEXT_MODEL_ID } from './config';
import { FRAMING_KEYS, BACKDROP_KEYS, MOODS, LIGHTINGS } from './scene-vocab';
import { stylePhrase, GENDER_BY_CAT, KID_CATS } from './prompts';
import type { ShootDoc } from './types';

export interface GenieMessage {
  role: 'user' | 'genie';
  text: string;
}

/** What the drawer applies to the Add Pose card. */
export interface GenieSpec {
  pose: string;
  framing: string;
  /** True = leave the card's scene selects on "same" and reuse the hero scene. */
  keep_scene: boolean;
  backdrop: string;
  lighting: string;
  mood: string;
  notes: string;
  /**
   * A precise free-text description of the scene to recreate, set only when a
   * reference image was analysed.
   *
   * The dropdown vocabulary exists so Genie's answers can populate <Select>s,
   * but "match THIS photo exactly" is precisely the case a fixed list cannot
   * express — "outdoor street" throws away everything that made the reference
   * worth matching. sceneClause() falls back to `a <value> background` for any
   * value it doesn't recognise (lib/prompts.ts), so free text flows through to
   * the image model intact. This field carries it.
   */
  scene_detail: string;
}

/** One shot inside a shoot set. Scene lives on the set, not the shot. */
export interface GenieShot {
  pose: string;
  framing: string;
}

/**
 * A catalogue: ONE shared scene plus N complementary shots. This is what feeds
 * the batch endpoint — every row inherits the set's scene, so the whole
 * catalogue looks like it was photographed in one session.
 */
export interface GenieSet {
  keep_scene: boolean;
  backdrop: string;
  lighting: string;
  mood: string;
  /** Free-text scene to recreate — see GenieSpec.scene_detail. */
  scene_detail: string;
  shots: GenieShot[];
}

export interface GenieTurn {
  /**
   * single    — one shot, applied to the Add Pose card.
   * series    — a shoot set the user can generate in one go.
   * ask_count — they asked for a set but gave no number; we offer chips.
   */
  mode: 'single' | 'series' | 'ask_count';
  reply: string;
  intent: 'refine_pose' | 'art_direct' | 'match_reference' | 'clarify';
  /** False when Genie is still asking questions and has nothing to apply yet. */
  ready: boolean;
  spec: GenieSpec;
  set: GenieSet | null;
  suggested_counts: number[];
  suggestions: string[];
}

/** Anything larger stops being a catalogue and starts being a bill. */
export const MAX_SET_SIZE = 12;

/**
 * Fallback framing order for set shots, as a photographer would build a
 * catalogue: establish wide, work in, finish on detail.
 */
const CATALOGUE_FRAMINGS = ['full_body', 'three_quarter', 'waist_up', 'knee_up', 'portrait', 'close_up'];

export const blankSpec = (): GenieSpec => ({
  pose: '',
  framing: 'three_quarter',
  keep_scene: true,
  backdrop: '',
  lighting: '',
  mood: '',
  notes: '',
  scene_detail: '',
});

// ── the anchor ──────────────────────────────────────────────────────

/**
 * The locked facts of this shoot, in the model's words.
 *
 * Derived on the server from the shoot record — never accepted from the client,
 * because it is interpolated into the system prompt and a caller who could set
 * it could rewrite Genie's instructions.
 */
function anchorLine(shoot: ShootDoc): string {
  const opts = shoot.opts ?? ({} as ShootDoc['opts']);
  const cat = (opts.category ?? '').trim();

  // The same helper the image prompts use, so Genie describes the hero exactly
  // as the generator does — including the per-shoot `look` variety phrase.
  const gender = GENDER_BY_CAT[cat] ?? 'female';
  const who = KID_CATS.has(cat)
    ? 'the locked child model (age-appropriate, fully clothed)'
    : stylePhrase(opts.style ?? '', gender, shoot.look ?? '');

  const scene = (opts.scene ?? '').trim() || 'as established in the hero image';

  return [
    `MODEL (locked, never change): ${who}.`,
    'GARMENT (locked, never change): the exact uploaded product garment — preserve colour, print, logo, cut and fabric.',
    `Category: ${cat || 'unspecified'}. Hero scene: ${scene}.`,
  ].join('\n');
}

const JSON_SHAPE = `{
  "reply": "<short chat message to show the user>",
  "mode": "single | series | ask_count",

  // mode = single:
  "intent": "refine_pose | art_direct | match_reference | clarify",
  "ready": <true when a usable pose is included>,
  "spec": {
    "pose": "<vivid, concise pose + gesture + expression, 1-2 sentences>",
    "framing": "<one of the framing values>",
    "keep_scene": <true to reuse the hero backdrop/lighting/mood, false to change them>,
    "backdrop": "<one of the backdrop values; '' when keep_scene>",
    "lighting": "<one of the lighting values; '' when keep_scene>",
    "mood": "<one of the mood values; '' when keep_scene>",
    "notes": "<one-line rationale>",
    "scene_detail": "<ONLY with a reference image: the full free-text scene to recreate; '' otherwise>"
  },

  // mode = series: ONE shared scene + exactly N shots
  "set": {
    "keep_scene": <true to reuse the hero scene for every shot>,
    "backdrop": "<one of the backdrop values; '' when keep_scene>",
    "lighting": "<one of the lighting values; '' when keep_scene>",
    "mood": "<one of the mood values; '' when keep_scene>",
    "scene_detail": "<ONLY with a reference image: the full free-text scene to recreate; '' otherwise>",
    "shots": [ { "pose": "<...>", "framing": "<one of the framing values>" } ]
  },

  // mode = ask_count:
  "suggested_counts": [3,4,6,8],

  "suggestions": ["<short follow-up idea>", "<short follow-up idea>"]
}`;

/**
 * The poses the user has already ticked on the card, if any.
 *
 * This is what makes "make these better" work on a multi-select: Genie is told
 * the exact list and required to return one rewritten shot per entry, in order,
 * so the set that comes back lines up 1:1 with what the user picked.
 */
function selectionBlock(selection: string[]): string {
  if (!selection.length) return '';
  const list = selection.map((p, i) => `  ${i + 1}. ${p}`).join('\n');

  // One pose has a natural home — the card's editable prompt box — so it comes
  // back as a single direction. Several can only be reviewed as a set.
  const rule =
    selection.length === 1
      ? [
          'When they ask to improve, refine, restyle or re-direct THIS pose, return mode=single',
          'with spec.pose set to a rewritten, vivid, production-ready version of it. Keep what the',
          'pose was fundamentally about — a standing pose stays standing, a seated one stays seated.',
        ]
      : [
          'When they ask to improve, refine, restyle or re-direct THESE poses, you MUST return',
          `mode=series with EXACTLY ${selection.length} shots — one per picked pose, IN THE SAME ORDER.`,
          'Each shot rewrites the corresponding pose above into vivid, production-ready wording while',
          'keeping what that pose was fundamentally about: a standing pose stays standing, a seated',
          'one stays seated. Never merge, drop, reorder or invent poses.',
        ];

  return [
    `\nTHE USER HAS ALREADY PICKED ${selection.length} POSE${selection.length === 1 ? '' : 'S'}:`,
    list,
    '',
    ...rule,
    'Set keep_scene=true unless they explicitly asked for a new scene.',
    'This does NOT override an explicit request for a catalogue or a set of a different size —',
    'that is still mode=series (or ask_count when they gave no number).',
  ].join('\n');
}

function referenceBlock(analysis: string): string {
  if (!analysis) return '';
  return [
    '\nREFERENCE IMAGE — a technician\'s reading of the photo the user attached:',
    analysis,
    '',
    'The user wants THIS setting recreated with our locked model and garment in it.',
    'Copy the analysis above into scene_detail almost verbatim — it is what the image generator',
    'receives, and every specific detail you drop is a detail the output will get wrong. Do NOT',
    'summarise it into a few adjectives. Set keep_scene=false. Still fill backdrop/lighting/mood',
    'with the CLOSEST value from the vocabulary so the dropdowns show something sensible, but',
    'scene_detail is what actually drives the image.',
  ].join('\n');
}

function directorSystem(shoot: ShootDoc, selection: string[], analysis: string): string {
  return [
    'You are Genie — an expert fashion art director, studio photographer and prompt engineer inside',
    'an on-model fashion image generator. You turn a brand team\'s plain-language ideas into precise,',
    'photo-ready generation specs.\n',
    'ALWAYS CONSTANT — NEVER CHANGE: (1) the MODEL (person, face, body, hair, ethnicity);',
    '(2) the GARMENT (exact product — colour, print, logo, cut, fabric). Both come from the locked hero.',
    'Every shot is the SAME model in the SAME garment.\n',
    'YOU CONTROL: POSE & expression, FRAMING (camera crop), and the SCENE (backdrop, lighting, mood).',
    'You do NOT control aspect ratio or resolution — the user sets those. Never mention or set them.\n',
    'THE HERO ANCHOR:',
    anchorLine(shoot),
    selectionBlock(selection),
    referenceBlock(analysis),
    '',
    'EACH TURN, pick a MODE:',
    '• single — ONE shot. Then also pick an intent:',
    '    refine_pose — they asked to improve/refine the pose with no new scene. Keep the hero scene',
    '      (keep_scene=true, blank backdrop/lighting/mood) and elevate only pose + framing.',
    '    art_direct — they gave a vibe, campaign feel or occasion. Design a new scene to match.',
    '    match_reference — an IMAGE is attached. Read its art direction and recreate that LOOK with',
    '      our model and garment constant. NEVER copy the reference\'s person, face or clothing.',
    '    clarify — you genuinely need one more detail. Ask a short question and set ready=false.',
    '• series — they want a SET / catalogue / several shots AND have given a number (now or earlier',
    '    in the conversation). Return ONE shared scene plus EXACTLY that many shots, each a',
    '    DIFFERENT, complementary pose and framing. Think like a photographer building a catalogue:',
    '    an establishing full-body, a hero three-quarter, something with movement, a waist-up or',
    `    close-up detail. Never repeat a pose. Maximum ${MAX_SET_SIZE}.`,
    '• ask_count — they want a set/catalogue but have given NO number anywhere in the conversation.',
    '    Ask how many, return suggested_counts [3,4,6,8], and do NOT invent the shots yet.\n',
    'A bare number ("3", "6 shots") answering your own count question means mode=series with that',
    'many shots — not a new question.\n',
    'STRICT VOCABULARY — these values are applied directly to dropdown menus, so you MUST copy one',
    'verbatim or return "". Do not invent phrasing. EVERY shot in a set must carry its own framing',
    'value from the list below — never leave a shot\'s framing blank, and vary it across the set.',
    `  framing: ${FRAMING_KEYS.join(' | ')}`,
    `  backdrop: ${BACKDROP_KEYS.join(' | ')}`,
    `  lighting: ${LIGHTINGS.join(' | ')}`,
    `  mood: ${MOODS.join(' | ')}\n`,
    'POSE is the one free-text field: vivid but concise — body, weight, hands, expression. Be specific',
    'and production-ready, and keep the garment the hero of the frame.\n',
    'OUTPUT a SINGLE JSON object in EXACTLY this shape, nothing else — no markdown, no code fence:',
    JSON_SHAPE,
  ].join('\n');
}

// ── normalising whatever comes back ─────────────────────────────────

const pick = (v: unknown, allowed: string[]): string => {
  const s = String(v ?? '').trim();
  if (!s) return '';
  if (allowed.includes(s)) return s;
  // The model occasionally returns a label ("Golden hour") or pads the value.
  const lower = s.toLowerCase();
  return allowed.find((a) => a.toLowerCase() === lower) ?? '';
};

/** Scene fields, shared by a single spec and a set. */
function coerceScene(keepRaw: unknown, src: Record<string, unknown>, fallbackKeep: boolean) {
  // scene_detail is deliberately NOT run through pick() — it is free text by
  // design, and is only trusted when a reference image produced it.
  const detail = String(src.scene_detail ?? '').trim().slice(0, 1200);
  // Matching a reference always means changing the scene, whatever was claimed.
  const keep = detail ? false : keepRaw === undefined ? fallbackKeep : !!keepRaw;

  return {
    keep_scene: keep,
    // keep_scene means "leave the card alone", which is '' — the card's "same".
    backdrop: keep ? '' : pick(src.backdrop, BACKDROP_KEYS),
    lighting: keep ? '' : pick(src.lighting, LIGHTINGS),
    mood: keep ? '' : pick(src.mood, MOODS),
    scene_detail: detail,
  };
}

export function coerceTurn(raw: unknown): GenieTurn {
  const out = (raw ?? {}) as Record<string, unknown>;

  const reply = String(out.reply ?? '').trim() || "Here's a direction for your shot.";
  const intents = ['refine_pose', 'art_direct', 'match_reference', 'clarify'] as const;
  const intent = intents.includes(out.intent as (typeof intents)[number])
    ? (out.intent as GenieTurn['intent'])
    : 'art_direct';

  const suggestions = (Array.isArray(out.suggestions) ? out.suggestions : [])
    .map((s) => String(s).trim())
    .filter(Boolean)
    .slice(0, 4);

  // Trust an explicit mode; otherwise infer it from which block was populated.
  const modes = ['single', 'series', 'ask_count'] as const;
  const mode = modes.includes(out.mode as (typeof modes)[number])
    ? (out.mode as GenieTurn['mode'])
    : out.set
      ? 'series'
      : out.suggested_counts
        ? 'ask_count'
        : 'single';

  const base = {
    reply,
    intent,
    spec: blankSpec(),
    set: null,
    suggested_counts: [] as number[],
    suggestions,
  };

  if (mode === 'ask_count') {
    const counts = (Array.isArray(out.suggested_counts) ? out.suggested_counts : [])
      .map((n) => Number(n))
      .filter((n) => Number.isInteger(n) && n >= 2 && n <= MAX_SET_SIZE);
    return {
      ...base,
      mode: 'ask_count',
      ready: false,
      suggested_counts: counts.length ? counts : [3, 4, 6, 8],
    };
  }

  if (mode === 'series') {
    const raw = (out.set ?? {}) as Record<string, unknown>;
    const scene = coerceScene(raw.keep_scene, raw, false);

    const shots: GenieShot[] = (Array.isArray(raw.shots) ? raw.shots : [])
      .slice(0, MAX_SET_SIZE)
      .map((sh) => {
        const s = (sh ?? {}) as Record<string, unknown>;
        return { pose: String(s.pose ?? '').trim(), framing: pick(s.framing, FRAMING_KEYS) };
      })
      .filter((s) => s.pose)
      // Gemini reliably fills framing on a single spec but routinely omits it on
      // set shots. Defaulting them all to one value would flatten a catalogue
      // into N identical crops, so blanks cycle the photographer's spread
      // instead — variety by construction when the model won't supply it.
      .map((s, i) => ({ ...s, framing: s.framing || CATALOGUE_FRAMINGS[i % CATALOGUE_FRAMINGS.length] }));

    // A "set" with no usable shots is not a set — fall back to asking.
    if (!shots.length) {
      return { ...base, mode: 'ask_count', ready: false, suggested_counts: [3, 4, 6, 8] };
    }

    return { ...base, mode: 'series', ready: true, set: { ...scene, shots } };
  }

  const sp = (out.spec ?? {}) as Record<string, unknown>;
  // Default keep_scene from the intent: "refine my pose" implies the scene stays.
  const spec: GenieSpec = {
    pose: String(sp.pose ?? '').trim(),
    framing: pick(sp.framing, FRAMING_KEYS) || 'three_quarter',
    ...coerceScene(sp.keep_scene, sp, intent === 'refine_pose'),
    notes: String(sp.notes ?? '').trim(),
  };

  // Nothing to apply without pose text, whatever the model claimed.
  const ready = (out.ready === undefined ? intent !== 'clarify' : !!out.ready) && !!spec.pose;

  return { ...base, mode: 'single', ready, spec };
}

function extractJson(text: string): unknown {
  const t = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  try {
    return JSON.parse(t);
  } catch {
    // Some responses wrap the object in a sentence — take the outermost braces.
    const m = t.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

function transcript(messages: GenieMessage[], hasImage: boolean): string {
  const lines = messages
    .filter((m) => m.text?.trim())
    .map((m) => `${m.role === 'user' ? 'User' : 'Genie'}: ${m.text.trim()}`);
  if (hasImage) {
    lines.push('User: [attached a reference image — analyse it as the art direction to match]');
  }
  return lines.length ? lines.join('\n') : 'User: (no message)';
}

// ── the call ────────────────────────────────────────────────────────

let _client: GoogleGenAI | null = null;
const client = () => (_client ??= new GoogleGenAI({ apiKey: GEMINI_API_KEY }));

/**
 * Pass one of a reference match: look at the photo and write down what is
 * actually in it, before deciding anything.
 *
 * Asking a single call to both read an image and emit a structured spec makes
 * it do neither well — the scene collapses to a couple of adjectives, and the
 * generated image comes back "inspired by" the reference rather than matching
 * it. Separating the passes means the director works from a written description
 * dense enough to rebuild the set from, which is what the image model needs.
 *
 * Deliberately describes the SETTING only. The reference's person and clothing
 * are irrelevant — ours are locked — and describing them invites the generator
 * to copy them.
 */
const ANALYSIS_PROMPT = [
  'Analyse this photograph as a set/lighting technician who has to rebuild it tomorrow.',
  'Describe ONLY the setting and the photography. Completely ignore the person and what they',
  'are wearing — a different model in different clothing will be placed into this scene.',
  '',
  'Cover, in flowing prose of about 120 words:',
  '• BACKDROP — what and where: surfaces, materials, colours, architecture or landscape,',
  '  what is near vs far, how much depth and blur is behind the subject.',
  '• LIGHTING — direction, hardness, colour temperature, where shadows fall, any practicals.',
  '• CAMERA — apparent lens (wide/normal/tele), height, angle, distance to subject.',
  '• COLOUR GRADE — palette, warmth, contrast, saturation, any film or filter character.',
  '• PROPS & SET DRESSING — anything in frame that must be rebuilt.',
  '',
  'Be concrete and specific. Write it as one paragraph that could be handed to a generator',
  'as a scene description. No preamble, no bullet points, no mention of the person.',
].join('\n');

export async function analyseReference(image: Buffer): Promise<string> {
  const resp = await client().models.generateContent({
    model: TEXT_MODEL_ID,
    contents: [
      {
        role: 'user',
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: image.toString('base64') } },
          { text: ANALYSIS_PROMPT },
        ],
      },
    ],
    // Low temperature: this pass reports what is there, it does not invent.
    config: { temperature: 0.2 },
  } as Parameters<GoogleGenAI['models']['generateContent']>[0]);

  return (resp?.text ?? '').trim().slice(0, 1200);
}

/**
 * One turn of the conversation. Throws on provider failure so the route can
 * refund — unlike the one-shot Genie there is no sensible local fallback for a
 * structured spec.
 */
export async function runDirector(
  messages: GenieMessage[],
  shoot: ShootDoc,
  image: Buffer | null,
  selection: string[] = [],
): Promise<GenieTurn> {
  if (PROVIDER === 'mock') return mockTurn(messages, !!image, selection);

  // Two passes: read the reference first, then direct from what was read.
  const analysis = image ? await analyseReference(image) : '';

  const prompt = `${directorSystem(shoot, selection, analysis)}\n\nCONVERSATION SO FAR:\n${transcript(
    messages,
    !!image,
  )}\n\nRespond now with the JSON object.`;

  const parts: Array<Record<string, unknown>> = [];
  if (image) {
    parts.push({ inlineData: { mimeType: 'image/jpeg', data: image.toString('base64') } });
  }
  parts.push({ text: prompt });

  const resp = await client().models.generateContent({
    model: TEXT_MODEL_ID,
    contents: [{ role: 'user', parts }],
    config: { responseMimeType: 'application/json', temperature: 0.7 },
  } as Parameters<GoogleGenAI['models']['generateContent']>[0]);

  const raw = resp?.text ?? '';
  const parsed = extractJson(raw);
  if (!parsed) throw new Error(`Genie returned unparseable output: ${raw.slice(0, 200)}`);
  const turn = coerceTurn(parsed);

  // A reference image always means "match this look" — never let it collapse
  // into a pose-only tweak that ignores what the user attached. A set built
  // from a reference must take that reference's scene, not the hero's.
  if (image && turn.ready) {
    if (turn.mode === 'series' && turn.set) {
      return { ...turn, set: { ...turn.set, keep_scene: false } };
    }
    return { ...turn, intent: 'match_reference' };
  }
  return turn;
}

// ── mock brain, so the flow is clickable with no API key ────────────

function lastUser(messages: GenieMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user' && messages[i].text?.trim()) return messages[i].text.trim();
  }
  return '';
}

/** Poses the mock builds a catalogue from — deliberately varied in framing. */
const MOCK_POOL: GenieShot[] = [
  { pose: 'Straight front, weight even, arms relaxed at sides — clean establishing shot', framing: 'full_body' },
  { pose: 'Contrapposto, one hand on hip, shoulders open to camera, easy confident smile', framing: 'three_quarter' },
  { pose: 'Mid-stride walking toward camera, natural arm swing, hair with a touch of motion', framing: 'full_body' },
  { pose: 'Hands adjusting a sleeve, chin slightly down — fabric and detail focus', framing: 'waist_up' },
  { pose: 'Side profile, chin lifted, calm editorial gaze', framing: 'three_quarter' },
  { pose: 'Seated forward lean, elbows on knees, engaged expression', framing: 'waist_up' },
  { pose: 'Tight portrait, soft smile, direct eye contact', framing: 'portrait' },
  { pose: 'Full turn showing the back of the garment, glancing over the shoulder', framing: 'full_body' },
  { pose: 'Leaning a shoulder against a wall, ankles crossed, relaxed', framing: 'three_quarter' },
  { pose: 'Close crop on the neckline, hands lightly framing the fabric', framing: 'close_up' },
  { pose: 'Arms crossed, grounded stance, assured expression', framing: 'three_quarter' },
  { pose: 'Twirl with a touch of movement in the hem, joyful energy', framing: 'full_body' },
];

const WORD_COUNTS: Record<string, number> = {
  two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

/** A shot count stated anywhere in the text, or null. */
function findCount(text: string): number | null {
  const t = text.toLowerCase();
  const digits = t.match(/\b(\d{1,2})\b/);
  if (digits) {
    const n = Number(digits[1]);
    if (n >= 2 && n <= MAX_SET_SIZE) return n;
  }
  for (const [w, n] of Object.entries(WORD_COUNTS)) if (t.includes(w)) return n;
  return null;
}

const SET_WORDS =
  /\b(set|catalog|catalogue|series|multiple|several|collection|bunch|few poses)\b/;

function mockTurn(messages: GenieMessage[], hasImage: boolean, selection: string[]): GenieTurn {
  const last = lastUser(messages).toLowerCase();
  const all = messages.map((m) => m.text).join(' ').toLowerCase();

  // One picked pose comes back as a single direction for the prompt box.
  if (selection.length === 1) {
    return coerceTurn({
      mode: 'single',
      intent: 'refine_pose',
      ready: true,
      reply: 'Kept your scene, model and garment — I elevated the pose and set a framing for it.',
      spec: {
        pose: `${selection[0]}, weight settled and shoulders open, hands purposeful, natural engaged expression`,
        framing: 'three_quarter',
        keep_scene: true,
        notes: 'Scene untouched.',
      },
      suggestions: ['More dynamic / mid-motion', 'Waist-up crop', 'Turn it into a 4-shot set'],
    });
  }

  // Several picked poses return one rewritten shot each, in the same order.
  if (selection.length) {
    return coerceTurn({
      mode: 'series',
      reply: `Elevated all ${selection.length} of your picked poses — same scene, same model and garment, sharper direction on each.`,
      set: {
        keep_scene: true,
        shots: selection.map((p, i) => ({
          pose: `${p}, weight settled and shoulders open, hands purposeful, natural engaged expression`,
          framing: MOCK_POOL[i % MOCK_POOL.length].framing,
        })),
      },
      suggestions: ['Make them more editorial', 'Try an outdoor scene', 'Add a close-up detail'],
    });
  }

  // A catalogue was asked for somewhere in the conversation.
  if (SET_WORDS.test(all)) {
    // The count can arrive in the same breath ("a 4-shot catalogue") or as a
    // bare reply to our own question ("3 shots").
    const n = findCount(all);
    if (n === null) {
      return coerceTurn({
        mode: 'ask_count',
        reply:
          "Love it — how many shots should the set have? They'll share one scene, with your model & garment constant.",
        suggested_counts: [3, 4, 6, 8],
        suggestions: ['A quick 3', 'Standard 4', 'Full 6'],
      });
    }

    const keep = /same background|keep the background|keep background|hero scene|same scene/.test(all);
    const shots = MOCK_POOL.slice(0, Math.max(2, Math.min(n, MAX_SET_SIZE)));
    return coerceTurn({
      mode: 'series',
      reply: `Here's a ${shots.length}-shot set — one consistent scene, ${shots.length} complementary poses & framings. Same model & garment throughout.`,
      set: {
        keep_scene: keep,
        backdrop: keep ? '' : 'studio seamless',
        lighting: keep ? '' : 'soft bright commercial',
        mood: keep ? '' : 'clean',
        shots,
      },
      suggestions: ['Make it 6 shots', 'Add a seated pose', 'Try an outdoor scene'],
    });
  }

  if (hasImage) {
    return coerceTurn({
      reply:
        'MOCK MODE — no GEMINI_API_KEY is set, so this is a fixed sample rather than a real read of your reference.',
      intent: 'match_reference',
      ready: true,
      spec: {
        pose: 'Relaxed three-quarter turn toward camera, weight on the back leg, one hand grazing the hip, calm confident gaze',
        framing: 'three_quarter',
        keep_scene: false,
        backdrop: 'editorial set',
        lighting: 'golden hour',
        mood: 'warm editorial',
        notes: 'Sample reference match.',
      },
      suggestions: ['Make it full-body', 'Punchier catalog version', 'Keep my background instead'],
    });
  }

  const refining =
    /better|improve|refine|sharpen|pose/.test(last) &&
    !/catalog|campaign|vibe|editorial|background|backdrop|scene/.test(last);

  if (refining) {
    return coerceTurn({
      reply:
        'Kept your background, lighting, model and garment as the hero — I elevated the pose and set a framing that flatters it.',
      intent: 'refine_pose',
      ready: true,
      spec: {
        pose: 'Confident contrapposto, weight on one leg, shoulders open, one hand loosely in a pocket, natural half-smile with engaged eyes',
        framing: 'three_quarter',
        keep_scene: true,
        notes: 'Scene untouched.',
      },
      suggestions: ['More dynamic / mid-motion', 'Waist-up crop', 'Try an outdoor scene'],
    });
  }

  return coerceTurn({
    reply: 'Bright, fresh and energetic — new scene, same model and garment.',
    intent: 'art_direct',
    ready: true,
    spec: {
      pose: 'Energetic mid-stride toward camera, arms with a light swing, bright open smile',
      framing: 'full_body',
      keep_scene: false,
      backdrop: 'solid pastel colour studio wall',
      lighting: 'high-key studio',
      mood: 'bright airy',
      notes: 'High-key commercial look.',
    },
    suggestions: ['More premium / editorial', 'Keep my background instead', 'Tighter crop'],
  });
}
