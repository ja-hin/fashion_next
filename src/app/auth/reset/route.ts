import { handler, json, formData, str, HttpError } from '@/lib/api';
import { consumeReset, clearResets } from '@/lib/password-reset';
import { setPassword, setSessionCookie } from '@/lib/auth';

export const runtime = 'nodejs';

/** Kept in step with the signup rule in auth.ts — a different floor here would
 *  reject a password the same user could have chosen at signup. */
const MIN_PASSWORD = 6;

/**
 * Complete a password reset.
 *
 * The token is consumed atomically before the password is touched, so a link
 * submitted twice — a double-click, or a replay — can only take effect once.
 */
export const POST = handler(async (req: Request) => {
  const fd = await formData(req);
  const token = str(fd, 'token').trim();
  const password = str(fd, 'password');
  const confirm = str(fd, 'confirm');

  if (password.length < MIN_PASSWORD) {
    throw new HttpError(400, `Choose a password of at least ${MIN_PASSWORD} characters.`);
  }
  if (confirm && password !== confirm) {
    throw new HttpError(400, 'The two passwords do not match.');
  }

  const doc = await consumeReset(token);
  if (!doc) {
    throw new HttpError(400, 'This reset link is invalid or has expired. Please request a new one.');
  }

  const ok = await setPassword(doc.user_id, password);
  if (!ok) throw new HttpError(400, 'That account no longer exists.');

  // setPassword already killed every session; drop any other outstanding links
  // for this user so a second email in the inbox is dead too.
  await clearResets(doc.user_id);

  // Sign them straight in — they've just proven control of the mailbox, and
  // bouncing to a login form after a reset is a pointless extra step.
  await setSessionCookie(doc.user_id);

  return json({ ok: true });
});