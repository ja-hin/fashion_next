/**
 * Prompt libraries and builders.
 *
 * Ported verbatim from the Python app — the exact wording here is the result of
 * a lot of tuning against Gemini's behaviour (identity bleed, head cropping,
 * back-print duplication, child-safety), so treat changes as product changes,
 * not refactors.
 */

export const FRAMING: Record<string, string> = {
  full_body: 'full body head to toe',
  three_quarter: 'three-quarter, head to mid-thigh',
  knee_up: 'knee-up',
  waist_up: 'waist-up',
  portrait: 'portrait, shoulders up',
  close_up: 'chest-up crop',
};

export const POSE_LIB = [
  'straight standing front',
  'contrapposto, weight on one leg',
  'one hand on hip',
  'both hands on waist',
  'arms crossed',
  'hands in pockets',
  'one leg forward',
  'walking toward camera',
  'side profile',
  'leaning against a wall',
  'seated legs crossed',
  'seated forward lean',
  'back view',
];

export const STYLES: Record<string, string> = {
  european: 'a European/Western woman with fair-to-light skin and Caucasian features',
  indian:
    'an Indian woman with a fair, light wheatish complexion, dark brown eyes, dark hair and clearly Indian facial features',
  east_asian: 'an East Asian woman with East-Asian features and fair-to-light skin',
  southeast_asian:
    'a Southeast Asian woman with light-to-tan skin and Southeast-Asian features',
  middle_eastern:
    'a Middle-Eastern woman with olive skin, dark hair and Middle-Eastern features',
  african: 'a Black African woman with deep brown skin and African features',
  latina: 'a Latina/Hispanic woman with tan-to-brown skin and Latin-American features',
  diverse: 'a naturally diverse woman',
};

// Small per-shoot variety so every new shoot is a different person of the
// chosen ethnicity.
export const LOOKS = [
  'in her early 20s with long straight hair',
  'in her mid 20s with wavy shoulder-length hair',
  'in her late 20s with a sleek low bun',
  'around 30 with a short bob',
  'in her 20s with long wavy hair',
  'in her 20s with a high ponytail',
  'around 30 with natural curly hair',
  'in her mid 20s with a center-part lob',
];

// Kept separate so menswear never inherits a "her"-pronoun phrase from LOOKS.
export const MALE_LOOKS = [
  'in his early 20s with a short textured crop',
  'in his mid 20s with a classic side part',
  'in his late 20s with a clean buzz cut',
  'around 30 with short cropped hair and light stubble',
  "in his 20s with a tousled medium-length cut",
  'in his 20s with a fade and neat short top',
  'around 30 with short natural curly hair',
  'in his mid 20s with a slicked-back style',
];

export const AR_SIZE: Record<string, [number, number]> = {
  '1:1': [1024, 1024],
  '4:5': [1024, 1280],
  '9:16': [864, 1536],
  '3:4': [1080, 1440],
  '16:9': [1536, 864],
};

export const KID_CATS = new Set(['kidswear', 'kids']);

export const GENDER_BY_CAT: Record<string, string> = {
  menswear: 'male',
  womenswear: 'female',
  kidswear: 'child',
  footwear: 'female',
  accessory: 'female',
};

/** Strong, positive ethnic anchor; degrades gracefully for male/child. */
export function stylePhrase(style: string, gender: string, look: string): string {
  let base = STYLES[style] ?? STYLES.diverse;
  if (gender === 'male') {
    base = base.replace(' woman ', ' man ').replace('Latina/Hispanic', 'Latino/Hispanic');
  }
  return look && gender !== 'child' ? `${base}, ${look}` : base;
}

// ── scene ───────────────────────────────────────────────────────────

/**
 * What each backdrop actually looks like, as a photographer would describe it.
 *
 * The dropdown value was previously dropped straight into the prompt as
 * "<value> background", which for a word like "poolside" says nothing about
 * where the model stands relative to the water, how far back the scene sits, or
 * where the camera is. Gemini filled those gaps with its own idea of a poolside
 * snapshot — shot from above, model on a narrow strip of deck with the water
 * cutting across their feet, furniture at the wrong scale. Naming the geometry
 * is what stops it inventing one.
 *
 * Keys are the stored dropdown values (see client/constants.ts BACKDROPS) and
 * must not be renamed — a saved shoot holds the value, not the label. An
 * unknown key (a legacy shoot, or Genie text) falls back to the old behaviour.
 */
