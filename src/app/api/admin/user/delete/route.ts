import { handler, json, requireAdmin, formData, str, HttpError } from '@/lib/api';
import { deleteUser } from '@/lib/auth';

export const runtime = 'nodejs';

export const POST = handler(async (req: Request) => {
  const me = await requireAdmin();
  const fd = await formData(req);
  const userId = str(fd, 'user_id');

  if (userId === me._id) throw new HttpError(400, "You can't delete your own account.");

  // The user's shoots and images are deliberately left on disk — deleting an
  // account shouldn't silently destroy work that may still be referenced.
  await deleteUser(userId);
  return json({ ok: true });
});