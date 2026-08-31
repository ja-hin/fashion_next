/**
 * Contact-form enquiries.
 *
 * Validation lives here rather than in the route so the rules are stated once:
 * the route decides *who* may call, this decides *what* is a usable enquiry.
 *
 * The bar is deliberately low. A contact form's job is to not lose the message,
 * so anything with a name, a reachable address and something to say is kept —
 * a lead rejected for a malformed phone number is a customer turned away at the
 * door. What is refused is only what would be unusable or abusive: no address
 * to reply to, or a body long enough to be an attack rather than a question.
 */
import 'server-only';
import crypto from 'node:crypto';
import { leads } from './mongo';
import { sendMail, mailConfigured } from './mailer';
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

/* The message keeps its line breaks — it is the one field where they mean
   something — so only the rest of the control range goes. */
const cleanBody = (v: unknown, max: number): string =>
  String(v ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\x00-\x09\x0b-\x1f\x7f]/g, ' ')
    .trim()
    .slice(0, max);

/**
 * Shape check only — deliverability is not knowable here, and a regex strict
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
 * Store the enquiry, then try to notify.
 *
 * In that order, and the mail failure is swallowed: the record is the thing
 * that must not be lost. A visitor told "something went wrong" because SMTP was
 * down would send it again, or not at all — and the first copy is already safe.
 */
export async function createLead(input: LeadInput): Promise<LeadDoc> {
  const doc: LeadDoc = {
    _id: crypto.randomBytes(8).toString('hex'),
    ...parseLead(input),
    status: 'new',
    created: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
  };

  await (await leads()).insertOne(doc);

  try {
    if (mailConfigured()) await sendMail(notifyEmail(doc));
  } catch (e) {
    console.error('[leads] notification failed; the lead itself is saved', doc._id, e);
  }
  return doc;
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** What lands in the admin inbox. */
export function notifyEmail(l: LeadDoc) {
  const rows: Array<[string, string]> = [
    ['Name', l.name],
    ['Email', l.email],
    ['Phone', l.phone || '—'],
    ['Brand', l.brand || '—'],
    ['Volume', l.volume || '—'],
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
    subject: `Enquiry — ${l.name}${l.brand ? ` (${l.brand})` : ''}`,
    text,
    html,
  };
}
