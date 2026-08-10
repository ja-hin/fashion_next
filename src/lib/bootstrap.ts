/**
 * One-time startup work: create indexes and seed the first admin account.
 *
 * Runs lazily on the first request that needs the database (rather than at
 * import time) so a build or a typecheck never tries to reach MongoDB. The
 * promise is memoised, so concurrent first requests all await the same run.
 */
import 'server-only';
import { ensureIndexes, users, orders } from './mongo';
import { createUser } from './auth';
import { getSettings, nextUserNo } from './settings';
import { ADMIN_EMAIL, ADMIN_PASSWORD, DEFAULT_BALANCE_IMAGES } from './config';

declare global {
  // eslint-disable-next-line no-var
  var _aimagegenBootstrap: Promise<void> | undefined;
}

/**
 * Give every pre-existing account a public user id.
 *
 * Oldest first, so the numbering follows signup order rather than whatever
 * order Mongo happens to return. A no-op once everyone has one, so the cost on
 * a normal boot is a single indexed count.
 */
async function backfillUserIds(): Promise<void> {
  const col = await users();
  const pending = await col
    .find({ $or: [{ uid: { $exists: false } }, { uid: '' }] })
    .sort({ created: 1 })
    .toArray();
  if (!pending.length) return;

  for (const u of pending) {
    await col.updateOne({ _id: u._id }, { $set: { uid: await nextUserNo() } });
  }
  console.log(`[bootstrap] assigned user ids to ${pending.length} existing account(s)`);
}

/**
 * Stamp `first_paid_at` on accounts that paid before the flag existed.
 *
 * Without this, every existing customer would start seeing the free-tier
 * watermark the moment this build ships, because the flag they never got is
 * what proves they paid. Reads their earliest paid order, so the date is
 * genuinely their first payment rather than the day of the deploy.
 */
async function backfillFirstPayments(): Promise<void> {
  const ucol = await users();
  const pending = await ucol
    .find({ first_paid_at: { $exists: false } }, { projection: { _id: 1 } })
    .toArray();
  if (!pending.length) return;

  const ocol = await orders();
  let marked = 0;
  for (const u of pending) {
    const first = await ocol
      .find({ user_id: u._id, status: 'paid' })
      .sort({ paid_at: 1 })
      .limit(1)
      .next();
    if (!first) continue;
    await ucol.updateOne(
      { _id: u._id },
      { $set: { first_paid_at: first.paid_at ?? first.created } },
    );
    marked++;
  }
  if (marked) {
    console.log(`[bootstrap] marked ${marked} existing account(s) as previously paid`);
  }
}

async function bootstrap(): Promise<void> {
  await ensureIndexes();
  await getSettings(); // materialise the settings document with defaults

  // Before the admin check below — that returns early once an admin exists, and
  // a backfill placed after it would never run on an existing install.
  await backfillUserIds();
  await backfillFirstPayments();

  // Seed one admin the first time the app ever boots. Skipped entirely once any
  // admin exists, so this can never silently resurrect a deleted account or
  // reset a password that's since been changed.
  const col = await users();
  const admins = await col.countDocuments({ is_admin: true }, { limit: 1 });
  if (admins > 0) return;

  const email = ADMIN_EMAIL.toLowerCase().trim();
  if (await col.findOne({ email })) return;

  await createUser({
    email,
    name: 'Admin',
    password: ADMIN_PASSWORD,
    isAdmin: true,
    balance: DEFAULT_BALANCE_IMAGES,
  });
  console.log(`[bootstrap] seeded admin account: ${email}`);
}

export function ensureBootstrapped(): Promise<void> {
  global._aimagegenBootstrap ??= bootstrap().catch((e) => {
    // Clear the memo so the next request retries rather than being stuck with a
    // permanently rejected promise (e.g. Mongo wasn't up yet on first boot).
    global._aimagegenBootstrap = undefined;
    throw e;
  });
  return global._aimagegenBootstrap;
}