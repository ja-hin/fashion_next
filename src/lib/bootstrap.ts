/**
 * One-time startup work: create indexes and seed the first admin account.
 *
 * Runs lazily on the first request that needs the database (rather than at
 * import time) so a build or a typecheck never tries to reach MongoDB. The
 * promise is memoised, so concurrent first requests all await the same run.
 */
import 'server-only';
import { ensureIndexes, users } from './mongo';
import { createUser } from './auth';
import { getSettings } from './settings';
import { ADMIN_EMAIL, ADMIN_PASSWORD, DEFAULT_BALANCE_IMAGES } from './config';

declare global {
  // eslint-disable-next-line no-var
  var _aimagegenBootstrap: Promise<void> | undefined;
}

async function bootstrap(): Promise<void> {
  await ensureIndexes();
  await getSettings(); // materialise the settings document with defaults

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