import { handler, json, requireUser, requireAdmin, formData, num, str, HttpError } from '@/lib/api';
import { adjustBalance, getBalance, userById } from '@/lib/auth';
import { activePacks } from '@/lib/pricing';
import { getBilling } from '@/lib/settings';
import { PAYMENTS_ENABLED } from '@/lib/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** What the Recharge view needs to render — packs, limits and whether we can charge. */
export const GET = handler(async () => {
  const me = await requireUser();
  const cfg = await getBilling();
  return json({
    payments_enabled: PAYMENTS_ENABLED,
    paise_per_credit: cfg.paise_per_credit,
    gst_rate: cfg.gst_rate,
    custom_enabled: cfg.custom_enabled,
    min_credits: cfg.custom_min_credits,
    max_credits: cfg.custom_max_credits,
    // Only what's on sale — an inactive pack must not be buyable.
    packs: activePacks(cfg),
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