/**
 * Shared document + payload shapes.
 *
 * These mirror the MongoDB collections one-to-one. Keys were kept identical to
 * the old JSON/SQLite field names wherever possible, so the migration script is
 * a straight copy and old records stay readable.
 */

export type Resolution = '1K' | '2K' | '4K';
export type ShootMode = 'imagine' | 'saved';
export type Gender = 'female' | 'male' | 'child';

// ── users ───────────────────────────────────────────────────────────
export interface UserDoc {
  _id: string; // hex id (kept from the old SQLite `users.id`)
  email: string; // always lower-cased + trimmed
  name: string;
  pw_hash: string; // pbkdf2-hmac-sha256, hex
  pw_salt: string; // hex
  is_admin: boolean;
  balance: number; // credits
  created: string; // ISO, seconds precision
  active: boolean;
}

/** A user as sent to the browser — never includes the password hash/salt. */
export interface PublicUser {
  id: string;
  email: string;
  name: string;
  is_admin: boolean;
  balance: number;
  created: string;
  active: boolean;
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
  input_family: 'garment_in' | 'extend' | 'recast';
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
  hero_file: string | null;
  manifest: ManifestItem[];
  created: string;
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
  prices: PriceGrid;
  /** Per-financial-year invoice counters, keyed "2026-27". */
  invoice_seq?: Record<string, number>;
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