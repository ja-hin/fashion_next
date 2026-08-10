/**
 * Razorpay integration.
 *
 * No SDK: creating an order is a single Basic-auth REST call and both signature
 * checks are plain HMAC-SHA256, so the dependency would only add surface area.
 *
 * The security model, in short:
 *   - The browser never sends an amount. It sends a pack id or a credit count,
 *     and the server prices it from lib/pricing.ts.
 *   - Credits are granted by exactly one atomic status transition per order
 *     (created → paid), so the Checkout callback and the webhook can both fire
 *     for the same payment and only one of them can credit.
 *   - The webhook is the authoritative path. A user who pays and immediately
 *     closes the tab never reaches the Checkout callback, and the webhook is
 *     what saves them.
 */
import 'server-only';
import crypto from 'node:crypto';
import { HttpError } from './api';
import {
  RAZORPAY_KEY_ID,
  RAZORPAY_KEY_SECRET,
  RAZORPAY_WEBHOOK_SECRET,
  PAYMENTS_ENABLED,
  PAYMENT_CURRENCY,
  INVOICE_PREFIX,
} from './config';
import { orders } from './mongo';
import { adjustBalance, markFirstPayment } from './auth';
import { nextInvoiceNo } from './settings';
import { gstBreakdown, type Quote } from './pricing';
import type { OrderDoc, UserDoc } from './types';

const API = 'https://api.razorpay.com/v1';

function authHeader(): string {
  return 'Basic ' + Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64');
}

export function assertPaymentsEnabled(): void {
  if (!PAYMENTS_ENABLED) {
    throw new HttpError(
      503,
      'Payments are not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.',
    );
  }
}

/**
 * Constant-time string compare. A plain `===` on a signature leaks how many
 * leading bytes were correct through timing, which is enough to forge one byte
 * at a time given enough attempts.
 */
function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function hmac(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

// ── order creation ──────────────────────────────────────────────────

interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  status: string;
}

/**
 * Create a Razorpay order and persist our own record of it.
 * The persisted `credits` is what will be granted — decided here, at order
 * time, so nothing the browser sends later can change it.
 */
export async function createOrder(
  user: UserDoc,
  q: Quote,
  gstRate: number,
): Promise<OrderDoc> {
  assertPaymentsEnabled();

  // Razorpay caps receipt at 40 chars.
  const receipt = `rcpt_${crypto.randomBytes(8).toString('hex')}`;

  const res = await fetch(`${API}/orders`, {
    method: 'POST',
    headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: q.paise,
      currency: PAYMENT_CURRENCY,
      receipt,
      notes: {
        user_id: user._id,
        email: user.email,
        credits: String(q.credits),
        pack: q.packId ?? 'custom',
      },
    }),
  });

  const body = (await res.json().catch(() => null)) as
    | (RazorpayOrder & { error?: { description?: string } })
    | null;

  if (!res.ok || !body?.id) {
    const detail = body?.error?.description ?? `Razorpay returned ${res.status}`;
    console.error('[razorpay] order creation failed', res.status, body);
    throw new HttpError(502, `Could not start the payment: ${detail}`);
  }

  // Snapshotted on the order, so a later admin change to the GST rate can't
  // retroactively alter an invoice that was already issued.
  const { gst } = gstBreakdown(q.paise, gstRate);
  const doc: OrderDoc = {
    _id: body.id,
    user_id: user._id,
    user_email: user.email,
    credits: q.credits,
    amount: q.paise,
    gst,
    gst_rate: gstRate,
    currency: body.currency ?? PAYMENT_CURRENCY,
    pack_id: q.packId,
    label: q.label,
    status: 'created',
    created: new Date().toISOString(),
    // Snapshotted from the profile as it stands right now. An invoice must keep
    // the GSTIN and place of supply that were true when the payment was made,
    // so a later profile edit cannot rewrite tax already charged.
    ...(user.gstin ? { buyer_gstin: user.gstin } : {}),
    ...(user.state ? { buyer_state: user.state } : {}),
  };

  await (await orders()).insertOne(doc);
  return doc;
}

