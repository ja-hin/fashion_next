/**
 * Password-reset tokens.
 *
 * The token is a 32-byte random value sent only in the email. What we store is
 * its SHA-256 — so a dump of this collection cannot be turned into working
 * reset links. Verification hashes the presented token and looks that up.
 *
 * A plain hash (not pbkdf2) is right here where it would be wrong for a
 * password: the input is 256 bits of entropy, so there is nothing to brute
 * force, and the lookup has to stay a single indexed read.
 */
import 'server-only';
import crypto from 'node:crypto';
import { passwordResets, users } from './mongo';
import { RESET_TTL_MINUTES, APP_URL } from './config';
import type { ResetDoc, UserDoc } from './types';

/** How many requests one address may make inside the window below. */
const MAX_PER_WINDOW = 3;
const WINDOW_MINUTES = 15;

const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

export const resetUrl = (token: string) => `${APP_URL}/reset/${token}`;

export interface IssuedReset {
  token: string;
  minutes: number;
}

/**
 * Issue a reset token for an email, or null.
 *
 * Null covers "no such account" AND "asked too often" deliberately — the route
 * responds identically either way, so this can never be used to discover which
 * addresses are registered.
 */
export async function issueReset(
  emailRaw: string,
  ip?: string,
): Promise<{ user: UserDoc; issued: IssuedReset } | null> {
  const email = (emailRaw ?? '').toLowerCase().trim();
  if (!email) return null;

  const user = await (await users()).findOne({ email });
  if (!user) return null;
  // A paused account shouldn't be able to regain access via reset.
  if (user.active === false) return null;

  const col = await passwordResets();

  // Rate limit per account: stops someone using the form to flood a mailbox.
  const since = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();
  const recent = await col.countDocuments({ user_id: user._id, created: { $gte: since } });
  if (recent >= MAX_PER_WINDOW) {
    console.warn(`[reset] rate limited for user ${user.uid ?? user._id}`);
    return null;
  }

  // Any earlier outstanding link is void once a new one is requested.
  await col.deleteMany({ user_id: user._id });

  const token = crypto.randomBytes(32).toString('hex');
  const doc: ResetDoc = {
    _id: sha256(token),
    user_id: user._id,
    email: user.email,
    created: new Date().toISOString(),
    expires: new Date(Date.now() + RESET_TTL_MINUTES * 60_000),
    requested_ip: ip,
  };
  await col.insertOne(doc);

  return { user, issued: { token, minutes: RESET_TTL_MINUTES } };
}

/** Look up a token without spending it — used to validate the reset page on load. */
export async function peekReset(token: string): Promise<ResetDoc | null> {
  if (!token) return null;
  const doc = await (await passwordResets()).findOne({ _id: sha256(token) });
  if (!doc) return null;
  if (doc.used_at) return null;
  // TTL deletion is background work in Mongo and can lag by up to a minute, so
  // expiry is re-checked here rather than trusted to the index alone.
  if (doc.expires.getTime() <= Date.now()) return null;
  return doc;
}

/**
 * Spend a token, atomically.
 *
 * The `used_at: { $exists: false }` filter is what makes it single-use: two
 * simultaneous submissions of the same link race on one document and exactly
 * one wins. Returns null if the token is unknown, already spent or expired.
 */
export async function consumeReset(token: string): Promise<ResetDoc | null> {
  if (!token) return null;
  const col = await passwordResets();

  const won = await col.findOneAndUpdate(
    {
      _id: sha256(token),
      used_at: { $exists: false },
      expires: { $gt: new Date() },
    },
    { $set: { used_at: new Date().toISOString() } },
    { returnDocument: 'after' },
  );
  return won ?? null;
}

/** Drop every outstanding link for a user — called once the password changes. */
export async function clearResets(userId: string): Promise<void> {
  await (await passwordResets()).deleteMany({ user_id: userId });
}