'use client';

/** Option lists and labels shared across the studio UI. */

/**
 * Pose library, split by category.
 *
 * [display label, prompt text] — the prompt text is what reaches the model, so
 * it must stay gender-neutral unless it lives in a gendered list. A phrase like
 * "turned to her left" in a shared list sends a female cue that fights the male
 * cue built by stylePhrase() on menswear.
 */
type Pose = [string, string];

/**
 * Every seated pose names its seat. Left to itself the model invents a
 * different chair on each generation, which breaks continuity across a shoot —
 * a plain cube is repeatable, keeps the eye on the garment, and reads as a
 * studio prop rather than furniture. Contrast is specified against the
 * backdrop so the cube doesn't disappear into a same-tone seamless.
 *
 * Poses that deliberately use a different prop (a stool, a step, the floor)
 * spell that out instead and don't use this.
 */
const CUBE =
  'seated on a plain matte cube block, the cube a solid colour that clearly contrasts with the background';

/** Poses that read the same on a man or a woman. */
const POSES_COMMON: Pose[] = [
  ['Straight standing', 'straight standing front'],
  ['Contrapposto', 'contrapposto, weight on one leg'],
  ['Arms crossed', 'arms crossed'],
  ['Hands in pockets', 'hands in pockets'],
  ['Over left shoulder', 'looking over the left shoulder'],
  ['Over right shoulder', 'looking over the right shoulder'],
  ['Walking toward camera', 'walking toward camera'],
  ['Walking away / back', 'walking away, back view'],
  ['Side pose — left', 'turned to the left, showing the left side'],
  ['Side pose — right', 'turned to the right, showing the right side'],
  ['¾ left', 'three-quarter turn to the left, face to camera'],
  ['¾ right', 'three-quarter turn to the right, face to camera'],
  ['Cube · forward lean', `${CUBE}, leaning forward with the forearms on the thighs`],
  ['Hand near face / chin', 'hand near face, fingers near chin'],
  ['Adjusting collar', 'adjusting the collar and lapel'],
];

/**
 * Kidswear, footwear and accessory don't inherit POSES_COMMON — an adult
 * editorial standing pose suits none of them, and a footwear shot is framed on
 * the product, not the model.
 */
const SELF_CONTAINED = new Set(['kidswear', 'footwear', 'accessory']);

