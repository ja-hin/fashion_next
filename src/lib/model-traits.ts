/**
 * What a model looks like, as choosable options.
 *
 * Until now an imagined model was one ethnicity from STYLES plus a LOOKS phrase
 * picked at random per shoot , so "a little older", "straighter hair" or "a
 * fuller build" were not things anyone could ask for. These are.
 *
 * Every trait is optional and every one defaults to `''`, which means "leave it
 * to the model". That matters: an unset trait must fall back to the existing
 * random LOOKS behaviour rather than quietly pinning every shoot to whatever
 * the first option happens to be.
 *
 * Shared on purpose. The Generate panel uses this today; the standalone model
 * creator will use the same vocabulary, so the two cannot drift into describing
 * the same person two different ways.
 */

export interface TraitOption {
  id: string;
  /** What the customer picks. */
  label: string;
  /** What the image model is told. Written as a phrase, not a word. */
  phrase: string;
  /**
   * A colour that stands for the option, for skin tones.
   *
   * Words for skin are imprecise and loaded , "wheatish" and "medium" mean
   * different things to different people, and a list of them reads as a
   * classification rather than a choice. A swatch shows the actual tone.
   */
  swatch?: string;
}

export interface TraitGroup {
  key: ModelTraitKey;
  label: string;
  options: readonly TraitOption[];
}

export type ModelTraitKey = 'skin' | 'age' | 'hair' | 'build' | 'height';

/** One shoot's choices. Absent or '' means "not specified". */
export type ModelTraits = Partial<Record<ModelTraitKey, string>>;

export const TRAIT_KEYS: readonly ModelTraitKey[] = ['skin', 'age', 'hair', 'build', 'height'];

/*
 * Skin is described independently of ethnicity rather than folded into it. The
 * two are genuinely separate axes , "Indian" spans fair to deep brown , and
 * collapsing them is how a catalogue ends up with one face per region.
 */
const SKIN: readonly TraitOption[] = [
  { id: 'fair', label: 'Fair', phrase: 'fair skin', swatch: '#F5D9C4' },
  { id: 'light', label: 'Light', phrase: 'light skin', swatch: '#EDC4A6' },
  { id: 'wheatish', label: 'Wheatish', phrase: 'a light wheatish complexion', swatch: '#DDAE85' },
  { id: 'medium', label: 'Medium', phrase: 'medium tan skin', swatch: '#C68E63' },
  { id: 'olive', label: 'Olive', phrase: 'olive skin', swatch: '#AE7B4E' },
  { id: 'brown', label: 'Brown', phrase: 'warm brown skin', swatch: '#8A5A33' },
  { id: 'deep', label: 'Deep', phrase: 'deep brown skin', swatch: '#5C3720' },
];

const AGE: readonly TraitOption[] = [
  { id: 'early20s', label: 'Early 20s', phrase: 'in her early 20s' },
  { id: 'mid20s', label: 'Mid 20s', phrase: 'in her mid 20s' },
  { id: 'late20s', label: 'Late 20s', phrase: 'in her late 20s' },
  { id: 'thirties', label: '30s', phrase: 'in her early 30s' },
  { id: 'forties', label: '40s', phrase: 'in her 40s' },
  { id: 'fifties', label: '50+', phrase: 'in her 50s, gracefully' },
];

const HAIR: readonly TraitOption[] = [
  { id: 'long_straight', label: 'Long straight', phrase: 'long straight hair' },
  { id: 'long_wavy', label: 'Long wavy', phrase: 'long wavy hair' },
  { id: 'shoulder', label: 'Shoulder length', phrase: 'shoulder-length hair' },
  { id: 'bob', label: 'Bob', phrase: 'a short bob' },
  { id: 'curly', label: 'Curly', phrase: 'natural curly hair' },
  { id: 'bun', label: 'Tied back', phrase: 'hair tied back in a sleek low bun' },
  { id: 'ponytail', label: 'Ponytail', phrase: 'a high ponytail' },
  { id: 'short', label: 'Short crop', phrase: 'a short cropped cut' },
];

