import { handler, json, formData, str, HttpError } from '@/lib/api';
import { signup, setSessionCookie } from '@/lib/auth';

export const runtime = 'nodejs';

export const POST = handler(async (req: Request) => {
  const fd = await formData(req);
  const [uid, err] = await signup(str(fd, 'email'), str(fd, 'name'), str(fd, 'password'));
  if (err || !uid) throw new HttpError(400, err ?? 'Could not create the account.');
  await setSessionCookie(uid);
  return json({ ok: true });
});