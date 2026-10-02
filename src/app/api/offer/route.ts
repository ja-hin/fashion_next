import crypto from 'node:crypto';
import { handler, json, requireUser, formData, str, HttpError } from '@/lib/api';
import { users, leads } from '@/lib/mongo';
import { sendMail, mailConfigured } from '@/lib/mailer';
import { notifyEmail } from '@/lib/leads';
import { nowIso } from '@/lib/auth';
import type { LeadDoc } from '@/lib/types';

export const runtime = 'nodejs';

const LIMITS = { brand: 160, website: 300, volume: 60, use_case: 80, message: 4000 };
const clean = (v: unknown, max: number) =>
  String(v ?? '').replace(/[\r\n]+/g, ' ').trim().slice(0, max);

/**
 * The complimentary-credits offer: dismiss it, or send the enquiry.
 *
 * One route for both because they are two ends of the same decision, and both
 * do the same bookkeeping on the user , the difference is only whether we hear
 * back. `action=dismiss` quiets it for a week; a submission ends it for good.
 */
export const POST = handler(async (req: Request) => {
  const me = await requireUser();
  const fd = await formData(req);
  const col = await users();

  if (str(fd, 'action') === 'dismiss') {
    await col.updateOne({ _id: me._id }, { $set: { offer_seen: nowIso() } });
    return json({ ok: true });
  }

  const brand = clean(fd.get('brand'), LIMITS.brand);
  const website = clean(fd.get('website'), LIMITS.website);
  if (!brand) throw new HttpError(400, 'Tell us your brand or company name.');
  if (!website) throw new HttpError(400, 'Add your website or store link.');

  let channels: string[] = [];
  try {
    const raw = JSON.parse(str(fd, 'channels') || '[]') as unknown;
    if (Array.isArray(raw)) channels = raw.map((c) => clean(c, 40)).filter(Boolean).slice(0, 10);
  } catch {
    channels = [];
  }

  /*
   * The signed-in account IS the contact. Name, email and uid are taken from
   * the session rather than asked for again , re-typing details we already
   * hold is friction, and a typo there would send our reply nowhere.
   */
  const doc: LeadDoc = {
    _id: crypto.randomBytes(8).toString('hex'),
    name: me.name || me.email,
    email: me.email,
    phone: '',
    brand,
    volume: clean(fd.get('volume'), LIMITS.volume),
    message: clean(fd.get('message'), LIMITS.message),
    status: 'new',
    source: 'credit-offer',
    created: nowIso(),
    user_email: me.email,
    uid: me.uid,
    // Why they were asked , reading the lead without it loses the context.
    balance_at_ask: me.balance,
    website,
    channels,
    use_case: clean(fd.get('use_case'), LIMITS.use_case),
  };

  // Stored before the mail, and the mail failure swallowed: the record is the
  // thing that must not be lost. Same rule as the marketing contact form.
  await (await leads()).insertOne(doc);
  await col.updateOne(
    { _id: me._id },
    { $set: { offer_submitted: nowIso(), offer_seen: nowIso() } },
  );

  if (mailConfigured()) {
    const ok = await sendMail(notifyEmail(doc)).catch(() => false);
    if (!ok) console.error('[offer] admin notification failed; lead saved', doc._id);
  }

  return json({ ok: true });
});
