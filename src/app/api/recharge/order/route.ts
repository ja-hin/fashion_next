import { handler, json, requireUser, formData, str, HttpError } from '@/lib/api';
import { createOrder, assertPaymentsEnabled } from '@/lib/razorpay';
import { quote, CUSTOM_MIN_CREDITS, CUSTOM_MAX_CREDITS } from '@/lib/pricing';
import { RAZORPAY_KEY_ID, PAYMENT_BRAND } from '@/lib/config';

export const runtime = 'nodejs';

/**
 * Start a top-up. The browser sends a pack id OR a credit count — never an
 * amount. Pricing is re-derived here so the only prices anyone can pay are the
 * ones lib/pricing.ts sanctions.
 */
export const POST = handler(async (req: Request) => {
  const me = await requireUser();
  assertPaymentsEnabled();

  const fd = await formData(req);
  const packId = str(fd, 'pack').trim();
  const rawCredits = str(fd, 'credits').trim();

  if (!packId && !rawCredits) throw new HttpError(400, 'Choose a pack or enter an amount.');

  const q = quote({
    packId: packId || null,
    credits: rawCredits ? Number(rawCredits) : null,
  });

  if (!q) {
    throw new HttpError(
      400,
      packId
        ? 'That pack no longer exists. Refresh the page and try again.'
        : `Enter a whole number of credits between ${CUSTOM_MIN_CREDITS} and ${CUSTOM_MAX_CREDITS}.`,
    );
  }

  const order = await createOrder(me, q);

  // key_id is public by design — Razorpay Checkout needs it in the browser.
  return json({
    key_id: RAZORPAY_KEY_ID,
    order_id: order._id,
    amount: order.amount,
    currency: order.currency,
    credits: order.credits,
    label: order.label,
    brand: PAYMENT_BRAND,
    name: me.name,
    email: me.email,
  });
});