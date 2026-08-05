/**
 * Invoice maths.
 *
 * Deliberately free of config and database imports so the arithmetic can be
 * checked in isolation — the route supplies the seller details.
 *
 * Everything is paise. The one rule that matters: the tax components must add
 * back up to the amount actually charged, exactly. Rounding each component
 * independently is what produces invoices that are off by a paisa and don't
 * reconcile against the payment gateway.
 */

/**
 * Indian financial year label for a date — April 1 to March 31.
 * A payment on 2026-03-31 belongs to 2025-26; one day later, to 2026-27.
 * Invoice numbering restarts each April, so this decides the counter key.
 */
export function financialYear(d: Date): string {
  const y = d.getFullYear();
  const startYear = d.getMonth() >= 3 ? y : y - 1; // month index 3 === April
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
}

export interface TaxSplit {
  /** Taxable value before GST. */
  base: number;
  cgst: number;
  sgst: number;
  igst: number;
  /** Always base + cgst + sgst + igst. */
  total: number;
  interState: boolean;
  ratePct: number;
}

/**
 * Split a GST-inclusive amount.
 *
 * Inter-state supply is one IGST line; intra-state is CGST + SGST at half each.
 * The halves are floor/remainder rather than two roundings, so an odd number of
 * paise lands entirely in one component instead of vanishing.
 */
export function taxSplit(
  amountInclusive: number,
  gstRate: number,
  interState: boolean,
): TaxSplit {
  const base = Math.round(amountInclusive / (1 + gstRate));
  const gst = amountInclusive - base;

  if (interState) {
    return {
      base,
      cgst: 0,
      sgst: 0,
      igst: gst,
      total: base + gst,
      interState: true,
      ratePct: gstRate * 100,
    };
  }

  const cgst = Math.floor(gst / 2);
  const sgst = gst - cgst;
  return {
    base,
    cgst,
    sgst,
    igst: 0,
    total: base + cgst + sgst,
    interState: false,
    ratePct: gstRate * 100,
  };
}

/**
 * Whether to charge IGST. Place of supply is the buyer's state; when we don't
 * know it (no GSTIN captured, which is every B2C sale) we fall back to treating
 * it as intra-state.
 */
export function isInterState(
  sellerState: string | undefined,
  buyerState: string | undefined,
): boolean {
  if (!sellerState || !buyerState) return false;
  return sellerState.trim().toLowerCase() !== buyerState.trim().toLowerCase();
}

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n];
  const t = TENS[Math.floor(n / 10)];
  const o = ONES[n % 10];
  return o ? `${t} ${o}` : t;
}

/** Indian grouping — lakh and crore, not million. */
function wordsForInt(n: number): string {
  if (n === 0) return 'Zero';
  const parts: string[] = [];
  const crore = Math.floor(n / 10_000_000);
  n %= 10_000_000;
  const lakh = Math.floor(n / 100_000);
  n %= 100_000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  const hundred = Math.floor(n / 100);
  const rest = n % 100;

  if (crore) parts.push(`${wordsForInt(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (hundred) parts.push(`${ONES[hundred]} Hundred`);
  if (rest) parts.push(twoDigits(rest));
  return parts.join(' ');
}

/** "Rupees One Thousand Two Hundred Fifty Only" — expected on Indian invoices. */
export function amountInWords(paise: number): string {
  const rupees = Math.floor(paise / 100);
  const p = paise % 100;
  const head = `Rupees ${wordsForInt(rupees)}`;
  return p ? `${head} and ${twoDigits(p)} Paise Only` : `${head} Only`;
}

/** "₹1,250.00" — invoices always show both decimal places. */
export function money(paise: number): string {
  return (
    '₹' +
    (paise / 100).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

/** "05 Aug 2026" from an ISO timestamp. */
export function invoiceDate(iso: string | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}