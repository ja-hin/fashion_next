import { handler, json, requireAdmin, formData, str, HttpError } from '@/lib/api';
import { leads } from '@/lib/mongo';
import { LEAD_STATUSES } from '@/lib/leads';
import type { LeadStatus } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Newest first, capped — the panel shows a working list, not an archive. */
const LIMIT = 200;

/** Every enquiry, for the admin panel. */
export const GET = handler(async () => {
  await requireAdmin();
  const col = await leads();
  return json({
    leads: await col.find({}).sort({ created: -1 }).limit(LIMIT).toArray(),
    // Counted rather than derived from the rows above, so the badge stays right
    // once there are more than LIMIT of them.
    open: await col.countDocuments({ status: 'new' }),
  });
});

/** Move a lead along its lifecycle. */
export const POST = handler(async (req: Request) => {
  await requireAdmin();
  const fd = await formData(req);

  const id = str(fd, 'id');
  const status = str(fd, 'status') as LeadStatus;
  if (!id) throw new HttpError(400, 'Which lead?');
  if (!LEAD_STATUSES.includes(status)) throw new HttpError(400, 'Unknown status');

  const res = await (await leads()).updateOne(
    { _id: id },
    // `handled` records when someone first picked it up. Cleared on a move back
    // to `new` so it never claims an enquiry was answered when it was reopened.
    status === 'new'
      ? { $set: { status }, $unset: { handled: '' } }
      : { $set: { status, handled: new Date().toISOString().replace(/\.\d+Z$/, 'Z') } },
  );
  if (!res.matchedCount) throw new HttpError(404, 'No such lead');

  return json({ ok: true });
});
