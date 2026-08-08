/**
 * Accounts, sessions and the per-user credit wallet.
 *
 * The password hash is deliberately the SAME scheme as the old Python app —
 * pbkdf2-hmac-sha256, 200,000 rounds, hex salt, hex digest — so every existing
 * account survives the migration and nobody has to reset their password.
 */
import 'server-only';
import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { users, sessions } from './mongo';
import { DEFAULT_BALANCE_IMAGES } from './config';
import type { UserDoc, PublicUser } from './types';
import type { Profile } from './profile';

const ITERATIONS = 200_000;
const KEYLEN = 32; // sha256 digest size — matches hashlib.pbkdf2_hmac default
const DIGEST = 'sha256';

export const SESSION_COOKIE = 'vd_session';
const SESSION_MAX_AGE = 604_800; // 7 days, same as the old max_age

export const nowIso = () => new Date().toISOString().replace(/\.\d+Z$/, '');

function hashPassword(password: string, saltHex: string): string {
  return crypto
    .pbkdf2Sync(password ?? '', Buffer.from(saltHex, 'hex'), ITERATIONS, KEYLEN, DIGEST)
    .toString('hex');
}

/** Constant-time compare that can't throw on a length mismatch. */
function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

export function toPublicUser(u: UserDoc): PublicUser {
  return {
    id: u._id,
    // Blank rather than a fake id when a legacy row hasn't been backfilled yet,
    // so the UI shows "—" instead of inventing a number that means nothing.
    uid: u.uid ?? '',
    email: u.email,
    name: u.name ?? '',
    is_admin: !!u.is_admin,
    balance: Number(u.balance ?? 0),
    created: u.created ?? '',
    active: u.active !== false,
  };
}

// ── accounts ────────────────────────────────────────────────────────

export async function createUser(opts: {
  email: string;
  name: string;
  password: string;
  isAdmin?: boolean;
  balance?: number;
}): Promise<string> {
  const col = await users();
  const id = crypto.randomBytes(8).toString('hex');
  const salt = crypto.randomBytes(16).toString('hex');
  const { nextUserNo } = await import('./settings');
  await col.insertOne({
    _id: id,
    uid: await nextUserNo(),
    email: opts.email.toLowerCase().trim(),
    name: (opts.name ?? '').trim(),
    pw_hash: hashPassword(opts.password, salt),
    pw_salt: salt,
    is_admin: !!opts.isAdmin,
    balance: opts.balance ?? 0,
    created: nowIso(),
    active: true,
  });
  return id;
}

/** Returns `[userId, null]` on success or `[null, errorMessage]`. */
export async function signup(
  emailRaw: string,
  name: string,
  password: string,
): Promise<[string | null, string | null]> {
  const email = (emailRaw ?? '').toLowerCase().trim();
  if (!email || !email.includes('@') || !email.split('@').pop()!.includes('.')) {
    return [null, 'Enter a valid email address.'];
  }
  if (!password || password.length < 6) {
    return [null, 'Password must be at least 6 characters.'];
  }

  const col = await users();
  if (await col.findOne({ email })) {
    return [null, 'An account with this email already exists.'];
  }

  try {
    const id = await createUser({
      email,
      name: name || email.split('@')[0],
      password,
      isAdmin: false,
      balance: DEFAULT_BALANCE_IMAGES,
    });
    return [id, null];
  } catch (e: unknown) {
    // The unique index on `email` is the real race-condition guard — two
    // simultaneous signups for the same address land here on the loser.
    if (e && typeof e === 'object' && (e as { code?: number }).code === 11000) {
      return [null, 'An account with this email already exists.'];
    }
    throw e;
  }
}

export async function login(
  emailRaw: string,
  password: string,
): Promise<UserDoc | null> {
  const email = (emailRaw ?? '').toLowerCase().trim();
  const col = await users();
  const u = await col.findOne({ email });
  if (!u) return null;
  if (!safeEqual(hashPassword(password, u.pw_salt), u.pw_hash)) return null;
  return u;
}

/**
 * Replace a user's password.
 *
 * A fresh salt is generated rather than reused, and every existing session is
 * destroyed: after a reset, anyone still holding a stolen session cookie —
 * including whoever prompted the reset — is logged out. Returns false when the
 * user is unknown.
 */
export async function setPassword(userId: string, newPassword: string): Promise<boolean> {
  const salt = crypto.randomBytes(16).toString('hex');
  const res = await (await users()).updateOne(
    { _id: userId },
    { $set: { pw_hash: hashPassword(newPassword, salt), pw_salt: salt } },
  );
  if (!res.matchedCount) return false;

  await destroyAllSessions(userId);
  return true;
}

/**
 * Verify a password against an account without logging anyone in.
 *
 * Used to re-authenticate for a sensitive self-service change (email address,
 * new password) — `login()` would work, but this reads as what it is and takes
 * the user we already have rather than looking them up again.
 */
