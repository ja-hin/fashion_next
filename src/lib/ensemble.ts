/**
 * Multi-reference shoots — one hero built from several tagged product photos.
 *
 * Two shapes, and the difference matters:
 *
 *   same_garment — up to six photos of ONE garment from different angles.
 *                  Each image is the GROUND TRUTH for the side it shows, which
 *                  is what stops the back being invented.
 *   ensemble     — several DIFFERENT items (a top, a bag, shoes) assembled onto
 *                  one model as a single coordinated look.
 *
 * Both work the same way: every reference is given a role, and the prompt
 * carries a numbered manifest ("Image 1 = Front; Image 2 = Back") so the model
 * can tell the references apart. Without that mapping it blends them.
 *
 * Only the HERO changes. Once it exists the shoot behaves exactly like any
 * other — every later pose is generated from the hero, so the garment or the
 * assembled look stays locked for free. See lib/gen.ts.
 *
 * Ported from the standalone ensemble_studio prototype.
 */

/** Which kind of multi-reference shoot a set of images belongs to. */
export type RefMode = 'same_garment' | 'ensemble';

/** Roles a reference image can take, in the order they are offered. */
export const ENSEMBLE_ROLES = [
  'garment',
  'top',
  'bottom',
  'footwear',
  'bag',
  'eyewear',
  'jewellery',
  'hat',
  // The tail of this list is NOT items — they are extra views of pieces already
  // named above. An outfit is usually shot with a rear and a detail frame too,
  // and with nowhere to put them people tag them "garment", which asks for a
  // second dress on the model. They are truth, never something to wear.
  'back',
  'side',
  'detail',
] as const;

export type EnsembleRole = (typeof ENSEMBLE_ROLES)[number];

export const ROLE_LABEL: Record<EnsembleRole, string> = {
  garment: 'Garment (dress/one-piece)',
  top: 'Top',
  bottom: 'Bottom',
  footwear: 'Footwear',
  bag: 'Bag',
  eyewear: 'Eyewear',
  jewellery: 'Jewellery',
  hat: 'Hat/Headwear',
  back: 'Back of the outfit',
  side: 'Side of the outfit',
  detail: 'Close-up detail',
};

/** Where each role sits on the model — spelled out so nothing lands wrong. */
const ROLE_PLACEMENT: Record<EnsembleRole, string> = {
  garment: 'worn on the body as the main one-piece garment',
  top: 'worn on the torso',
  bottom: 'worn on the legs and hips',
  footwear: 'worn on the feet',
  bag: 'held in one hand or carried on the shoulder',
  eyewear: 'worn on the face',
  jewellery: 'worn as shown — neck, wrist, ears or fingers',
  hat: 'worn on the head, not hiding the face',
  // Never placed: extra views, handled separately in buildEnsemblePrompt.
  back: '',
  side: '',
  detail: '',
};

/**
 * More references means more constraints, and each extra item costs fidelity on
 * the others. Six is the prototype's cap and holds up in practice.
 */
export const MAX_ENSEMBLE_REFS = 6;

// ── same-garment roles ─────────────────────────────────────────────

/** Angles of one garment. Order is the order they are offered in the picker. */
export const GARMENT_ROLES = ['front', 'back', 'side', 'detail', 'label'] as const;

export type GarmentRole = (typeof GARMENT_ROLES)[number];

export const GARMENT_ROLE_LABEL: Record<GarmentRole, string> = {
  front: 'Front',
  back: 'Back',
  side: 'Side',
  detail: 'Detail',
  label: 'Label / Tag',
};

/**
 * What each angle is authoritative for — the whole point of tagging them.
 *
 * Used twice: in the hero prompt, and again whenever a later POSE turns the
 * camera to a side the hero cannot show. A shoot that tagged a side photo
 * should get that side right on a side pose, not just on the hero.
 */
export const VIEW_TRUTH: Record<GarmentRole, string> = {
  front: 'the front of the garment',
  back: 'the back of the garment',
  side: 'the side profile of the garment',
  detail: 'close-up detail — texture, trims, stitching and hardware',
  label: 'printed text, logos and label artwork',
};

// ── mode-agnostic helpers ──────────────────────────────────────────

export type RefRole = EnsembleRole | GarmentRole;

/**
 * Roles that describe a VIEW of the outfit rather than a thing to put on it.
 *
 * The distinction runs through everything: a view is never assembled onto the
 * model, and it is the reference a later pose reaches for when the camera moves
 * somewhere the hero cannot show.
 */
export const VIEW_ROLES = ['front', 'back', 'side', 'detail', 'label'] as const;
export type ViewRole = (typeof VIEW_ROLES)[number];

