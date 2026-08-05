/**
 * MongoDB connection + typed collection accessors.
 *
 * The client is cached on globalThis so Next's dev-mode hot reload doesn't open
 * a new connection pool on every edit (the standard Next + Mongo pattern).
 */
import 'server-only';
import { MongoClient, type Db, type Collection } from 'mongodb';
import { MONGODB_URI, MONGODB_DB } from './config';
import type {
  UserDoc,
  SessionDoc,
  ShootDoc,
  ModelDoc,
  LogDoc,
  SettingsDoc,
  OrderDoc,
} from './types';

declare global {
  // eslint-disable-next-line no-var
  var _aimagegenMongo: { client: MongoClient; promise: Promise<MongoClient> } | undefined;
}

function clientPromise(): Promise<MongoClient> {
  if (!global._aimagegenMongo) {
    const client = new MongoClient(MONGODB_URI, {
      // The app is a single long-lived Node process behind nginx; a modest pool
      // is plenty and keeps memory predictable on a small VPS.
      maxPoolSize: 20,
      serverSelectionTimeoutMS: 8000,
    });
    global._aimagegenMongo = { client, promise: client.connect() };
  }
  return global._aimagegenMongo.promise;
}

export async function getDb(): Promise<Db> {
  const client = await clientPromise();
  return client.db(MONGODB_DB);
}

// ── typed collection accessors ──────────────────────────────────────
export async function users(): Promise<Collection<UserDoc>> {
  return (await getDb()).collection<UserDoc>('users');
}
export async function sessions(): Promise<Collection<SessionDoc>> {
  return (await getDb()).collection<SessionDoc>('sessions');
}
export async function shoots(): Promise<Collection<ShootDoc>> {
  return (await getDb()).collection<ShootDoc>('shoots');
}
export async function savedModels(): Promise<Collection<ModelDoc>> {
  return (await getDb()).collection<ModelDoc>('models');
}
export async function logs(): Promise<Collection<LogDoc>> {
  return (await getDb()).collection<LogDoc>('logs');
}
export async function settings(): Promise<Collection<SettingsDoc>> {
  return (await getDb()).collection<SettingsDoc>('settings');
}
export async function orders(): Promise<Collection<OrderDoc>> {
  return (await getDb()).collection<OrderDoc>('orders');
}

/**
 * Create every index the app relies on. Idempotent — safe to call on each boot.
 * Called once from ensureBootstrapped() in bootstrap.ts.
 */
export async function ensureIndexes(): Promise<void> {
  const [u, s, sh, m, l, o] = await Promise.all([
    users(),
    sessions(),
    shoots(),
    savedModels(),
    logs(),
    orders(),
  ]);

  await Promise.all([
    u.createIndex({ email: 1 }, { unique: true }),
    u.createIndex({ is_admin: -1, created: 1 }),

    s.createIndex({ user_id: 1 }),
    // Sessions self-destruct once `expires` passes — this replaces the old
    // "sessions row lives forever" behaviour of the SQLite table.
    s.createIndex({ expires: 1 }, { expireAfterSeconds: 0 }),

    sh.createIndex({ 'opts.owner': 1, created: -1 }),
    sh.createIndex({ created: -1 }),

    m.createIndex({ owner: 1, created: -1 }),
    m.createIndex({ source_pid: 1 }),

    l.createIndex({ ts: -1 }),
    l.createIndex({ user: 1, ts: -1 }),
    l.createIndex({ pid: 1 }),

    o.createIndex({ user_id: 1, created: -1 }),
    o.createIndex({ status: 1, created: -1 }),
    // Payment id is unique per successful capture. Sparse because it is absent
    // until the payment lands, and unique so a replayed webhook can't attach
    // one payment to a second order.
    o.createIndex({ payment_id: 1 }, { unique: true, sparse: true }),
  ]);
}