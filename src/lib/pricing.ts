/**
 * Credit pricing — the single source of truth for what a top-up costs.
 *
 * Deliberately NOT 'server-only': the Recharge view imports it to render the
 * packs. That does not make it client-trusted. The order route re-derives the
 * amount from `packId` / `credits` using the very same functions and ignores
 * any amount the browser sends, so a tampered client can only ever ask for a
 * price this table already sanctions.
 *
 * All money is in paise (Razorpay's unit) to keep it integer — never floats.
 */

/** ₹5 per credit. */
export const PAISE_PER_CREDIT = 1;

/** Displayed prices already include GST; this backs it out for the books. */
export const GST_RATE = 0.18;

export const CUSTOM_MIN_CREDITS = 20;
export const CUSTOM_MAX_CREDITS = 10_000;

export interface Pack {
  id: string;
  name: string;
  /** Credits paid for. */
  credits: number;
  /** Extra credits granted free — the bulk incentive. */
  bonus: number;
  /** Total charged, in paise. */
  paise: number;
  blurb: string;
}

const pack = (
  id: string,
  name: string,
  credits: number,
  bonus: number,
  blurb: string,
): Pack => ({ id, name, credits, bonus, paise: credits * PAISE_PER_CREDIT, blurb });

export const PACKS: Pack[] = [
  pack('starter', 'Starter', 100, 0, 'A first shoot or two'),
  pack('studio', 'Studio', 250, 25, '+10% bonus credits'),
  pack('pro', 'Pro', 600, 90, '+15% bonus credits'),
  pack('agency', 'Agency', 1500, 300, '+20% bonus credits'),
];

export interface Quote {
  /** Credits actually added to the balance (paid + bonus). */
  credits: number;
  /** Amount to charge, in paise. */
  paise: number;
  packId: string | null;
  label: string;
}

/** Rupees as a display string — "₹1,250". Amounts here are always whole rupees. */
export function rupees(paise: number): string {
  return '₹' + (paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

/** GST split for a GST-inclusive amount. base + gst === paise, exactly. */
export function gstBreakdown(paise: number): { base: number; gst: number } {
  const base = Math.round(paise / (1 + GST_RATE));
  return { base, gst: paise - base };
}

export function packById(id: string): Pack | null {
  return PACKS.find((p) => p.id === id) ?? null;
}

export function quoteForPack(id: string): Quote | null {
  const p = packById(id);
  if (!p) return null;
  return {
    credits: p.credits + p.bonus,
    paise: p.paise,
    packId: p.id,
    label: `${p.name} pack — ${p.credits + p.bonus} credits`,
  };
}

/**
 * Quote a custom credit count. Returns null when the input is not a whole
 * number inside the allowed range, so callers can reject rather than charge
 * something surprising.
 */
export function quoteForCustom(credits: number): Quote | null {
  if (!Number.isInteger(credits)) return null;
  if (credits < CUSTOM_MIN_CREDITS || credits > CUSTOM_MAX_CREDITS) return null;
  return {
    credits,
    paise: credits * PAISE_PER_CREDIT,
    packId: null,
    label: `${credits} credits`,
  };
}

/** Resolve whatever the browser asked for into a quote we're willing to honour. */
export function quote(opts: { packId?: string | null; credits?: number | null }): Quote | null {
  if (opts.packId) return quoteForPack(opts.packId);
  if (typeof opts.credits === 'number') return quoteForCustom(opts.credits);
  return null;
}