export const isViewRole = (v: unknown): v is ViewRole =>
  typeof v === 'string' && (VIEW_ROLES as readonly string[]).includes(v);

/** Display label for a view, whichever mode it came from. */
export const viewLabel = (r: ViewRole): string => GARMENT_ROLE_LABEL[r];

export const ROLES_FOR: Record<RefMode, readonly RefRole[]> = {
  same_garment: GARMENT_ROLES,
  ensemble: ENSEMBLE_ROLES,
};

export const LABEL_FOR: Record<RefMode, Record<string, string>> = {
  same_garment: GARMENT_ROLE_LABEL,
  ensemble: ROLE_LABEL,
};

/** The role a mode falls back to when nothing usable was supplied. */
const DEFAULT_ROLE: Record<RefMode, RefRole> = {
  same_garment: 'front',
  ensemble: 'garment',
};

export const isEnsembleRole = (v: unknown): v is EnsembleRole =>
  typeof v === 'string' && (ENSEMBLE_ROLES as readonly string[]).includes(v);

export const isRoleFor = (v: unknown, mode: RefMode): v is RefRole =>
  typeof v === 'string' && (ROLES_FOR[mode] as readonly string[]).includes(v);

/**
 * Coerce anything to a usable role, so a bad value can never reach a prompt.
 * Falls back rather than throwing: one mis-tagged image should cost fidelity on
 * that item, not reject the whole shoot.
 */
export const asRole = (v: unknown, mode: RefMode = 'ensemble'): RefRole =>
  isRoleFor(v, mode) ? v : DEFAULT_ROLE[mode];

/**
 * The hero prompt for an ensemble.
 *
 * `roles` must be in the same order as the reference images passed to the model
 * — the numbered manifest is positional, and a mismatch silently puts the shoes
 * on the model's head.
 */
export function buildEnsemblePrompt(opts: {
  roles: EnsembleRole[];
  /** Who the model is — from stylePhrase(). Ignored when `anchored` is set. */
  who: string;
  /** Scene clause, or '' to let the prompt use its own studio default. */
  scene: string;
  /** Framing description, already expanded from the framing key. */
  framing: string;
  /**
   * Set when a SAVED model anchors the shoot. Its character-sheet frame is sent
   * as the image AFTER the references, so the identity source is Image N+1 and
   * `who` no longer describes anyone — the face comes from a photo instead.
   */
  anchored?: boolean;
  /** Adds the child-appropriate proportions guard, for kidswear. */
  child?: boolean;
}): string {
  const { roles, who, scene, framing, anchored, child } = opts;

  const manifest = roles
    .map((r, i) => `Image ${i + 1} = ${ROLE_LABEL[r]}`)
    .join('; ');

  // A view reference is a second angle on a piece already in the look, not
  // another thing to put on the model. Assembling one asks for two dresses.
  const wearable = roles.map((r, i) => ({ r, i })).filter(({ r }) => !isViewRole(r));
  const views = roles.map((r, i) => ({ r, i })).filter(({ r }) => isViewRole(r));

  const placement = wearable
    .map(({ r, i }) => `the ${ROLE_LABEL[r].toLowerCase()} from Image ${i + 1} ${ROLE_PLACEMENT[r]}`)
    .join(', ');

  const viewNote = views.length
    ? ` ${views
        .map(({ r, i }) => `Image ${i + 1} shows ${VIEW_TRUTH[r as ViewRole]}`)
        .join('; ')}. These are EXTRA VIEWS of the same outfit, not extra items — never place them` +
      ' on the model as separate pieces. Use them only as the truth for what those angles and' +
      ' details look like, and keep everything else exactly as the images above show it.'
    : '';

  const modelImage = roles.length + 1;

  // With a saved model the person is a photograph, not a description — and the
  // clothing visible in that photograph must carry no weight at all, or it
  // competes with the items being assembled.
  const subject = anchored
    ? [
        `Image ${modelImage} is the MODEL reference — it shows the exact person who must appear in`,
        `the output. Take ONLY that person's identity from Image ${modelImage} (face, skin tone,`,
        `body type, hair). The clothing visible in Image ${modelImage} carries ZERO garment weight —`,
        'ignore it entirely; the model wears the assembled look from the images above it, never',
        'what they happen to be wearing in that reference.',
        child
          ? 'This is a child fashion model — keep proportions, height and age fully child-appropriate.'
          : '',
        'Create a single professional e-commerce HERO photograph of that exact person,',
      ].join(' ')
    : `Create a single professional e-commerce HERO photograph of ${who},`;

  return [
    `You are given ${roles.length} reference images, each showing ONE separate fashion item,`,
    `numbered in order. ${manifest}.`,
    subject,
    `wearing and styled with a`,
    `complete coordinated look assembled from these items together: ${placement}.${viewNote}`,
    'Reproduce each item faithfully from its own reference — colour, print, logo, shape, material',
    'and details — and place each on the correct part of the body.',
    // The single most important line: reference photos are usually shot ON a
    // person, and without this the generator blends that person's face and body
    // into the result, overriding the model this shoot is supposed to lock.
    'If any reference image shows a person wearing or holding the item, IGNORE that person',
    "completely — their face, body, skin tone and hair carry zero weight; only the item itself",
    'matters.',
    // Without this, an ensemble of "top + bag + shoes" asks for a model with
    // nothing on her legs. That reads as a partially-clothed person and the
    // image model refuses the whole generation with IMAGE_SAFETY — so the
    // gap has to be filled explicitly rather than left to inference.
    'The model must be FULLY and appropriately dressed in every shot. Any part of the outfit not',
    'supplied by a reference image — trousers or a skirt when only a top is given, a top when only',
    'a bottom is given, plain shoes when no footwear is given — must be added as a simple, plain,',
    'neutral garment in a colour that complements the supplied items without competing with them.',
    'Never leave any part of the body unclothed.',
    `Framing: ${framing}. The model's whole head and hair inside the frame with margin above.`,
    scene ? `${scene}.` : 'Clean seamless studio background, soft bright commercial lighting.',
    'Ultra-photorealistic, catalogue-ready, natural anatomy, no text or watermarks.',
  ].join(' ');
}

