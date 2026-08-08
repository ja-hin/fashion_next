import { handler, json, requireUser, formData, str, HttpError } from '@/lib/api';
import { checkPassword, setPassword, setSessionCookie } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Change your own password.
 *
 * `setPassword` destroys every session for the account — which is the point:
 * anyone else holding a cookie is signed out. A fresh cookie is then issued to
 * this browser, so the person who made the change stays where they were instead
 * of being bounced to the login screen for doing the right thing.
 */
export const POST = handler(async (req: Request) => {
  const me = await requireUser();
  const fd = await formData(req);

  const current = str(fd, 'current');
  const next = str(fd, 'password');

  if (!checkPassword(me, current)) {
    throw new HttpError(403, 'That is not your current password.');
  }
  if (next.length < 6) {
    throw new HttpError(400, 'Password must be at least 6 characters.');
  }
  if (next === current) {
    throw new HttpError(400, 'Choose a password different from your current one.');
  }

  await setPassword(me._id, next);
  await setSessionCookie(me._id);

  return json({ ok: true });
});