const POSES_BY_CAT: Record<string, Pose[]> = {
  womenswear: [
    ['One leg forward', 'one leg forward'],
    ['One hand on hip', 'one hand on hip'],
    ['Both hands on waist', 'both hands on waist'],
    ['Cube · legs crossed', `${CUBE}, one leg crossed over the other at the knee`],
    ['Cube · one knee up', `${CUBE}, one knee drawn up, that foot resting on the cube`],
    ['Crouching', 'crouching pose'],
    ['Squat', 'squatting pose'],
    ['Hands touching hair', 'hands touching hair'],
    ['Jacket / shoulder drape', 'holding a jacket draped over one shoulder'],
    ['Fabric movement', 'fabric in motion, flowing garment'],
    ['Dynamic turn / spin', 'dynamic turn or spin'],
  ],

  menswear: [
    ['Power stance', 'standing squarely, feet shoulder-width apart, confident upright posture'],
    ['Leaning on a wall', 'leaning one shoulder against a plain wall, relaxed posture'],
    ['Hands in jacket pockets', 'hands pushed into the jacket pockets, shoulders relaxed'],
    ['Thumbs in pockets', 'thumbs hooked into the front trouser pockets'],
    ['Adjusting the cuff', 'adjusting a shirt cuff at the wrist, head angled slightly down'],
    ['Adjusting a watch', 'adjusting the watch on the wrist'],
    ['Buttoning the jacket', 'fastening the top button of the jacket'],
    ['Rolling a sleeve', 'rolling up one shirt sleeve at the forearm'],
    ['Hands clasped in front', 'standing with hands clasped loosely in front'],
    ['Hands behind back', 'standing with hands clasped behind the back, chest open'],
    ['Jacket over forearm', 'holding a folded jacket over one forearm'],
    ['Jacket on the shoulder', 'a jacket hooked on one finger over the shoulder'],
    // The male seated cross is the figure-four, not thigh-over-thigh.
    ['Cube · ankle on knee', `${CUBE}, one ankle resting on the opposite knee, figure-four posture`],
    ['Seated on a stool', 'seated on a low stool, forearms resting on the thighs'],
  ],

  kidswear: [
    ['Standing, arms relaxed', 'standing straight with arms relaxed at the sides'],
    ['Hands behind back', 'standing with hands held behind the back'],
    ['Hands in pockets', 'hands tucked into the pockets'],
    ['Waving at camera', 'waving one hand at the camera, cheerful expression'],
    ['Natural smile', 'standing still with a natural happy smile'],
    ['Arms out wide', 'arms stretched out wide to the sides'],
    ['Small jump', 'a small playful jump, both feet just off the ground'],
    ['Running toward camera', 'running toward the camera'],
    ['Walking toward camera', 'walking toward the camera'],
    ['Back view', 'facing away from the camera, back view'],
    ['Side view — left', 'turned to the left, showing the left side'],
    ['Side view — right', 'turned to the right, showing the right side'],
    ['¾ turn', 'three-quarter turn, face to camera'],
    ['Cube · sitting', `${CUBE}, sitting upright with the hands resting on the knees`],
    ['Sitting cross-legged', 'sitting cross-legged on the floor'],
    ['Sitting on a step', 'sitting on a low step, hands resting on the knees'],
  ],

  footwear: [
    ['Both feet, straight on', 'standing straight, both shoes flat on the floor and fully visible'],
    ['One foot forward', 'one foot stepped forward, both shoes clearly visible'],
    ['Mid-step / walking', 'mid-step walking, the sole of the rear shoe visible'],
    ['Heel raised', 'weight on the toes with one heel lifted'],
    ['Side profile — left', 'both shoes seen from the left, full profile of the shoe'],
    ['Side profile — right', 'both shoes seen from the right, full profile of the shoe'],
    ['Crossed ankles', 'standing with the ankles crossed'],
    ['Cube · legs extended', `${CUBE}, the legs extended forward, soles toward the camera`],
    ['Seated on a step', 'seated on a step with both shoes resting on the ground'],
    ['Foot on a ledge', 'one foot raised onto a low ledge, laces and side of the shoe visible'],
    ['Low-angle hero', 'low camera angle from ground level looking up at the shoes'],
    ['Top-down on feet', 'camera looking straight down at the shoes from above'],
    ['Detail — laces & toe', 'tight crop on the toe box and laces'],
  ],

  accessory: [
    ['Held in hand', 'holding the accessory in one hand at the side'],
    ['Both hands, front', 'holding the accessory in front with both hands'],
    ['Over the shoulder', 'the accessory carried over one shoulder'],
    ['Worn crossbody', 'the accessory worn across the body'],
    ['Held up to camera', 'holding the accessory up toward the camera'],
    ['On the forearm', 'the accessory hanging from the crook of the forearm'],
    ['Walking, carried', 'walking toward the camera carrying the accessory'],
    ['Cube · on the lap', `${CUBE}, the accessory resting on the lap`],
    ['Worn — waist up', 'waist-up framing showing the accessory as worn'],
    ['Side profile', "side profile showing the accessory's full silhouette"],
    ['Detail — hardware', 'tight crop on the clasp, buckle and hardware'],
    ['Detail — texture', 'close crop showing the material grain and stitching'],
  ],
};

/** The pose list to offer for a category. Falls back to womenswear. */
export function posesFor(category: string): Pose[] {
  const own = POSES_BY_CAT[category] ?? POSES_BY_CAT.womenswear;
  return SELF_CONTAINED.has(category) ? own : [...POSES_COMMON, ...own];
}

/**
 * File-name form of a pose label — "Cube · forward lean" → "cube-forward-lean".
 *
 * The fraction is spelled out rather than stripped: "¾ left" and "Side pose —
 * left" would otherwise both slug to "left" and share one preview image.
 */
