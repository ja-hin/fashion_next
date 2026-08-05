import { handler, json, requireAdmin, formData, str, num, HttpError } from '@/lib/api';
import { adjustBalance } from '@/lib/auth';

export const runtime = 'nodejs';

export const POST = handler(async (req: Request) => {
  await requireAdmin();
  const fd = await formData(req);
  const userId = str(fd, 'user_id');
  const images = num(fd, 'images');

  const balance = await adjustBalance(userId, images);
  if (balance === null) throw new HttpError(404, 'User not found');
  return json({ balance, user_id: userId });
});