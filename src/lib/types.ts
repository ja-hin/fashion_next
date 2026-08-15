/**
 * Shared document + payload shapes.
 *
 * These mirror the MongoDB collections one-to-one. Keys were kept identical to
 * the old JSON/SQLite field names wherever possible, so the migration script is
 * a straight copy and old records stay readable.
 */

import type { BillingConfig } from './pricing';
import type { RefRole, RefMode } from './ensemble';

export type Resolution = '1K' | '2K' | '4K';
export type ShootMode = 'imagine' | 'saved';
export type Gender = 'female' | 'male' | 'child';

// ── users ───────────────────────────────────────────────────────────
export interface UserDoc {
  _id: string; // hex id (kept from the old SQLite `users.id`)
  /**
   * Short human-readable id shown in the UI and quoted in support — "U0007".
   * Sequential and stable; `_id` stays the internal key so nothing has to be
   * re-pointed. Optional because accounts created before this existed are
   * backfilled at boot.
   */
  uid?: string;
  email: string; // always lower-cased + trimmed
  name: string;
  pw_hash: string; // pbkdf2-hmac-sha256, hex
  pw_salt: string; // hex
  is_admin: boolean;
  balance: number; // credits
  created: string; // ISO, seconds precision
  active: boolean;

  /**
   * When this account's first successful Razorpay payment was credited.
   *
   * Absent = still on the free credits, so their images are served with the
   * watermark (see lib/watermark.ts). Set once and never cleared: paying once
   * removes the mark from everything they have ever generated, and running the
   * balance back down to zero does not bring it back. Credits granted by an
   * admin deliberately do NOT set this — only a real payment does.
   */
  first_paid_at?: string; // ISO

  /**
   * Profile details the user maintains themselves (see lib/profile.ts). All
   * optional — an account created before this existed simply has none of them,
   * and nothing may assume they are present.
   *
   * `gstin` and `state` are billing data: they are snapshotted onto each order
   * so an invoice keeps the details that were true when it was issued.
   */
  phone?: string;
  company?: string;
  gstin?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
}

/** A user as sent to the browser — never includes the password hash/salt. */
export interface PublicUser {
  id: string;
  uid: string;
  email: string;
  name: string;
  is_admin: boolean;
  balance: number;
  created: string;
  active: boolean;
}

// ── password resets ─────────────────────────────────────────────────
/**
 * One outstanding password-reset request.
 *
 * `_id` is the SHA-256 of the emailed token, never the token itself — someone
 * who reads this collection still cannot construct a working link. Rows expire
 * via a TTL index and are deleted the moment a token is used.
 */
export interface ResetDoc {
  _id: string; // sha256(token), hex
  user_id: string;
  email: string;
  created: string; // ISO
  expires: Date; // TTL index drives cleanup
  /** Set when consumed, so a replay inside the TTL window is refused. */
  used_at?: string;
  requested_ip?: string;
}

// ── sessions ────────────────────────────────────────────────────────
export interface SessionDoc {
  _id: string; // the opaque session token
  user_id: string;
  created: string;
  expires: Date; // TTL index drives automatic cleanup
}

// ── shoots ──────────────────────────────────────────────────────────
export interface ShootOpts {
  style: string;
  category: string;
  scene: string;
  aspect: string;
  framing: string;
  /**
   * What the uploaded photo IS — a garment to try on, a shot that already has a
   * model, or one to recast. Independent of `ref_mode`.
   *
   * 'ensemble' is legacy: the mode used to be stored here, which meant picking
   * it destroyed the user's real input choice. Kept in the union so shoots
   * written before the split still load; nothing writes it any more.
   */
  input_family: 'garment_in' | 'extend' | 'recast' | 'ensemble';
  /**
   * How the tagged references relate to each other — several angles of ONE
   * garment, or several DIFFERENT items to assemble. Absent on older shoots,
   * where it is inferred from input_family.
   */
  ref_mode?: RefMode;
  allow_revealing: boolean;
  model_id: string;
  resolution: Resolution;
  owner: string;
  owner_email: string;
}

export interface ManifestItem {
  file: string;
  pose: string;
  aspect?: string;
  framing?: string;
  backdrop?: string;
  mood?: string;
  lighting?: string;
}

export interface ShootDoc {
  _id: string; // pid
  seed: number;
  opts: ShootOpts;
  no: number; // sequential shoot number → S0007
  name: string; // user-editable; falls back to the shoot number
  look: string; // per-shoot appearance variety phrase
  garment_file: string | null; // filename inside the shoot's storage folder
  /**
   * Ensemble shoots only: the tagged product references the hero is assembled
   * from, in the order they were uploaded. That order IS the numbered manifest
   * the prompt refers to, so it must never be re-sorted. See lib/ensemble.ts.
   */
  refs?: Array<{ file: string; role: RefRole }>;
  hero_file: string | null;
  manifest: ManifestItem[];
  created: string;
}

// ── saved garments ──────────────────────────────────────────────────

/**
 * A reusable garment: one product, photographed from several angles and tagged
 * once, so it can anchor any number of later shoots without re-uploading.
 *
 * Deliberately the same shape a shoot consumes (see lib/ensemble.ts) — a saved
 * garment IS a set of tagged references, so "use this" is a copy rather than a
 * conversion. `mode` records which kind it is: several angles of one garment,
 * or a whole assembled look.
 */
