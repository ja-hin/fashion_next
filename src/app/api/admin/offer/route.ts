import { handler, json, requireAdmin, formData, str, HttpError } from '@/lib/api';
import { users } from '@/lib/mongo';
import { nowIso } from '@/lib/auth';

export const runtime = 'nodejs';

/**
 * Admin control over the complimentary-credits offer , see lib/offer.ts.
 *
 *   show , clear both flags, so the banner appears on this account's next page
 *          load whatever their balance is (the "never seen it" branch fires
 *          before the balance check). This is also the undo for a test
 *          submission, which otherwise silences the offer permanently.
 *
 *   hide , mark it submitted, which is the one state that silences it for good.
 *          For an account that has asked by phone or email instead, so the
 *          banner stops chasing someone already being talked to.
 *
 * Deliberately not a free-text date field. The two things an admin actually
 * wants are "let them see it" and "stop showing it", and a timestamp picker
 * would invite a third state nobody needs.
 */
export const POST = handler(async (req: Request) => {
  await requireAdmin();
  const fd = await formData(req);

  const userId = str(fd, 'user_id');
  if (!userId) throw new HttpError(400, 'Which user?');

  const show = str(fd, 'action') !== 'hide';
  const col = await users();

  const res = await col.updateOne(
    { _id: userId },
    show
      ? { $unset: { offer_seen: '', offer_submitted: '' } }
      : { $set: { offer_submitted: nowIso(), offer_seen: nowIso() } },
  );
  if (!res.matchedCount) throw new HttpError(404, 'No such user.');

  return json({ ok: true, offer: show ? 'pending' : 'done' });
});
