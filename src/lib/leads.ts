/**
 * Contact-form enquiries.
 *
 * Validation lives here rather than in the route so the rules are stated once:
 * the route decides *who* may call, this decides *what* is a usable enquiry.
 *
 * The bar is deliberately low. A contact form's job is to not lose the message,
 * so anything with a name, a reachable address and something to say is kept ,
 * a lead rejected for a malformed phone number is a customer turned away at the
 * door. What is refused is only what would be unusable or abusive: no address
 * to reply to, or a body long enough to be an attack rather than a question.
 */
import 'server-only';
import crypto from 'node:crypto';
import { leads } from './mongo';
import { sendMail, mailConfigured, type Mail } from './mailer';
import { ADMIN_EMAIL, APP_URL } from './config';
import type { LeadDoc, LeadStatus } from './types';

/** Offered in the form's dropdown; anything else is stored as ''. */
export const LEAD_VOLUMES = [
  'Under 50 products / month',
  '50 – 200 products / month',
  '200 – 1,000 products / month',
  '1,000+ products / month',
  'Just exploring',
] as const;

export const LEAD_STATUSES: LeadStatus[] = ['new', 'contacted', 'closed'];

/** Long enough for a real enquiry, short enough not to be a payload. */
const LIMITS = { name: 120, email: 200, phone: 40, brand: 160, message: 4000 };

export class LeadError extends Error {}

/* Control characters stripped, not rejected: they are almost always a paste
   artefact, and refusing the message over one invisible byte would lose it. */
const CONTROL = /[\x00-\x1f\x7f]/g;

const clean = (v: unknown, max: number): string =>
  String(v ?? '')
    .replace(CONTROL, ' ')
    .trim()
    .slice(0, max);

/* The message keeps its line breaks , it is the one field where they mean
   something , so only the rest of the control range goes. */
const cleanBody = (v: unknown, max: number): string =>
  String(v ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\x00-\x09\x0b-\x1f\x7f]/g, ' ')
    .trim()
    .slice(0, max);

/**
 * Shape check only , deliverability is not knowable here, and a regex strict
 * enough to try would reject valid addresses. `a@b.c` with no spaces is the
 * most that can honestly be asserted.
 */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export interface LeadInput {
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  brand?: unknown;
  volume?: unknown;
  message?: unknown;
  source?: unknown;
}

/** Validate and normalise, or throw a message that is safe to show the visitor. */
export function parseLead(input: LeadInput): Omit<LeadDoc, '_id' | 'status' | 'created'> {
  const name = clean(input.name, LIMITS.name);
  const email = clean(input.email, LIMITS.email).toLowerCase();
  const message = cleanBody(input.message, LIMITS.message);

  if (name.length < 2) throw new LeadError('Please tell us your name');
  if (!EMAIL.test(email)) throw new LeadError('That email address does not look right');
  if (message.length < 5) throw new LeadError('Please tell us what you need');

  const volume = clean(input.volume, 60);
  return {
    name,
    email,
    message,
    phone: clean(input.phone, LIMITS.phone),
    brand: clean(input.brand, LIMITS.brand),
    // Anything not on the list is dropped rather than stored: the field is a
    // dropdown, so a value that was never offered came from somewhere else.
    volume: (LEAD_VOLUMES as readonly string[]).includes(volume) ? volume : '',
    source: clean(input.source, 40) || 'landing',
  };
}

/**
 * Store the enquiry, then send both emails.
 *
 * Storing first, and the mail failures swallowed: the record is the thing that
 * must not be lost. A visitor told "something went wrong" because SMTP was down
 * would send it again, or not at all , and the first copy is already safe.
 *
 * Two messages, sent together rather than one after the other so a slow
 * provider costs one wait instead of two:
 *   - the admin gets the enquiry, with Reply-To set to the visitor;
 *   - the visitor gets an acknowledgement, with Reply-To set to the admin.
 * Each is settled independently, so the acknowledgement still goes out if the
 * notification bounces and the other way round.
 */
