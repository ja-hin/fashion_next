/**
 * Billing read model — the shapes the Billing tab and the invoice page render.
 */
import 'server-only';
import { orders } from './mongo';
import { HttpError } from './api';
import { taxSplit, isInterState } from './invoice';
import { GST_RATE } from './pricing';
import {
  SELLER_NAME,
  SELLER_ADDRESS,
  SELLER_GSTIN,
  SELLER_PAN,
  SELLER_EMAIL,
  SELLER_STATE,
  INVOICE_SAC,
} from './config';
import type { OrderDoc, UserDoc } from './types';

export interface Seller {
  name: string;
  address: string;
  gstin: string;
  pan: string;
  email: string;
  state: string;
  sac: string;
  /** False when the seller isn't GST-registered — the invoice then omits tax lines. */
  gstRegistered: boolean;
}

export function seller(): Seller {
  return {
    name: SELLER_NAME,
    address: SELLER_ADDRESS,
    gstin: SELLER_GSTIN,
    pan: SELLER_PAN,
    email: SELLER_EMAIL,
    state: SELLER_STATE,
    sac: INVOICE_SAC,
    gstRegistered: Boolean(SELLER_GSTIN),
  };
}

/** One row in the Billing tab. */
export interface BillingRow {
  order_id: string;
  invoice_no: string | null;
  date: string;
  status: OrderDoc['status'];
  label: string;
  credits: number;
  amount: number;
  currency: string;
  payment_id: string | null;
}

function toRow(o: OrderDoc): BillingRow {
  return {
    order_id: o._id,
    invoice_no: o.invoice_no ?? null,
    date: o.paid_at ?? o.created,
    status: o.status,
    label: o.label,
    credits: o.credits,
    amount: o.amount,
    currency: o.currency,
    payment_id: o.payment_id ?? null,
  };
}

/**
 * A user's payment history, newest first.
 *
 * Includes failed and abandoned orders deliberately — "I was charged and got
 * nothing" is the commonest billing question, and a visible failed row answers
 * it faster than a support ticket.
 */
export async function history(userId: string, limit = 100): Promise<BillingRow[]> {
  const rows = await (await orders())
    .find({ user_id: userId })
    .sort({ created: -1 })
    .limit(Math.min(Math.max(limit, 1), 500))
    .toArray();
  return rows.map(toRow);
}

export interface InvoiceView {
  seller: Seller;
  buyer: { name: string; email: string; gstin: string | null; state: string | null };
  invoice_no: string;
  invoice_date: string;
  order_id: string;
  payment_id: string | null;
  description: string;
  credits: number;
  currency: string;
  tax: ReturnType<typeof taxSplit>;
  /** Total charged — always equals tax.total. */
  amount: number;
}

/**
 * Build the invoice for one order.
 *
 * Only paid orders have invoices: an unpaid order has no taxable supply, and
 * issuing a numbered tax invoice for one would be wrong.
 */
export async function invoiceFor(orderId: string, user: UserDoc): Promise<InvoiceView> {
  const o = await (await orders()).findOne({ _id: orderId });
  if (!o) throw new HttpError(404, 'Unknown order.');

  // Admins can pull any invoice for support; everyone else only their own.
  if (o.user_id !== user._id && !user.is_admin) {
    throw new HttpError(403, 'That invoice belongs to another account.');
  }
  if (o.status !== 'paid') {
    throw new HttpError(409, 'No invoice — this order was never paid.');
  }

  const s = seller();
  const inter = isInterState(s.state, o.buyer_state);

  return {
    seller: s,
    buyer: {
      name: o.user_email.split('@')[0],
      email: o.user_email,
      gstin: o.buyer_gstin ?? null,
      state: o.buyer_state ?? null,
    },
    invoice_no: o.invoice_no ?? '—',
    invoice_date: o.invoice_date ?? o.paid_at ?? o.created,
    order_id: o._id,
    payment_id: o.payment_id ?? null,
    description: o.label,
    credits: o.credits,
    currency: o.currency,
    tax: taxSplit(o.amount, s.gstRegistered ? GST_RATE : 0, inter),
    amount: o.amount,
  };
}