/*
 * Named the way a fit model is booked, and described in terms a photographer
 * would use. "Plus size" is a real catalogue requirement, not an afterthought,
 * which is why it is on the list rather than reachable only by prompt.
 */
const BUILD: readonly TraitOption[] = [
  { id: 'slim', label: 'Slim', phrase: 'a slim build' },
  { id: 'athletic', label: 'Athletic', phrase: 'an athletic, toned build' },
  { id: 'average', label: 'Average', phrase: 'an average build' },
  { id: 'curvy', label: 'Curvy', phrase: 'a curvy figure' },
  { id: 'plus', label: 'Plus size', phrase: 'a plus-size figure' },
];

const HEIGHT: readonly TraitOption[] = [
  { id: 'petite', label: 'Petite', phrase: 'petite' },
  { id: 'average_h', label: 'Average', phrase: 'of average height' },
  { id: 'tall', label: 'Tall', phrase: 'tall' },
];

export const TRAIT_GROUPS: readonly TraitGroup[] = [
  { key: 'skin', label: 'Skin tone', options: SKIN },
  { key: 'age', label: 'Age', options: AGE },
  { key: 'hair', label: 'Hair', options: HAIR },
  { key: 'build', label: 'Build', options: BUILD },
  { key: 'height', label: 'Height', options: HEIGHT },
];

const BY_KEY: Record<ModelTraitKey, readonly TraitOption[]> = {
  skin: SKIN,
  age: AGE,
  hair: HAIR,
  build: BUILD,
  height: HEIGHT,
};

/** The chosen option, or null when nothing was chosen or the id is unknown. */
export const traitOption = (key: ModelTraitKey, id: string | undefined): TraitOption | null =>
  (id && BY_KEY[key]?.find((o) => o.id === id)) || null;

/** True when the customer has specified at least one trait. */
export const hasTraits = (t: ModelTraits | undefined): boolean =>
  !!t && TRAIT_KEYS.some((k) => traitOption(k, t[k]));

/**
 * The traits as one clause, e.g.
 *   "in her mid 20s, with a light wheatish complexion, long wavy hair, a slim build, tall"
 *
 * Order is fixed rather than following the object's keys, so the same choices
 * always produce the same sentence , the prompt is an input to a seeded model
 * and a reordered clause is a different prompt.
 *
 * `gender` rewrites the pronoun. Only the age phrases carry one, so this is a
 * narrow substitution rather than a general rewrite; a child is given no age or
 * build phrase at all, since neither belongs in a prompt about a minor.
 */
export function traitPhrase(traits: ModelTraits | undefined, gender: string): string {
  if (!traits) return '';
  const child = gender === 'child';

  const parts = TRAIT_KEYS.filter((k) => !(child && (k === 'age' || k === 'build')))
    .map((k) => traitOption(k, traits[k])?.phrase)
    .filter((p): p is string => !!p);

  if (!parts.length) return '';

  const clause = parts.join(', ');
  return gender === 'male' ? clause.replace(/\bher\b/g, 'his') : clause;
}

/** Keep only known keys and known ids , anything else came from somewhere else. */
export function parseTraits(input: Record<string, unknown> | undefined | null): ModelTraits {
  const out: ModelTraits = {};
  if (!input) return out;
  for (const k of TRAIT_KEYS) {
    const id = String(input[k] ?? '');
    if (traitOption(k, id)) out[k] = id;
  }
  return out;
}

