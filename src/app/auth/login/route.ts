import { handler, json, formData, str, HttpError } from '@/lib/api';
import { login, setSessionCookie } from '@/lib/auth';

export const runtime = 'nodejs';

export const POST = handler(async (req: Request) => {
  const fd = await formData(req);
  const u = await login(str(fd, 'email'), str(fd, 'password'));
  if (!u) throw new HttpError(401, 'Wrong email or password.');
  if (u.active === false) {
    throw new HttpError(403, 'Your account is paused. Please contact an admin.');
  }
  await setSessionCookie(u._id);
  return json({ ok: true, admin: u.is_admin });
});