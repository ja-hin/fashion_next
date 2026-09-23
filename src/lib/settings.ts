/**
 * App-wide settings , the replacement for the old data/state.json.
 *
 * Stored as one document (`settings/_id: "app"`) so pricing edits are atomic and
 * the sequential shoot counter can be incremented without a read-modify-write
 * race between two simultaneous generations.
 */
import 'server-only';
import { settings } from './mongo';
import {
  PRICE_PER_IMAGE,
  GENIE_FREE_PER_PROMPT,
  GENIE_PRICE_PER_IMPROVE,
  VIDEO_PRICE,
  EXTRACT_PRICE,
  GENIE_MAX_PER_PROMPT,
} from './config';
import { financialYear } from './invoice';
import { DEFAULT_BILLING, type BillingConfig } from './pricing';
import type { SettingsDoc, PriceGrid, Resolution, ShootOpts, EngineConfig } from './types';

const DEFAULT_PRICES: PriceGrid = {
  imagine: { '1K': 5, '2K': 10, '4K': 20 },
  saved: { '1K': 8, '2K': 16, '4K': 32 },
};

/**
 * Special Category starts at the ordinary rate.
 *
 * Deliberately not dearer out of the box: the desk costs the same to run, and a
 * markup nobody asked for is the kind of thing that is noticed on an invoice
 * long after whoever set it has forgotten. The admin can raise it in one place.
 */
const DEFAULT_SPECIAL_PRICES: PriceGrid = {
  imagine: { ...DEFAULT_PRICES.imagine },
  saved: { ...DEFAULT_PRICES.saved },
};

/** All blank , every job keeps the engine its environment variable names. */
const DEFAULT_ENGINES: EngineConfig = {
  imagine: '',
  saved: '',
  special_imagine: '',
  special_saved: '',
  extract: '',
};

const DEFAULTS: SettingsDoc = {
  _id: 'app',
  price_per_image: PRICE_PER_IMAGE,
  genie_free: GENIE_FREE_PER_PROMPT,
  genie_price: GENIE_PRICE_PER_IMPROVE,
  video_price: VIDEO_PRICE,
  extract_price: EXTRACT_PRICE,
  genie_max: GENIE_MAX_PER_PROMPT,
  shoot_seq: 0,
  user_seq: 0,
  prices: DEFAULT_PRICES,
  special_prices: DEFAULT_SPECIAL_PRICES,
  engines: DEFAULT_ENGINES,
  billing: DEFAULT_BILLING,
};

/**
 * The live top-up configuration.
 *
 * Every field is defaulted individually rather than falling back to
 * DEFAULT_BILLING wholesale, so a settings document saved by an older version ,
 * or one an admin partially wrote , can't leave a rate undefined and price a
 * charge at NaN. An empty pack list is left empty on purpose: an admin who
 * deactivated everything meant it, and silently resurrecting the defaults would
 * put packs back on sale.
 */
export async function getBilling(): Promise<BillingConfig> {
  const s = await getSettings();
  const b = s.billing;
  if (!b) return DEFAULT_BILLING;

  const nz = (v: unknown, dflt: number) => (Number.isFinite(Number(v)) ? Number(v) : dflt);

  return {
    paise_per_credit: nz(b.paise_per_credit, DEFAULT_BILLING.paise_per_credit),
    gst_rate: nz(b.gst_rate, DEFAULT_BILLING.gst_rate),
    custom_enabled: b.custom_enabled !== false,
    custom_min_credits: nz(b.custom_min_credits, DEFAULT_BILLING.custom_min_credits),
    custom_max_credits: nz(b.custom_max_credits, DEFAULT_BILLING.custom_max_credits),
    packs: Array.isArray(b.packs) ? b.packs : DEFAULT_BILLING.packs,
  };
}

/** Read settings, creating the document with defaults on first use. */
export async function getSettings(): Promise<SettingsDoc> {
  const col = await settings();
  const doc = await col.findOne({ _id: 'app' });
  if (doc) {
    // Fill in anything a migrated/partial document is missing, so a state.json
    // written by an older version can't leave a field undefined.
    return {
      ...DEFAULTS,
      ...doc,
      prices: {
        imagine: { ...DEFAULT_PRICES.imagine, ...(doc.prices?.imagine ?? {}) },
        saved: { ...DEFAULT_PRICES.saved, ...(doc.prices?.saved ?? {}) },
      },
      /* Falls back to the MAIN grid, not to DEFAULT_SPECIAL_PRICES: a settings
         document written before this existed was charging the ordinary rate,
         and the upgrade must not quietly re-price anyone's shoots. */
      special_prices: {
        imagine: {
          ...DEFAULT_PRICES.imagine,
          ...(doc.prices?.imagine ?? {}),
          ...(doc.special_prices?.imagine ?? {}),
        },
        saved: {
          ...DEFAULT_PRICES.saved,
          ...(doc.prices?.saved ?? {}),
          ...(doc.special_prices?.saved ?? {}),
        },
      },
    };
  }
  await col.updateOne({ _id: 'app' }, { $setOnInsert: DEFAULTS }, { upsert: true });
  return DEFAULTS;
}

