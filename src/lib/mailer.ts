/**
 * Outbound email.
 *
 * Three drivers so the app isn't married to one provider:
 *   smtp     — anything with a mailbox (Hostinger, Google Workspace, Zoho…)
 *   resend   — plain HTTPS, no extra dependency
 *   console  — prints the message; the default outside production so the
 *              password-reset flow can be exercised with no mail account
 *
 * Sending never throws to the caller. A failed reset email must not tell an
 * attacker that an address exists, and must not 500 a user-facing form.
 */
import 'server-only';
import {
  MAIL_DRIVER,
  MAIL_FROM,
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  SMTP_SECURE,
  RESEND_API_KEY,
} from './config';

export interface Mail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/** True when the configured driver actually has credentials to send with. */
export function mailConfigured(): boolean {
  if (MAIL_DRIVER === 'console') return true;
  if (MAIL_DRIVER === 'resend') return Boolean(RESEND_API_KEY);
  return Boolean(SMTP_HOST);
}

async function sendSmtp(m: Mail): Promise<void> {
  // Imported lazily so a deployment using Resend or console never loads it.
  const nodemailer = (await import('nodemailer')).default;
  const transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
  });
  await transport.sendMail({ from: MAIL_FROM, ...m });
}

async function sendResend(m: Mail): Promise<void> {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: MAIL_FROM,
      to: [m.to],
      subject: m.subject,
      html: m.html,
      text: m.text,
    }),
  });
  if (!r.ok) {
    throw new Error(`Resend returned ${r.status}: ${await r.text().catch(() => '')}`);
  }
}

/**
 * Send one message. Returns false when delivery failed — callers use that only
 * for logging, never to shape the response a visitor sees.
 */
export async function sendMail(m: Mail): Promise<boolean> {
  try {
    if (MAIL_DRIVER === 'resend') {
      await sendResend(m);
    } else if (MAIL_DRIVER === 'smtp') {
      await sendSmtp(m);
    } else {
      // Console driver. The body carries a single-use link, so this is a
      // development affordance — MAIL_DRIVER defaults to smtp in production.
      console.log(
        `\n─── EMAIL (console driver) ${'─'.repeat(42)}\n` +
          `to      ${m.to}\nsubject ${m.subject}\n\n${m.text}\n` +
          '─'.repeat(68) +
          '\n',
      );
    }
    return true;
  } catch (e) {
    // Address deliberately omitted at error level to keep mailbox addresses
    // out of aggregated logs.
    console.error('[mail] send failed', e);
    return false;
  }
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The password-reset message. `link` is single-use and time-limited. */
export function resetEmail(opts: {
  to: string;
  name: string;
  link: string;
  minutes: number;
}): Mail {
  const who = opts.name?.trim() ? `Hi ${opts.name.trim()},` : 'Hi,';
  const text =
    `${who}\n\n` +
    `We received a request to reset the password for your AImageGen account.\n\n` +
    `Reset your password:\n${opts.link}\n\n` +
    `This link works once and expires in ${opts.minutes} minutes.\n\n` +
    `If you didn't ask for this, you can ignore this email — your password stays as it is.\n`;

  const html = `
<div style="font:15px/1.6 system-ui,-apple-system,Segoe UI,sans-serif;color:#141414;max-width:520px;margin:0 auto;padding:28px">
  <p style="margin:0 0 18px">${esc(who)}</p>
  <p style="margin:0 0 18px">We received a request to reset the password for your AImageGen account.</p>
  <p style="margin:0 0 26px">
    <a href="${esc(opts.link)}"
       style="display:inline-block;background:#e11d2a;color:#fff;text-decoration:none;font-weight:700;padding:13px 24px;border-radius:10px">
      Reset my password
    </a>
  </p>
  <p style="margin:0 0 8px;color:#666;font-size:13px">
    This link works once and expires in ${opts.minutes} minutes.
  </p>
  <p style="margin:0 0 22px;color:#666;font-size:13px">
    If you didn't ask for this, you can ignore this email — your password stays as it is.
  </p>
  <p style="margin:0;color:#999;font-size:12px;word-break:break-all">
    Button not working? Paste this into your browser:<br>${esc(opts.link)}
  </p>
</div>`.trim();

  return { to: opts.to, subject: 'Reset your AImageGen password', html, text };
}