const SCENE_SETTINGS: Record<string, string> = {
  // Studio — the wall is the whole scene, so only the standoff matters.
  'studio seamless':
    'a seamless white studio cyclorama, the model standing well clear of the wall so no hard shadow lands on it',
  'light grey studio seamless':
    'a seamless light grey studio cyclorama, the model standing well clear of the wall',
  'dark charcoal studio seamless':
    'a seamless dark charcoal studio cyclorama, the model standing well clear of the wall',
  'solid pastel colour studio wall':
    'a smooth solid pastel-coloured studio wall directly behind the model, square to the camera',
  'textured concrete wall':
    'a flat textured concrete wall directly behind the model, square to the camera and evenly lit',
  'editorial set':
    'a minimal editorial studio set — a plain backdrop with one or two simple geometric props set behind and beside the model at true human scale',

  // Interior — an indoor floor plus a receding back wall.
  'lifestyle interior':
    'a bright uncluttered lifestyle interior, the model standing in open floor space with the furniture set well behind them and the back wall square to the camera',
  'modern loft interior with tall windows':
    'a modern loft with tall floor-to-ceiling windows behind and to one side, daylight coming in from them, the model standing on open floor several metres in front of the glass',
  'marble lobby interior':
    'a polished marble lobby, the model standing on open floor with the columns and far wall receding well behind them, vertical lines kept vertical',

  // Outdoor — a ground plane plus a horizon is where the angle went wrong.
  'outdoor street':
    'a quiet city street, the model standing on open pavement with the road and buildings receding behind them, any traffic or passers-by far enough back to read as soft background',
  'cobblestone old-town street':
    'a cobblestone old-town street, the model standing on level cobbles with the street receding behind them, the cobbles sized as they really are underfoot',
  'urban rooftop with city skyline':
    'an open rooftop terrace, the model standing on the roof deck with the city skyline far in the distance behind them and the horizon straight and level',
  'green park with trees':
    'a green park, the model standing on level grass or a path with mature trees receding behind them at true scale',
  'flowering garden':
  "An ultra realistic flowering garden, the model standing on a level path or lawn with the beds and shrubs behind them at true scale",
  'sunlit beach':
    'a sunlit beach, the model standing on firm level sand with the sea and horizon far behind them, the horizon straight and level',
  poolside:
  "the stone deck beside a premium plush outdoor swimming pool with clear blue water in it  — the model standing squarely on dry level deck at least two metres back from the water's edge, with the pool, loungers and planting running across the frame well behind them and softly out of focus. The water's edge must not cut across the model's feet or legs, and the deck the model stands on is open, level and unobstructed",
  'desert dunes':
    'desert dunes, the model standing on firm level sand with the dunes and horizon receding far behind them, the horizon straight and level',
};

/**
 * Where the camera is. The single most important line in the scene — without
 * it Gemini shoots outdoor scenes from above, which foreshortens the legs and
 * makes every model look short and pasted in.
 */
const SCENE_CAMERA =
  'Camera: a photographer standing on the same ground as the model, camera held level at about the ' +
  "model's chest-to-eye height and pointing straight ahead — never looking down from above, never a " +
  'high or bird\'s-eye angle, never tilted. Shot on an 85mm portrait lens from several metres back: ' +
  'natural perspective, no wide-angle stretching, verticals vertical.';

/**
 * Scale and contact — the difference between standing in a place and on top of
 * it. Says nothing about the model's age or height: kidswear shoots run through
 * the same clause, and "a normal-height adult" here would pull against the
 * child-model wording in buildPrompt.
 */
const SCENE_GROUNDING =
  'Proportion: the model stands with both feet flat on the ground and a soft contact shadow beneath ' +
  'them, at true human scale against everything around them, with natural head-to-body proportions ' +
  'and legs neither shortened nor stretched — a real person photographed in this place, not a ' +
  'cut-out placed onto it.';

/**
 * Build the scene sentence shared by the hero prompt and every per-image
 * override. One function so the three routes that offer a backdrop picker
 * cannot drift apart. Deliberately returns no trailing full stop — callers
 * append one.
 */
