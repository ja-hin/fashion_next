import { handler, json, formData, str } from '@/lib/api';
import { issueReset, resetUrl } from '@/lib/password-reset';
import { sendMail, resetEmail, mailConfigured } from '@/lib/mailer';

export const runtime = 'nodejs';

/**
 * Request a password-reset link.
 *
 * ALWAYS returns the same success response — whether the address is
 * registered, paused, rate-limited, or the mail send failed. Anything else
 * turns this endpoint into a way to enumerate which emails have accounts.
 * Failures are recorded server-side instead.
 */
export const POST = handler(async (req: Request) => {
  const fd = await formData(req);
  const email = str(fd, 'email').trim();

  // Best-effort client IP for the audit trail; proxies may not set it.
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    undefined;

  const result = await issueReset(email, ip);

  if (result) {
    const link = resetUrl(result.issued.token);
    const ok = await sendMail(
      resetEmail({
        to: result.user.email,
        name: result.user.name ?? '',
        link,
        minutes: result.issued.minutes,
      }),
    );
    if (!ok) console.error(`[reset] could not deliver link for user ${result.user.uid ?? '-'}`);
  }

  return json({
    ok: true,
    // Surfaced so an admin testing on a fresh install understands why no mail
    // arrived. Reveals nothing about any particular address.
    mail_configured: mailConfigured(),
  });
});