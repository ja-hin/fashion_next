/**
 * The creative vocabulary shared by the studio dropdowns and Genie.
 *
 * These lived in lib/client/constants.ts, which is a `'use client'` module and
 * therefore can't be imported from a route handler. Genie has to be told the
 * EXACT set of values it may choose from — it returns a spec that gets applied
 * straight to the Add Pose selects, and a free-text backdrop like "sunlit
 * terrace" would land on a <Select> that has no such option and silently show
 * nothing. So the lists live here, and constants.ts re-exports them.
 *
 * Stored shoots keep the raw value, so renaming one blanks its dropdown on
 * every historic shoot. Add new entries; don't edit existing ones.
 */

export const FRAMINGS: Array<[string, string]> = [
  ['full_body', 'Full body'],
  ['three_quarter', '¾'],
  ['knee_up', 'Knee-up'],
  ['waist_up', 'Waist-up'],
  ['portrait', 'Portrait'],
  ['close_up', 'Close-up'],
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

export const FRAMING_KEYS = FRAMINGS.map(([v]) => v);
export const BACKDROP_KEYS = BACKDROPS.map(([v]) => v);
