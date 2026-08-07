import { handler, json, requireUser, formData, str, HttpError } from '@/lib/api';
import { createOrder, assertPaymentsEnabled } from '@/lib/razorpay';
import { quote } from '@/lib/pricing';
import { getBilling } from '@/lib/settings';
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

  // Loaded fresh on every order: an admin may have changed a price or retired a
  // pack since this page was rendered, and the live config wins.
  const cfg = await getBilling();

  const q = quote(cfg, {
    packId: packId || null,
    credits: rawCredits ? Number(rawCredits) : null,
  });

  if (!q) {
    throw new HttpError(
      400,
      packId
        ? 'That pack is no longer available. Refresh the page and try again.'
        : cfg.custom_enabled
          ? `Enter a whole number of credits between ${cfg.custom_min_credits} and ${cfg.custom_max_credits}.`
          : 'Custom top-ups are currently unavailable. Please choose a pack.',
    );
  }

  const order = await createOrder(me, q, cfg.gst_rate);

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