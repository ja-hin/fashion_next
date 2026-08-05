import { handler, json, requireUser, formData, str, HttpError } from '@/lib/api';
import { verifyCheckoutSignature, creditOrder } from '@/lib/razorpay';
import { getBalance } from '@/lib/auth';
import { orders } from '@/lib/mongo';

export const runtime = 'nodejs';

/**
 * Confirm a payment from the Checkout callback.
 *
 * This is the fast path that lets the balance update while the user is still
 * looking at the page. It is NOT the authoritative one — the webhook is, since
 * a user who pays and closes the tab never gets here. Both call creditOrder(),
 * which grants credits at most once.
 */
export const POST = handler(async (req: Request) => {
  const me = await requireUser();
  const fd = await formData(req);

  const orderId = str(fd, 'razorpay_order_id').trim();
  const paymentId = str(fd, 'razorpay_payment_id').trim();
  const signature = str(fd, 'razorpay_signature').trim();

  if (!orderId || !paymentId || !signature) {
    throw new HttpError(400, 'Incomplete payment confirmation.');
  }

  if (!verifyCheckoutSignature({ orderId, paymentId, signature })) {
    // Either a forged callback or a genuine mismatch. Do not touch the order —
    // if the payment was real, the webhook will still credit it correctly.
    console.error(`[razorpay] bad checkout signature order=${orderId} user=${me._id}`);
    throw new HttpError(400, 'Payment could not be verified. If you were charged, contact support.');
  }

  // Signature proves the payment, but not who is asking. Confirm the order
  // belongs to the caller so one user can't confirm — or read — another's.
  const existing = await (await orders()).findOne({ _id: orderId });
  if (!existing) throw new HttpError(404, 'Unknown order.');
  if (existing.user_id !== me._id) throw new HttpError(403, 'That order belongs to another account.');

  const result = await creditOrder(orderId, paymentId, 'checkout');
  const balance = result.balance ?? (await getBalance(me._id));

  return json({
    balance,
    credits: existing.credits,
    // False when the webhook got there first — the payment still succeeded.
    credited: result.credited,
  });
});