export function sceneClause(o: {
  backdrop?: string | null;
  lighting?: string | null;
  mood?: string | null;
}): string {
  const backdrop = (o.backdrop || 'studio seamless').trim();
  const lighting = (o.lighting || 'soft bright commercial').trim();
  const mood = (o.mood || 'clean').trim();

  // A known preset expands to its full description; a short unknown value is a
  // noun phrase and needs "a … background" around it. Genie's reference matches
  // arrive as a whole written scene, though, and wrapping one of those produces
  // "a The scene is a minimalist set … background" — so a long value is taken as
  // the setting exactly as written.
  const setting =
    SCENE_SETTINGS[backdrop] ?? (backdrop.length > 80 ? backdrop : `a ${backdrop} background`);
  return `Setting: ${setting}. ${SCENE_CAMERA} ${SCENE_GROUNDING} ${lighting} lighting, ${mood} mood`;
}

export function buildPrompt(opts: {
  style: string;
  scene: string;
  framing: string;
  pose: string;
  category: string;
  recast: boolean;
  look?: string;
  fromOnModel?: boolean;
}): string {
  const gender = GENDER_BY_CAT[opts.category] ?? 'female';
  const who =
    gender === 'child'
      ? 'a young child fashion model, age-appropriate and fully clothed'
      : stylePhrase(opts.style, gender, opts.look ?? '');
  const frame = FRAMING[opts.framing] ?? FRAMING.three_quarter;

  const garment = opts.recast
    ? 'Keep the exact garment from the reference (colour, print, logo, cut, fabric) on the new model. '
    : 'Dress the model in the exact garment from the product reference — preserve colour, print, logo, neckline, cut, fabric. ';

  // When the reference is itself an on-model photo, force a brand-new model of
  // the chosen ethnicity. The reference photo's person must be treated as
  // irrelevant — only the garment matters. Stated plainly and repeated, since a
  // single soft "do not copy" sentence wasn't reliably overriding the strong
  // visual signal of an actual photographed person.
  const newmodel = opts.fromOnModel
    ? 'The reference image may show a person wearing this garment — IGNORE that person entirely. ' +
      'Their face, skin tone, body type, hair and identity are completely irrelevant and must NOT ' +
      'appear anywhere in the output. Generate a COMPLETELY DIFFERENT, brand-new model matching the ' +
      'ethnicity already specified above — only the garment itself (colour, print, logo, cut, fabric) ' +
      'should be taken from the reference image. '
    : '';

  const headroom =
    "Keep the model's entire head and hair within the frame with clear margin above — never crop the top of the head. ";

  return (
    `Professional on-model fashion photo of ${who}. ${garment}${newmodel}${headroom}` +
    `Pose: ${opts.pose}. Framing: ${frame}. ${opts.scene}. Photorealistic, e-commerce ready.`
  );
}

/**
 * The saved-model hero prompt, used when the front character-sheet frame is
 * sent as the identity anchor. Two images go out via produce():
 *   Image 1 (garment)     — take the clothing only
 *   Image 2 (front frame) — take the person only
 * The numbered Image 1 / Image 2 convention with explicit weighting on both
 * sides is what keeps either role from bleeding into the other.
 */
export function buildSavedModelHeroPrompt(
  pose: string,
  framing: string,
  category: string,
  scene = '',
): string {
  const frame = FRAMING[framing] ?? FRAMING.three_quarter;
  const gender = GENDER_BY_CAT[category] ?? 'female';
  const headroom =
    "Keep the model's entire head and hair within the frame with clear margin above — never crop the top of the head. ";
  const childNote =
    gender === 'child'
      ? 'This is a child fashion model — keep the body proportions, height and age fully ' +
        'child-appropriate and consistent with the reference image, never adult-bodied. '
      : '';

  return (
    'Image 1 is the garment reference — it shows the clothing to dress the model in. ' +
    'Take ONLY the garment from Image 1 (colour, print, logo, neckline, cut, fabric). ' +
    'If Image 1 shows a person wearing the garment, that person carries zero identity weight — ' +
    'ignore their face, skin tone, body type and hair entirely. ' +
    'Image 2 is the model reference — it shows the exact person who must appear in the output. ' +
    "Take ONLY the person's identity from Image 2 (face, skin tone, body type, hair). " +
    'The clothing shown in Image 2 carries zero garment weight — ignore it entirely; ' +
    'the model must wear the garment from Image 1, not the clothing visible in Image 2. ' +
    childNote +
    headroom +
    `Pose: ${pose}. Framing: ${frame}. ${scene}. Ultra-photorealistic, 4k, e-commerce ready.`
  );
}

