import { handler, json, requireAdmin, formData, str, num, HttpError } from '@/lib/api';
import { setActive } from '@/lib/auth';

export const runtime = 'nodejs';

export const POST = handler(async (req: Request) => {
  const me = await requireAdmin();
  const fd = await formData(req);
  const userId = str(fd, 'user_id');
  const active = num(fd, 'active') !== 0;

  if (userId === me._id && !active) {
    throw new HttpError(400, "You can't pause your own account.");
  }

  await setActive(userId, active);
  return json({ ok: true });
});