/* ───────────────────────── casting (My Models) ─────────────────────────
 * The creator asks more than a shoot does, and asks it differently.
 *
 * A shoot needs one line about who is wearing the garment; casting is the
 * moment you decide who this person IS, so it adds hair colour, a vibe, a free
 * sentence, and an exact age rather than a band. Body, hairstyle and hair
 * colour are also gender-dependent here , "man-bun" and "tied back" are not
 * the same list, and offering both to everyone reads as a machine's list
 * rather than a casting call.
 *
 * Kept beside the shoot vocabulary rather than in its own file so the two
 * cannot describe a skin tone two different ways , SKIN is shared verbatim.
 */

export interface CastPicks {
  gender: 'woman' | 'man';
  /** Exact years. '' leaves it unsaid. */
  age: string;
  skin: string;
  body: string;
  hairstyle: string;
  haircolour: string;
  vibe: string;
}

export const CAST_DEFAULTS: CastPicks = {
  gender: 'woman',
  age: '',
  skin: '',
  body: '',
  hairstyle: '',
  haircolour: '',
  vibe: '',
};

const BODY_BY_GENDER: Record<string, readonly string[]> = {
  woman: ['Slim', 'Athletic', 'Curvy', 'Plus', 'Petite'],
  man: ['Slim', 'Athletic', 'Muscular', 'Broad', 'Lean'],
};

const HAIRSTYLE_BY_GENDER: Record<string, readonly string[]> = {
  woman: ['Long wavy', 'Long straight', 'Mid length', 'Short', 'Tied / bun'],
  man: ['Short crop', 'Buzz', 'Textured', 'Medium', 'Man-bun'],
};

const HAIRCOLOUR_BY_GENDER: Record<string, readonly string[]> = {
  woman: ['Black', 'Dark brown', 'Brown', 'Highlights', 'Grey'],
  man: ['Black', 'Dark brown', 'Brown', 'Salt-pepper', 'Grey'],
};

export const VIBES: readonly string[] = [
  'Clean commercial',
  'Editorial',
  'Soft natural',
  'High fashion',
  'Street',
  'Luxury',
];

/** The option rows the casting form shows, for one gender. */
export function castGroups(gender: string): Array<{
  key: keyof CastPicks;
  label: string;
  options: Array<{ id: string; label: string; swatch?: string }>;
}> {
  const g = gender === 'man' ? 'man' : 'woman';
  const plain = (xs: readonly string[]) => xs.map((x) => ({ id: x, label: x }));
  return [
    { key: 'skin', label: 'Skin tone', options: SKIN.map((o) => ({ id: o.id, label: o.label, swatch: o.swatch })) },
    { key: 'body', label: 'Build', options: plain(BODY_BY_GENDER[g]) },
    { key: 'hairstyle', label: 'Hair', options: plain(HAIRSTYLE_BY_GENDER[g]) },
    { key: 'haircolour', label: 'Hair colour', options: plain(HAIRCOLOUR_BY_GENDER[g]) },
    { key: 'vibe', label: 'Vibe', options: plain(VIBES) },
  ];
}

/**
 * One-tap changes offered on the refine step.
 *
 * Phrased as comparatives , "a bit older", "softer jaw" , because refine is an
 * EDIT of a face you are looking at, not a fresh description. "28 years old"
 * would restate the brief; "a bit older" adjusts what is in front of you.
 */
export const CAST_NUDGES: readonly string[] = [
  'a bit older',
  'a bit younger',
  'hair shorter',
  'hair longer',
  'softer jaw',
  'sharper cheekbones',
  'warmer skin',
  'cooler skin',
  'slimmer',
  'fuller figure',
  'fuller lips',
  'natural makeup',
  'brighter eyes',
  'friendlier expression',
];

/** Everything picked, as one line , used in the UI and in the prompt. */
export function castSummary(p: CastPicks): string {
  const skin = traitOption('skin', p.skin)?.label;
  return [
    p.gender === 'man' ? 'Man' : 'Woman',
    p.age && `${p.age}`,
    skin,
    p.body,
    [p.haircolour, p.hairstyle].filter(Boolean).join(' ') || null,
    p.vibe,
  ]
    .filter(Boolean)
    .join(' · ');
}