/**
 * Which VIEW of the garment a pose reveals, or null when it shows the front.
 *
 * The hero is a front shot, so it is authoritative for the front and nothing
 * else. Any pose that moves the camera elsewhere is asking for information the
 * hero does not contain — and if the shoot tagged a photo of that angle, that
 * photo should be sent rather than left to invention.
 *
 * Exported because gen.ts must reach the same answer: it picks the reference,
 * this builds the sentence describing it, and a disagreement would promise an
 * image the request never included.
 */
export function poseView(pose: string): 'back' | 'side' | 'detail' | null {
  const p = (pose ?? '').toLowerCase();
  if (/\b(back view|rear view|facing away|from behind)\b/.test(p)) return 'back';
  // "over the shoulder" is a front-facing pose with a turned head, so it is
  // deliberately not a side — sending a side photo there fights the hero.
  if (/\b(side|profile)\b|turned to the (left|right)/.test(p)) return 'side';
  if (/\b(close|detail|head ?shot|portrait|crop|neckline|fabric|texture)\b/.test(p)) return 'detail';
  return null;
}

/** Kept for readability at the call sites that only care about the back. */
export const isBackPose = (pose: string): boolean => poseView(pose) === 'back';

/** One tagged reference sent ahead of the hero, described for the prompt. */
export interface PoseRef {
  /** Human label, e.g. "Back". */
  label: string;
  /** What it is authoritative for, e.g. "the back of the garment". */
  truth: string;
}

export function buildPosePrompt(
  pose: string,
  framing: string,
  newScene = '',
  /**
   * Tagged references for the angle this pose reveals, in the order they are
   * sent — they become Image 1..N, and the hero becomes Image N+1.
   *
   * Empty is the normal case and the prompt says the angle is unknown, which is
   * why an untagged shoot returns a plain back. A shoot that tagged that angle
   * knows better, and this is what lets it say so. See lib/ensemble.ts.
   */
  refs: PoseRef[] = [],
): string {
  const p = (pose ?? '').toLowerCase();
  const hasRefs = refs.length > 0;
  const view = poseView(p);

  let shot: string;
  if (view === 'back' && hasRefs) {
    shot =
      'Show the same model and garment from BEHIND, rotated a full 180°, the back of the head ' +
      'and the back of the garment facing the camera, reproducing the back exactly as the ' +
      'reference images above show it. Do not invent the back, and do not carry the front ' +
      'print around onto it.';
  } else if (view === 'side' && hasRefs) {
    shot =
      'Turn the model to show the side of the garment, reproducing that profile exactly as the ' +
      'reference images above show it — seams, drape, length and any side detail.';
  } else if (/\b(close|portrait|detail|head ?shot)\b/.test(p)) {
    shot = hasRefs
      ? 'Move the camera nearer for a chest-up crop that still shows the garment clearly, and ' +
        'reproduce the fabric, print, trims and lettering exactly as the reference images above ' +
        'show them.'
      : 'Move the camera nearer for a chest-up crop that still shows the garment clearly.';
  } else if (isBackPose(p)) {
    shot =
      'Show the back of the same model and garment. IMPORTANT: do not copy the front ' +
      'print onto the back — if no back design is known, the back of the garment is plain.';
  } else {
    const frame = FRAMING[framing] ?? FRAMING.three_quarter;
    // The camera height is pinned as well as the framing. Left free, a pose
    // regeneration drifts into a high angle shot from above — the model comes
    // back looking short and foreshortened even though the hero was level.
    shot =
      `Change only the pose and camera framing to: ${pose}. Framing: ${frame}. ` +
      "Keep the camera level at the model's chest-to-eye height, pointing straight ahead — " +
      'never angled down from above, and keep the model at true human scale within the scene.';
  }

  // Seated poses name their seat (a cube block, stool, step or ledge). Without
  // an explicit licence to add it, "keep the same background" and "change only
  // the pose" read together as a ban on introducing the prop at all, and the
  // model comes back standing. Matched on "on a … step" rather than "step" so
  // footwear's "mid-step walking" doesn't trip it.
  const hasProp = /\b(cube|stool|ledge|bench)\b|on a (low )?step\b/.test(p);
  const prop = hasProp
    ? ' Add the seat or prop named in the pose to the scene — it rests on the existing floor and is ' +
      'lit and colour-graded to match the shot. Everything else about the background stays as it is.'
    : '';

  // Default = keep the same background; when a new scene is requested, change
  // ONLY the background/lighting.
  const bg = newScene
    ? `Change the background and lighting to: ${newScene}. Keep the same model, the same garment and its ` +
      'print/details exactly the same.'
    : 'Keep the same model, the same garment and its print/details, and the same background, lighting and colour grade.';

  // Extra images change what "the same model" refers to, so the anchor is named
  // explicitly and every reference is numbered with what it is good for.
  const lead = hasRefs
    ? 'This is a professional fashion e-commerce photograph. ' +
      refs.map((r, i) => `Image ${i + 1} is the real ${r.label} of this exact garment — the exact truth for ${r.truth}`).join('. ') +
      `. Image ${refs.length + 1} is the finished front shot of this exact model wearing this ` +
      'exact outfit — reproduce that same person (face, skin tone, body, hair) and the same ' +
      'garment with total consistency; it is the same shoot, only the camera moves. '
    : 'This is a professional fashion e-commerce photograph of a model wearing a garment. ';

  return `${lead}${bg} ${shot}${prop} Photorealistic, natural anatomy, seamless, product-page ready.`;
}

