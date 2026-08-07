/**
 * Credit pricing.
 *
 * Packs and rates live in the settings document and are edited from the admin
 * page — the values here are only the fallback used before an admin has ever
 * saved, and the shape everything else is typed against.
 *
 * Deliberately NOT 'server-only': the Recharge view, the admin editor and the
 * public pricing page all import it to render. That does not make it
 * client-trusted. The order route loads the config from the database and
 * re-derives the amount with `quote()`, ignoring anything the browser sends —
 * so a tampered client can only ever ask for a price the admin has sanctioned.
 *
 * All money is in paise (Razorpay's unit) to keep it integer — never floats.
 */

export interface Pack {
  id: string;
  name: string;
  /** Credits paid for. */
  credits: number;
  /** Extra credits granted free — the bulk incentive. */
  bonus: number;
  /**
   * What the customer is charged, in paise. Set independently of credits so an
   * admin can discount a tier without touching the headline per-credit rate.
   */
  paise: number;
  blurb: string;
  /** Hidden from the buy flow and the public page when false. */
  active: boolean;
  /** Renders the "Most popular" ribbon. At most one should carry it. */
  popular: boolean;
}

export interface BillingConfig {
  /** Rate for a custom top-up, and the reference price for "you save" maths. */
  paise_per_credit: number;
  /** 0.18 = 18%. Zero disables tax lines everywhere. */
  gst_rate: number;
  custom_enabled: boolean;
  custom_min_credits: number;
  custom_max_credits: number;
  packs: Pack[];
}

export const DEFAULT_BILLING: BillingConfig = {
  paise_per_credit: 500,
  gst_rate: 0.18,
  custom_enabled: true,
  custom_min_credits: 20,
  custom_max_credits: 10_000,
  packs: [
    {
      id: 'starter',
      name: 'Starter',
      credits: 100,
      bonus: 0,
      paise: 50_000,
      blurb: 'A first shoot or two',
      active: true,
      popular: false,
    },
    {
      id: 'studio',
      name: 'Studio',
      credits: 250,
      bonus: 25,
      paise: 125_000,
      blurb: '+10% bonus credits',
      active: true,
      popular: true,
    },
    {
      id: 'pro',
      name: 'Pro',
      credits: 600,
      bonus: 90,
      paise: 300_000,
      blurb: '+15% bonus credits',
      active: true,
      popular: false,
    },
    {
      id: 'agency',
      name: 'Agency',
      credits: 1500,
      bonus: 300,
      paise: 750_000,
      blurb: '+20% bonus credits',
      active: true,
      popular: false,
    },
  ],
};

// ── display helpers ─────────────────────────────────────────────────

/** "₹1,250" — drops the decimals when the amount is whole rupees. */
export function rupees(paise: number): string {
  const r = paise / 100;
  return (
    '₹' +
    r.toLocaleString('en-IN', {
      minimumFractionDigits: Number.isInteger(r) ? 0 : 2,
      maximumFractionDigits: 2,
    })
  );
}

/** GST split for a GST-inclusive amount. base + gst === paise, exactly. */
export function gstBreakdown(paise: number, gstRate: number): { base: number; gst: number } {
  if (gstRate <= 0) return { base: paise, gst: 0 };
  const base = Math.round(paise / (1 + gstRate));
  return { base, gst: paise - base };
}

/** Total credits a pack grants. */
export const packCredits = (p: Pack): number => p.credits + p.bonus;

/**
 * Bonus as a percentage of the paid credits — 250 base + 25 bonus = 10%.
 * Measured against the base, not the total, so "10% extra" means what a buyer
 * expects: ten percent more than they paid for.
 */
export function bonusPct(p: Pack): number {
  if (p.credits <= 0 || p.bonus <= 0) return 0;
  return Math.round((p.bonus / p.credits) * 100);
}

/** Effective paise per credit once the bonus is counted. */
export function effectiveRate(p: Pack): number {
  const c = packCredits(p);
  return c > 0 ? p.paise / c : 0;
}

/**
 * Percentage saved versus buying the same credits at the custom rate.
 * Returns 0 when the pack is no cheaper, so the UI never shows "save 0%".
 */
