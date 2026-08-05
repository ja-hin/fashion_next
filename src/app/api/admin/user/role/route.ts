import { handler, json, requireAdmin, formData, str, num, HttpError } from '@/lib/api';
import { setAdmin } from '@/lib/auth';

export const runtime = 'nodejs';

export const POST = handler(async (req: Request) => {
  const me = await requireAdmin();
  const fd = await formData(req);
  const userId = str(fd, 'user_id');
  const isAdmin = num(fd, 'is_admin') !== 0;

  // Guard against an admin locking themselves out of the admin panel.
  if (userId === me._id && !isAdmin) {
    throw new HttpError(400, "You can't remove your own admin access.");
  }

  await setAdmin(userId, isAdmin);
  return json({ ok: true });
});