// ── signature verification ──────────────────────────────────────────

/** Verify the three fields Razorpay Checkout hands back to the browser. */
export function verifyCheckoutSignature(opts: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  if (!RAZORPAY_KEY_SECRET) return false;
  const expected = hmac(`${opts.orderId}|${opts.paymentId}`, RAZORPAY_KEY_SECRET);
  return safeEqual(expected, opts.signature);
}

/**
 * Verify a webhook. Must be given the RAW request body — re-serialising the
 * parsed JSON changes key order and whitespace, and the signature stops
 * matching.
 */
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  if (!RAZORPAY_WEBHOOK_SECRET) return false;
  const expected = hmac(rawBody, RAZORPAY_WEBHOOK_SECRET);
  return safeEqual(expected, signature);
}

/** Webhooks are rejected outright when no secret is configured — never trusted blindly. */
export const WEBHOOK_CONFIGURED = Boolean(RAZORPAY_WEBHOOK_SECRET);

// ── crediting ───────────────────────────────────────────────────────

export interface CreditResult {
  /** True only for the single call that actually moved the balance. */
  credited: boolean;
  order: OrderDoc | null;
  balance: number | null;
}

/**
 * Grant an order's credits, exactly once.
 *
 * The `status: 'created'` filter is the whole idempotency story: Mongo applies
 * findOneAndUpdate atomically, so of the Checkout callback and the webhook —
 * which routinely race on a successful payment — precisely one matches and
 * flips the row. The loser gets null back and credits nothing.
 */
export async function creditOrder(
  orderId: string,
  paymentId: string,
  via: 'checkout' | 'webhook',
): Promise<CreditResult> {
  const col = await orders();

  const now = new Date();

  const won = await col.findOneAndUpdate(
    { _id: orderId, status: 'created' },
    {
      $set: {
        status: 'paid',
        payment_id: paymentId,
        credited_via: via,
        paid_at: now.toISOString(),
      },
    },
    { returnDocument: 'after' },
  );

  if (!won) {
    // Already paid, already failed, or unknown. Return what we have so the
    // caller can still show the user a sensible balance.
    const existing = await col.findOne({ _id: orderId });
    return { credited: false, order: existing, balance: null };
  }

  // Only the winner of the status flip gets an invoice number. Claiming it
  // before the flip would burn a number on every loser of the checkout/webhook
  // race, and tax invoice numbering has to be gapless.
  let invoiceNo = won.invoice_no;
  if (!invoiceNo) {
    invoiceNo = await nextInvoiceNo(INVOICE_PREFIX, now);
    await col.updateOne(
      { _id: orderId, invoice_no: { $exists: false } },
      { $set: { invoice_no: invoiceNo, invoice_date: now.toISOString() } },
    );
    won.invoice_no = invoiceNo;
    won.invoice_date = now.toISOString();
  }

  // Lifts the free-tier watermark from every image this account has generated,
  // past and future. Done before the balance move so that even if crediting
  // fails and needs manual reconciliation, someone who has genuinely paid is
  // never left looking at watermarked images.
  await markFirstPayment(won.user_id, now.toISOString());

  const balance = await adjustBalance(won.user_id, won.credits);
  if (balance === null) {
    // The order is marked paid but the balance did not move — the user row is
    // missing or unwritable. Loud, because it needs manual reconciliation.
    console.error(
      `[razorpay] PAID BUT NOT CREDITED order=${orderId} payment=${paymentId} ` +
        `user=${won.user_id} credits=${won.credits}`,
    );
  }

  return { credited: balance !== null, order: won, balance };
}

/** Record a failed payment. Never touches the balance. */
export async function failOrder(orderId: string, reason: string): Promise<void> {
  await (await orders()).updateOne(
    { _id: orderId, status: 'created' },
    { $set: { status: 'failed', failure_reason: reason.slice(0, 300) } },
  );
}