export function checkPassword(u: UserDoc, password: string): boolean {
  return safeEqual(hashPassword(password, u.pw_salt), u.pw_hash);
}

/** Save the self-editable profile fields. Never touches balance, role or auth. */
export async function updateProfile(
  userId: string,
  patch: Profile,
): Promise<void> {
  await (await users()).updateOne(
    { _id: userId },
    {
      $set: {
        name: patch.name,
        phone: patch.phone,
        company: patch.company,
        gstin: patch.gstin,
        address: patch.address,
        city: patch.city,
        state: patch.state,
        pincode: patch.pincode,
      },
    },
  );
}

/**
 * Change the address an account signs in with.
 *
 * Returns false when the address already belongs to someone else. The unique
 * index on `email` is still the real guard — this check only turns the race
 * loser's duplicate-key error into a sentence the user can act on.
 */
export async function changeEmail(userId: string, emailRaw: string): Promise<boolean> {
  const email = (emailRaw ?? '').toLowerCase().trim();
  const col = await users();
  if (await col.findOne({ email, _id: { $ne: userId } })) return false;

  try {
    await col.updateOne({ _id: userId }, { $set: { email } });
    return true;
  } catch (e: unknown) {
    if (e && typeof e === 'object' && (e as { code?: number }).code === 11000) return false;
    throw e;
  }
}

export async function userById(id: string | null | undefined): Promise<UserDoc | null> {
  if (!id) return null;
  return (await users()).findOne({ _id: id });
}

// ── sessions ────────────────────────────────────────────────────────

export async function createSession(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString('base64url');
  const col = await sessions();
  await col.insertOne({
    _id: token,
    user_id: userId,
    created: nowIso(),
    expires: new Date(Date.now() + SESSION_MAX_AGE * 1000),
  });
  return token;
}

export async function destroySession(token: string | undefined): Promise<void> {
  if (!token) return;
  await (await sessions()).deleteOne({ _id: token });
}

export async function destroyAllSessions(userId: string): Promise<void> {
  await (await sessions()).deleteMany({ user_id: userId });
}

/** Resolve a session token to its user. Paused (inactive) accounts resolve to null. */
export async function userByToken(token: string | undefined): Promise<UserDoc | null> {
  if (!token) return null;
  const s = await (await sessions()).findOne({ _id: token });
  if (!s) return null;
  const u = await userById(s.user_id);
  if (!u || u.active === false) return null;
  return u;
}

/** The signed-in user for the current request, or null. */
export async function currentUser(): Promise<UserDoc | null> {
  const jar = await cookies();
  return userByToken(jar.get(SESSION_COOKIE)?.value);
}

export async function setSessionCookie(userId: string): Promise<void> {
  const token = await createSession(userId);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    maxAge: SESSION_MAX_AGE,
    sameSite: 'lax',
    path: '/',
    // Secure is on in production so the cookie never rides over plain HTTP.
    secure: process.env.NODE_ENV === 'production',
  });
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

// ── balance ─────────────────────────────────────────────────────────

export async function getBalance(userId: string | null | undefined): Promise<number> {
  const u = await userById(userId);
  return u ? Number(u.balance ?? 0) : 0;
}

/**
 * Atomically add `delta` (may be negative) to a user's balance.
 *
 * With `allowNegative: false` the update is refused when it would take the
 * balance below zero — the filter does that check inside the same atomic
 * findOneAndUpdate, so two concurrent charges can't both pass a stale read.
 *
 * Returns the new balance, or null if the user is unknown / the charge was refused.
 */
export async function adjustBalance(
  userId: string,
  delta: number,
  allowNegative = true,
): Promise<number | null> {
  const col = await users();
  const filter = allowNegative
    ? { _id: userId }
    : { _id: userId, balance: { $gte: -delta } };

  const res = await col.findOneAndUpdate(
    filter,
    { $inc: { balance: delta } },
    { returnDocument: 'after' },
  );
  return res ? Number(res.balance ?? 0) : null;
}

// ── admin ───────────────────────────────────────────────────────────

export async function listUsers(): Promise<PublicUser[]> {
  const rows = await (await users())
    .find({}, { projection: { pw_hash: 0, pw_salt: 0 } })
    .sort({ is_admin: -1, created: 1 })
    .toArray();
  return rows.map((r) => toPublicUser(r as UserDoc));
}

export async function setAdmin(userId: string, isAdmin: boolean): Promise<void> {
  await (await users()).updateOne({ _id: userId }, { $set: { is_admin: isAdmin } });
}

/** Pause (false) or resume (true) an account. Pausing kills its live sessions. */
export async function setActive(userId: string, active: boolean): Promise<void> {
  await (await users()).updateOne({ _id: userId }, { $set: { active } });
  if (!active) await destroyAllSessions(userId);
}

export async function deleteUser(userId: string): Promise<void> {
  await destroyAllSessions(userId);
  await (await users()).deleteOne({ _id: userId });
}

export async function adminCount(): Promise<number> {
  return (await users()).countDocuments({ is_admin: true, active: true });
}