export const HEAD_COMPLETE_PROMPT =
  "This is an on-model fashion photograph. If the model's head or face is missing, cut off, or cropped " +
  'at the top of the frame, generate a complete, realistic head and hair that match the body, skin tone, ' +
  'lighting and pose, with natural space above the hair. If the head is already fully visible, return the ' +
  'image unchanged. Keep the garment, body, pose and background exactly the same. Photorealistic, seamless at the neck.';

// ── Character sheet ─────────────────────────────────────────────────

/**
 * The six angles of a character sheet. Each maps to one Gemini call, one
 * focused prompt, one real hi-res photo — generating them individually gives
 * far better per-angle fidelity than slicing a single collage.
 */
export const CHARSHEET_SINGLE_POSES: Array<[string, string, string]> = [
  [
    'front',
    'full body, head to feet, body facing the camera directly (0°), arms relaxed at sides',
    '4:5',
  ],
  [
    'back',
    'full body, head to feet, body rotated a full 180° facing completely away from the camera — back of the head and back of the outfit clearly visible',
    '4:5',
  ],
  [
    'left side (knee-up)',
    "body rotated a full 90° so the camera sees the model's left side dead-on, nose and toes pointing to the same side, cropped from the knees up — not full body, not a close-up",
    '4:5',
  ],
  [
    'right side (knee-up)',
    "body rotated a full 90° in the opposite direction so the camera sees the model's right side dead-on, cropped from the knees up — a mirror of the left-side shot",
    '4:5',
  ],
  [
    'close-up (front)',
    'tight close-up portrait from the chest/shoulders up only, face and shoulders directly toward the camera — no body below the shoulders visible',
    '4:5',
  ],
  [
    'close-up (45°)',
    'tight close-up portrait from the chest/shoulders up only, face and shoulders rotated about 45° from the camera — clearly different from the straight-on close-up',
    '4:5',
  ],
];

export const CHARSHEET_SLOT_LABELS = CHARSHEET_SINGLE_POSES.map(([label]) => label);

/**
 * Prompt for ONE angle of the six-image character sheet. Uses the same proven
 * single-reference-photo + pose-description pattern as the working
 * "Use in new shoot" identity anchor.
 */
export function buildCharsheetSinglePrompt(
  poseDesc: string,
  gender: string,
  _ethnicityStyle: string,
): string {
  const childNote =
    gender === 'child'
      ? 'This is a child fashion model — keep the body proportions, height and age ' +
        'child-appropriate and consistent with the reference image, never adult-bodied. '
      : '';

  return (
    'Image 1 is the model reference — it shows the exact person to generate. ' +
    'Copy their face, skin tone, body type, hair and identity precisely from Image 1. ' +
    'Dress them in a simple neutral outfit (plain fitted top, neutral denim or trousers) — ' +
    'ignore whatever clothing is visible in Image 1; only their physical identity matters from it. ' +
    childNote +
    `Pose and framing: ${poseDesc}. ` +
    'Plain light grey or white studio background, consistent soft commercial lighting. ' +
    'CRITICAL: absolutely no text, letters, words, labels, numbers or captions anywhere in the image. ' +
    'Ultra-photorealistic, 4k, e-commerce ready.'
  );
}

/** System instruction for the Prompt Genie — constrained so it never changes identity. */
export const GENIE_SYSTEM =
  "Rewrite the user's text into a single vivid fashion pose/scene description for a photo. " +
  'Only describe pose, framing, mood, lighting and setting. Keep the SAME model and SAME garment. ' +
  "Never add other people, never change the person's identity. One or two sentences, no preamble.";