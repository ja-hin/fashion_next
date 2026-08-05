/**
 * App-wide settings — the replacement for the old data/state.json.
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
  GENIE_MAX_PER_PROMPT,
} from './config';
import { financialYear } from './invoice';
import type { SettingsDoc, PriceGrid, Resolution, ShootOpts } from './types';

const DEFAULT_PRICES: PriceGrid = {
  imagine: { '1K': 5, '2K': 10, '4K': 20 },
  saved: { '1K': 8, '2K': 16, '4K': 32 },
};

const DEFAULTS: SettingsDoc = {
  _id: 'app',
  price_per_image: PRICE_PER_IMAGE,
  genie_free: GENIE_FREE_PER_PROMPT,
  genie_price: GENIE_PRICE_PER_IMPROVE,
  genie_max: GENIE_MAX_PER_PROMPT,
  shoot_seq: 0,
  prices: DEFAULT_PRICES,
};

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
  // `shoot_seq` out of $setOnInsert — Mongo rejects an update that touches the
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
 * is an atomic $inc on a per-year counter — two payments landing in the same
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
  opts: Pick<ShootOpts, 'model_id'> | null | undefined,
  res: string = '1K',
): number {
  const mode = opts?.model_id ? 'saved' : 'imagine';
  const r = normaliseResolution(res);
  const v = s.prices?.[mode]?.[r];
  return Number.isFinite(v) ? Number(v) : Number(s.price_per_image ?? 1);
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