export async function createLead(input: LeadInput): Promise<LeadDoc> {
  const doc: LeadDoc = {
    _id: crypto.randomBytes(8).toString('hex'),
    ...parseLead(input),
    status: 'new',
    created: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
  };

  await (await leads()).insertOne(doc);

  if (mailConfigured()) {
    const [notified, acked] = await Promise.allSettled([
      sendMail(notifyEmail(doc)),
      sendMail(ackEmail(doc)),
    ]);
    // sendMail resolves false rather than throwing, so both arms are checked.
    const ok = (r: PromiseSettledResult<boolean>) => r.status === 'fulfilled' && r.value;
    if (!ok(notified)) console.error('[leads] admin notification failed; lead saved', doc._id);
    if (!ok(acked)) console.error('[leads] acknowledgement to visitor failed; lead saved', doc._id);
  }
  return doc;
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** What lands in the admin inbox. */
export function notifyEmail(l: LeadDoc): Mail {
  const rows: Array<[string, string]> = [
    ['Name', l.name],
    ['Email', l.email],
    ['Phone', l.phone || ','],
    ['Brand', l.brand || ','],
    ['Volume', l.volume || ','],
  ];

  const text =
    'New enquiry from the website\n\n' +
    rows.map(([k, v]) => `${k}: ${v}`).join('\n') +
    `\n\nMessage:\n${l.message}\n\n` +
    `Received ${l.created}\n${APP_URL}/admin\n`;

  const html =
    '<h2 style="font:600 18px system-ui;margin:0 0 14px">New enquiry from the website</h2>' +
    '<table style="font:14px system-ui;border-collapse:collapse">' +
    rows
      .map(
        ([k, v]) =>
          `<tr><td style="padding:3px 14px 3px 0;color:#666">${k}</td>` +
          `<td style="padding:3px 0"><b>${esc(v)}</b></td></tr>`,
      )
      .join('') +
    '</table>' +
    `<p style="font:14px/1.6 system-ui;white-space:pre-wrap;margin:16px 0 0">${esc(l.message)}</p>` +
    '<p style="font:12px system-ui;color:#888;margin-top:18px">' +
    `Received ${l.created} · <a href="${APP_URL}/admin">Open the admin panel</a></p>`;

  return {
    to: ADMIN_EMAIL,
    // Hitting Reply in the inbox writes to the person who asked, which is the
    // only thing anyone wants to do with this message.
    replyTo: l.email,
    subject: `Enquiry , ${l.name}${l.brand ? ` (${l.brand})` : ''}`,
    text,
    html,
  };
}

/**
 * The acknowledgement the visitor gets.
 *
 * Their own message is quoted back for one reason: it is the only proof they
 * have that the form worked and that we hold what they actually wrote. Beyond
 * that it says when to expect a person and what to do if nothing arrives ,
 * nothing else, because there is nothing else they asked for.
 */
export function ackEmail(l: LeadDoc): Mail {
  const first = l.name.split(/\s+/)[0];

  const text =
    `Hi ${first},\n\n` +
    `Thanks for getting in touch with Faishon Studio , your enquiry is with us.\n\n` +
    `A person will reply within one working day. If you would rather not wait, ` +
    `you can start a shoot right now with free trial credits: ${APP_URL}/register\n\n` +
    `Here is what you sent us:\n\n${l.message}\n\n` +
    `, The Faishon Studio team\n` +
    `3rd i Visuals Pvt. Ltd.\n\n` +
    `You are receiving this because this address was used on the contact form at ` +
    `${APP_URL}. If that was not you, ignore this email , nothing has been created.\n`;

  const html =
    '<div style="font:15px/1.65 system-ui,-apple-system,sans-serif;color:#17150F;max-width:520px">' +
    `<p style="margin:0 0 14px">Hi ${esc(first)},</p>` +
    '<p style="margin:0 0 14px">Thanks for getting in touch with <b>Faishon Studio</b> , ' +
    'your enquiry is with us.</p>' +
    '<p style="margin:0 0 18px">A person will reply within one working day. If you would ' +
    'rather not wait, you can start a shoot right now with free trial credits:</p>' +
    `<p style="margin:0 0 22px"><a href="${APP_URL}/register" ` +
    'style="display:inline-block;background:#E4572E;color:#fff;text-decoration:none;' +
    'padding:11px 20px;border-radius:6px;font-weight:600">Start with free trial</a></p>' +
    '<p style="margin:0 0 8px;color:#5B5344;font-size:13px">What you sent us</p>' +
    '<blockquote style="margin:0 0 22px;padding:12px 16px;border-left:3px solid #E4572E;' +
    'background:#F5F2EB;white-space:pre-wrap;font-size:14px">' +
    `${esc(l.message)}</blockquote>` +
    '<p style="margin:0 0 4px">, The Faishon Studio team</p>' +
    '<p style="margin:0;color:#8A8172;font-size:13px">3rd i Visuals Pvt. Ltd.</p>' +
    '<p style="margin:22px 0 0;color:#8A8172;font-size:12px;line-height:1.5">' +
    'You are receiving this because this address was used on the contact form at ' +
    `<a href="${APP_URL}" style="color:#8A8172">${esc(APP_URL)}</a>. ` +
    'If that was not you, ignore this email , nothing has been created.</p>' +
    '</div>';

  return {
    to: l.email,
    // A reply to a thank-you should reach a human, not a no-reply mailbox.
    replyTo: ADMIN_EMAIL,
    subject: 'Thanks , we have your enquiry',
    text,
    html,
  };
}