/**
 * The hero prompt for a same-garment shoot.
 *
 * The whole value is in the words "ground truth for the side it shows". Given
 * one photo the model invents the back, and it invents it by mirroring the
 * front — so a printed tee comes out with the print on the back too. Naming
 * which image owns which side is what stops that.
 *
 * `roles` must be in the same order as the images passed to the model; the
 * manifest is positional.
 */
export function buildSameGarmentPrompt(opts: {
  roles: GarmentRole[];
  /** Who the model is — from stylePhrase(). Ignored when `anchored` is set. */
  who: string;
  scene: string;
  framing: string;
  /** A saved model's frame follows the references, so it is Image N+1. */
  anchored?: boolean;
  child?: boolean;
}): string {
  const { roles, who, scene, framing, anchored, child } = opts;

  const manifest = roles.map((r, i) => `Image ${i + 1} = ${GARMENT_ROLE_LABEL[r]}`).join('; ');
  const truth = roles
    .map((r, i) => `use Image ${i + 1} as the exact truth for ${VIEW_TRUTH[r]}`)
    .join(', ');

  const modelImage = roles.length + 1;
  const subject = anchored
    ? [
        `Image ${modelImage} is the MODEL reference — it shows the exact person who must appear in`,
        `the output. Take ONLY that person's identity from Image ${modelImage} (face, skin tone,`,
        `body type, hair). The clothing visible in Image ${modelImage} carries ZERO garment weight —`,
        'ignore it entirely; the model wears the garment from the images above it.',
        child
          ? 'This is a child fashion model — keep proportions, height and age fully child-appropriate.'
          : '',
        'Create a single professional e-commerce HERO photograph of that exact person',
      ].join(' ')
    : `Create a single professional e-commerce HERO photograph of ${who}`;

  return [
    `You are given ${roles.length} reference images that all show THE SAME SINGLE GARMENT from`,
    `different angles, numbered in order. ${manifest}.`,
    `${subject} wearing this exact garment.`,
    `Treat every image as the ground truth for what it shows: ${truth}.`,
    "Copy the garment's colour, print, logo, neckline, cut and fabric exactly.",
    'NEVER invent a side that a reference already shows, and never copy the front print onto the',
    'back — if no back photo is supplied, keep the back plain and consistent with the fabric.',
    'If a reference image shows a person wearing the garment, IGNORE that person entirely — their',
    'face, body, skin tone and hair carry zero weight; only the garment matters.',
    // Same lesson as the ensemble prompt: a top-only reference asks for a model
    // with nothing on her legs, which the image model refuses outright.
    'The model must be FULLY and appropriately dressed. Anything the garment does not cover must',
    'be a simple, plain, neutral piece that complements it without competing.',
    `Framing: ${framing}. The model's whole head and hair inside the frame with margin above.`,
    scene ? `${scene}.` : 'Clean seamless studio background, soft bright commercial lighting.',
    'Ultra-photorealistic, catalogue-ready, natural anatomy, no text or watermarks.',
  ].join(' ');
}
