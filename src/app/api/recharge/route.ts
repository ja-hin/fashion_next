import { handler, json, requireUser, requireAdmin, formData, num, str, HttpError } from '@/lib/api';
import { adjustBalance, getBalance, userById } from '@/lib/auth';
import { PACKS, CUSTOM_MIN_CREDITS, CUSTOM_MAX_CREDITS, PAISE_PER_CREDIT } from '@/lib/pricing';
import { PAYMENTS_ENABLED } from '@/lib/config';

export const runtime = 'nodejs';

/** What the Recharge view needs to render — packs, limits and whether we can charge. */
export const GET = handler(async () => {
  const me = await requireUser();
  return json({
    payments_enabled: PAYMENTS_ENABLED,
    paise_per_credit: PAISE_PER_CREDIT,
    min_credits: CUSTOM_MIN_CREDITS,
    max_credits: CUSTOM_MAX_CREDITS,
    packs: PACKS,
    balance: await getBalance(me._id),
  });
});

/**
 * Grant credits directly, without payment.
 *
 * This used to be open to any signed-in user, which meant anyone could POST
 * themselves unlimited credits. It is now admin-only and exists purely for
 * comping an account or repairing a failed reconciliation — real top-ups go
 * through /api/recharge/order → Razorpay → /api/recharge/verify.
 */
export const POST = handler(async (req: Request) => {
  const admin = await requireAdmin();
  const fd = await formData(req);
  const images = num(fd, 'images');

  if (!Number.isInteger(images) || images === 0) {
    throw new HttpError(400, 'Enter a whole number of credits.');
  }

  // Defaults to the admin's own account, so the original call shape still works.
  const targetId = str(fd, 'user_id').trim() || admin._id;
  const target = await userById(targetId);
  if (!target) throw new HttpError(404, 'Unknown user.');

  const balance = await adjustBalance(target._id, images, false);
  if (balance === null) throw new HttpError(400, 'That would take the balance below zero.');

  console.log(
    `[credits] manual grant by ${admin.email}: ${images > 0 ? '+' : ''}${images} to ${target.email}`,
  );
  return json({ balance });
});