export function savingsPct(p: Pack, cfg: BillingConfig): number {
  const list = packCredits(p) * cfg.paise_per_credit;
  if (list <= 0 || p.paise >= list) return 0;
  return Math.round(((list - p.paise) / list) * 100);
}

// ── quoting ─────────────────────────────────────────────────────────

export interface Quote {
  /** Credits actually added to the balance (paid + bonus). */
  credits: number;
  /** Amount to charge, in paise. */
  paise: number;
  packId: string | null;
  label: string;
}

export const activePacks = (cfg: BillingConfig): Pack[] => cfg.packs.filter((p) => p.active);

export function packById(cfg: BillingConfig, id: string): Pack | null {
  return cfg.packs.find((p) => p.id === id) ?? null;
}

/** Quote a pack. Inactive packs are refused — an admin hid it for a reason. */
export function quoteForPack(cfg: BillingConfig, id: string): Quote | null {
  const p = packById(cfg, id);
  if (!p || !p.active) return null;
  if (!Number.isFinite(p.paise) || p.paise <= 0) return null;
  return {
    credits: packCredits(p),
    paise: Math.round(p.paise),
    packId: p.id,
    label: `${p.name} pack — ${packCredits(p)} credits`,
  };
}

/**
 * Quote a custom credit count. Returns null when custom top-ups are switched
 * off, or the input is not a whole number inside the configured range — so
 * callers reject rather than charge something surprising.
 */
export function quoteForCustom(cfg: BillingConfig, credits: number): Quote | null {
  if (!cfg.custom_enabled) return null;
  if (!Number.isInteger(credits)) return null;
  if (credits < cfg.custom_min_credits || credits > cfg.custom_max_credits) return null;
  const paise = Math.round(credits * cfg.paise_per_credit);
  if (paise <= 0) return null;
  return { credits, paise, packId: null, label: `${credits} credits` };
}

/** Resolve whatever the browser asked for into a quote we're willing to honour. */
export function quote(
  cfg: BillingConfig,
  opts: { packId?: string | null; credits?: number | null },
): Quote | null {
  if (opts.packId) return quoteForPack(cfg, opts.packId);
  if (typeof opts.credits === 'number') return quoteForCustom(cfg, opts.credits);
  return null;
}

// ── validation (shared by the admin route) ──────────────────────────

const clampInt = (v: unknown, lo: number, hi: number, dflt: number): number => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(Math.max(n, lo), hi) : dflt;
};

/**
 * Parse a value that must be a positive whole number, or null.
 *
 * Distinct from clampInt on purpose: clamping a submitted 0 or -500 up to the
 * low bound would turn "priced at nothing" into "priced at one paise" and the
 * caller's `<= 0` guard would never fire. Rejecting has to happen before any
 * clamping, or a zero-priced pack silently becomes buyable.
 */
const positiveInt = (v: unknown, hi: number): number | null => {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(n, hi);
};

const slug = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32);

/**
 * Coerce admin-submitted packs into a safe list.
 *
 * Runs on the server before anything is stored, because these values become
 * real charges. Anything unparseable is dropped rather than defaulted to zero —
 * a pack priced at ₹0 would hand out free credits.
 */
export function sanitisePacks(raw: unknown): Pack[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: Pack[] = [];

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;

    const name = String(r.name ?? '').trim().slice(0, 40);
    if (!name) continue;

    // Rejected outright, never clamped — a pack priced at zero would hand out
    // free credits, and a pack with zero credits would charge for nothing.
    const credits = positiveInt(r.credits, 1_000_000);
    const paise = positiveInt(r.paise, 100_000_000);
    if (credits === null || paise === null) continue;

    let id = slug(String(r.id ?? '') || name) || `pack_${out.length + 1}`;
    while (seen.has(id)) id = `${id}_${out.length + 1}`;
    seen.add(id);

    out.push({
      id,
      name,
      credits,
      bonus: clampInt(r.bonus, 0, 1_000_000, 0),
      paise,
      blurb: String(r.blurb ?? '').trim().slice(0, 80),
      active: r.active !== false,
      popular: r.popular === true,
    });
  }

  // At most one ribbon, whatever the client sent.
  let flagged = false;
  for (const p of out) {
    if (p.popular && !flagged) flagged = true;
    else p.popular = false;
  }
  return out;
}