export async function updateSettings(patch: Partial<SettingsDoc>): Promise<SettingsDoc> {
  const col = await settings();
  const { _id: _ignored, ...rest } = patch;
  await col.updateOne({ _id: 'app' }, { $set: rest }, { upsert: true });
  return getSettings();
}

/**
 * Claim the next sequential shoot number (S0007 and friends).
 * $inc is atomic, so two shoots started at the same instant can't collide.
 */
export async function nextShootNumber(): Promise<number> {
  const col = await settings();

  // Make sure the document exists first. Doing this as a separate call keeps
  // `shoot_seq` out of $setOnInsert , Mongo rejects an update that touches the
  // same path in both $inc and $setOnInsert ("would create a conflict").
  const { shoot_seq: _seq, ...defaultsWithoutSeq } = DEFAULTS;
  await col.updateOne(
    { _id: 'app' },
    { $setOnInsert: { ...defaultsWithoutSeq, shoot_seq: 0 } },
    { upsert: true },
  );

  const res = await col.findOneAndUpdate(
    { _id: 'app' },
    { $inc: { shoot_seq: 1 } },
    { returnDocument: 'after' },
  );
  return Number(res?.shoot_seq ?? 1);
}

/**
 * Claim the next invoice number for the current financial year.
 *
 * Tax invoice numbering must be sequential and gapless within a year, so this
 * is an atomic $inc on a per-year counter , two payments landing in the same
 * millisecond cannot be handed the same number. Counters restart at 1 each
 * April, which is why they're keyed by year rather than being one global count.
 */
export async function nextInvoiceNo(prefix: string, now = new Date()): Promise<string> {
  const fy = financialYear(now);
  const col = await settings();

  await col.updateOne({ _id: 'app' }, { $setOnInsert: { ...DEFAULTS } }, { upsert: true });

  const res = await col.findOneAndUpdate(
    { _id: 'app' },
    { $inc: { [`invoice_seq.${fy}`]: 1 } },
    { returnDocument: 'after' },
  );

  const n = Number(res?.invoice_seq?.[fy] ?? 1);
  return `${prefix}/${fy}/${String(n).padStart(4, '0')}`;
}

/** Zero-padded public user id , U0001. */
export const userNoStr = (n: number): string =>
  'U' + String(Math.trunc(Number(n ?? 0))).padStart(4, '0');

/**
 * Claim the next public user id. $inc is atomic, so two signups landing at the
 * same instant can't be handed the same one.
 */
export async function nextUserNo(): Promise<string> {
  const col = await settings();

  // Same shape as nextShootNumber: the counter is kept out of $setOnInsert
  // because Mongo rejects an update touching one path in both $inc and
  // $setOnInsert ("would create a conflict").
  const { user_seq: _seq, ...defaultsWithoutSeq } = DEFAULTS;
  await col.updateOne(
    { _id: 'app' },
    { $setOnInsert: { ...defaultsWithoutSeq, user_seq: 0 } },
    { upsert: true },
  );

  const res = await col.findOneAndUpdate(
    { _id: 'app' },
    { $inc: { user_seq: 1 } },
    { returnDocument: 'after' },
  );
  return userNoStr(Number(res?.user_seq ?? 1));
}

const VALID_RES: Resolution[] = ['1K', '2K', '4K'];

export function normaliseResolution(v: string | null | undefined): Resolution {
  return VALID_RES.includes(v as Resolution) ? (v as Resolution) : '1K';
}

/**
 * Credits charged for one generated image, by shoot mode × output resolution.
 * A shoot anchored to a saved model costs the "saved" rate; everything else is
 * the "imagine" rate.
 */
export function shootCost(
  s: SettingsDoc,
  opts: Pick<ShootOpts, 'model_id' | 'special'> | null | undefined,
  res: string = '1K',
): number {
  const mode = opts?.model_id ? 'saved' : 'imagine';
  const r = normaliseResolution(res);
  // The Special Category desk bills from its own grid; everything else, and
  // anything that does not say, bills from the ordinary one.
  const grid = opts?.special ? (s.special_prices ?? s.prices) : s.prices;
  const v = grid?.[mode]?.[r];
  return Number.isFinite(v) ? Number(v) : Number(s.price_per_image ?? 1);
}

/**
 * The engine an admin has chosen for one kind of job, or '' for the default.
 *
 * Trimmed, because a stray space in a settings box would be sent to Google as
 * part of a model id and come back as a flat 404 on every generation.
 */
export function engineFor(
  s: SettingsDoc,
  job: keyof EngineConfig,
): string {
  return String(s.engines?.[job] ?? '').trim();
}

/** Which engine key a shoot falls under. */
export function engineKey(opts: Pick<ShootOpts, 'model_id' | 'special'> | null | undefined) {
  const saved = !!opts?.model_id;
  if (opts?.special) return saved ? 'special_saved' : 'special_imagine';
  return saved ? 'saved' : 'imagine';
}

// ── formatting helpers shared by the API + migration ────────────────
export const shootNoStr = (n: number | undefined | null) =>
  'S' + String(Math.trunc(Number(n ?? 0))).padStart(4, '0');

export const safeName = (t: string | undefined | null) =>
  (t ?? 'image')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase()
    .slice(0, 48) || 'image';