export interface GarmentDoc {
  _id: string; // gid
  name: string;
  owner: string;
  owner_email: string;
  created: string;
  /** Pre-fills the shoot's category when the garment is used. */
  category: string;
  mode: RefMode;
  refs: Array<{ file: string; role: RefRole }>;
}

/** A saved garment as sent to the browser (adds resolved URLs). */
export interface PublicGarment {
  id: string;
  name: string;
  created: string;
  category: string;
  mode: RefMode;
  thumb: string;
  ref_count: number;
  refs: Array<{ file: string; role: RefRole; url: string }>;
}

// ── saved models ────────────────────────────────────────────────────
export interface ModelRef {
  file: string;
  pose: string;
  primary: boolean;
  charsheet?: 'grid' | 'frame' | '';
  batch?: string;
}

export interface ModelTags {
  ethnicity?: string;
  gender?: string;
  vibe?: string;
}

export interface ModelDoc {
  _id: string; // mid
  name: string;
  owner: string;
  owner_email: string;
  created: string;
  source: 'shoot' | 'studio';
  source_pid: string;
  source_shoot: string;
  tags: ModelTags;
  refs: ModelRef[];
  kept_batch?: string;
}

/** A saved model as sent to the browser (adds resolved URLs + counts). */
export interface PublicModel {
  id: string;
  name: string;
  created: string;
  source: string;
  source_shoot: string;
  tags: ModelTags;
  thumb: string;
  ref_count: number;
  has_character_sheet: boolean;
  kept_batch: string;
  refs: Array<{
    file: string;
    pose: string;
    primary: boolean;
    charsheet: string;
    batch: string;
    url: string;
  }>;
}

// ── event log ───────────────────────────────────────────────────────
/**
 * One row in the event log. `_id` is deliberately absent — Mongo assigns an
 * ObjectId, and reads come back as WithId<LogDoc>.
 */
export interface LogDoc {
  ts: string; // ISO, seconds precision
  type: 'image' | 'genie' | 'charsheet';
  pid?: string;
  shoot?: string;
  seed?: number | string;
  pose?: string;
  category?: string;
  model?: string; // the *fashion* model (style key or saved-model id)
  status: string;
  cost: number; // credits charged to the user
  file?: string;
  img?: string;
  error?: string;
  attempt?: number;
  user?: string; // owner email
  // token usage of the underlying AI call
  ai_model?: string;
  in_tok?: number;
  out_tok?: number;
  tot_tok?: number;
  usd?: number;
}

// ── app settings (single document, replaces data/state.json) ────────
export interface PriceGrid {
  imagine: Record<Resolution, number>;
  saved: Record<Resolution, number>;
}

export interface SettingsDoc {
  _id: 'app';
  price_per_image: number;
  genie_free: number;
  genie_price: number;
  genie_max: number;
  shoot_seq: number;
  /** Counter behind the sequential user ids (U0001…). */
  user_seq?: number;
  prices: PriceGrid;
  /** Per-financial-year invoice counters, keyed "2026-27". */
  invoice_seq?: Record<string, number>;
  /**
   * Top-up packs and rates, edited from the admin page. Optional because
   * documents written before this existed won't have it — getBilling() falls
   * back to DEFAULT_BILLING.
   */
  billing?: BillingConfig;
}

// ── credit top-up orders ────────────────────────────────────────────

/**
 * One Razorpay order. `_id` IS the Razorpay order id, which makes the whole
 * flow idempotent for free: the webhook and the browser-side verify race each
 * other on every successful payment, and both funnel through a single
 * status transition on this document.
 */
export interface OrderDoc {
  _id: string; // razorpay order_id, e.g. "order_NpQ..."
  user_id: string;
  user_email: string;
  /** Credits to grant on success — locked in at order time, never re-read from the client. */
  credits: number;
  amount: number; // paise, GST-inclusive
  gst: number; // paise, the tax portion of `amount`
  /**
   * The rate in force when this order was placed (0.18 = 18%). Snapshotted so a
   * later admin change can't retroactively rewrite an issued invoice.
   */
  gst_rate?: number;
  currency: string;
  pack_id: string | null; // null for a custom amount
  label: string;
  /**
   * created → paid is the only transition that grants credits, and it is done
   * with an atomic filter on status, so a double callback can't double-credit.
   */
  status: 'created' | 'paid' | 'failed';
  payment_id?: string;
  /** How the payment was confirmed — useful when reconciling against Razorpay. */
  credited_via?: 'checkout' | 'webhook';
  failure_reason?: string;
  created: string; // ISO
  paid_at?: string; // ISO

  /**
   * Assigned once, at the moment the payment is credited — never at order
   * creation, because an abandoned checkout must not burn an invoice number.
   * Tax invoice numbering has to be gapless.
   */
  invoice_no?: string;
  invoice_date?: string; // ISO
  /** Optional B2B details; when the state differs from the seller's it's IGST. */
  buyer_gstin?: string;
  buyer_state?: string;
}

// ── in-flight generation jobs (in-memory, not persisted) ────────────
export interface JobResult {
  pose: string;
  img?: string;
  cost?: number;
  warn?: string;
  error?: string;
}

export interface Job {
  status: 'running' | 'done';
  total: number;
  done: number;
  results: JobResult[];
  product_id?: string;
  seed?: number;
  no?: number;
  shoot?: string;
  createdAt: number;
}