export const poseSlug = (label: string): string =>
  label
    .toLowerCase()
    .replace(/¾/g, 'three-quarter')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/**
 * Where a pose's reference thumbnail lives, most specific first.
 *
 * Category-specific art wins, so menswear and womenswear can illustrate the
 * same shared pose with their own model; the bare `/poses/<slug>.jpg` is the
 * shared fallback. Nothing here asserts the file exists — the preview hides
 * itself when every candidate 404s, so poses can be illustrated a few at a time
 * rather than all at once.
 */
export const poseImageSrcs = (category: string, label: string): string[] => {
  const slug = poseSlug(label);
  return [`/poses/${category}/${slug}.jpg`, `/poses/${slug}.jpg`];
};

export const CATEGORIES: Array<[string, string]> = [
  ['womenswear', 'Womenswear'],
  ['menswear', 'Menswear'],
  ['kidswear', 'Kidswear'],
  ['footwear', 'Footwear'],
  ['accessory', 'Accessory'],
];

export const INPUT_FAMILIES: Array<[string, string]> = [
  ['garment_in', 'Try on a Model'],
  ['extend', 'Extend (same model)'],
  ['recast', 'Swap Model'],
];

export const ETHNICITIES: Array<[string, string]> = [
  ['european', 'European / Western'],
  ['indian', 'Indian'],
  ['east_asian', 'East Asian'],
  ['southeast_asian', 'Southeast Asian'],
  ['middle_eastern', 'Middle Eastern'],
  ['african', 'Black / African'],
  ['latina', 'Latina / Hispanic'],
  ['diverse', 'Diverse (auto)'],
];

export const FRAMINGS: Array<[string, string]> = [
  ['full_body', 'Full body'],
  ['three_quarter', '¾'],
  ['knee_up', 'Knee-up'],
  ['waist_up', 'Waist-up'],
  ['portrait', 'Portrait'],
  ['close_up', 'Close-up'],
];

export const ASPECTS = ['4:5', '1:1', '9:16', '3:4', '16:9'];

export const RESOLUTIONS: Array<[string, string]> = [
  ['1K', '1K · standard'],
  ['2K', '2K · high'],
  ['4K', '4K · ultra'],
];

/**
 * [prompt text, display label]. The value is interpolated by the generate route
 * as `"<value> background"`, so it must read naturally with that word appended.
 * The first four values are the original ones and must not change — saved
 * shoots store the value, and renaming one would blank its dropdown.
 */
export const BACKDROPS: Array<[string, string]> = [
  // Studio
  ['studio seamless', 'Studio · white seamless'],
  ['light grey studio seamless', 'Studio · light grey'],
  ['dark charcoal studio seamless', 'Studio · charcoal'],
  ['solid pastel colour studio wall', 'Studio · pastel colour'],
  ['textured concrete wall', 'Concrete wall'],
  ['editorial set', 'Editorial set'],
  // Interior
  ['lifestyle interior', 'Lifestyle interior'],
  ['modern loft interior with tall windows', 'Loft · tall windows'],
  ['marble lobby interior', 'Marble lobby'],
  // Outdoor
  ['outdoor street', 'Outdoor street'],
  ['cobblestone old-town street', 'Old-town cobblestone'],
  ['urban rooftop with city skyline', 'Rooftop · city skyline'],
  ['green park with trees', 'Park · greenery'],
  ['flowering garden', 'Garden'],
  ['sunlit beach', 'Beach'],
  ['poolside', 'Poolside'],
  ['desert dunes', 'Desert dunes'],
];

export const MOODS = ['clean', 'warm editorial', 'moody', 'bright airy'];

export const LIGHTINGS = [
  'soft bright commercial',
  'golden hour',
  'high-key studio',
  'dramatic',
];

/** Mirrors the server-side GENDER_BY_CAT — used to pre-filter the model picker. */
export const GENDER_BY_CAT: Record<string, string> = {
  womenswear: 'female',
  menswear: 'male',
  kidswear: 'child',
  footwear: 'female',
  accessory: 'female',
};

export const VIEW_SLUGS = [
  'generate',
  'gallery',
  'models',
  'logs',
  'usage',
  'recharge',
  'billing',
  'admin',
] as const;

export type ViewSlug = (typeof VIEW_SLUGS)[number];

/** Views only an admin may open. */
export const ADMIN_VIEWS: ViewSlug[] = ['logs', 'admin'];