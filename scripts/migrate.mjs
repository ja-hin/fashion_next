#!/usr/bin/env node
/**
 * One-time migration: the old Python app's SQLite + JSON files → MongoDB.
 *
 *   users.db        → users, sessions collections
 *   data/shoots/*   → shoots collection
 *   data/models/*   → models collection
 *   data/logs.jsonl → logs collection
 *   data/state.json → settings document
 *   data/outputs/*  → copied (or left in place) under the new DATA_DIR
 *
 * Password hashes carry over unchanged — the Next app uses the identical
 * pbkdf2-hmac-sha256 / 200k-round scheme, so nobody has to reset a password.
 *
 * Safe to re-run: every write is an idempotent upsert keyed on the original id.
 *
 * Usage:
 *   node scripts/migrate.mjs --from /path/to/old/vdofy_app [--copy-files] [--dry-run]
 */

import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MongoClient } from 'mongodb';

// ── env files ───────────────────────────────────────────────────────
// Next.js loads .env.local automatically, but a plain `node scripts/…` run does
// not — so without this the script would silently ignore your configuration and
// fall back to localhost. Real environment variables always win, so
// `MONGODB_URI=… node scripts/migrate.mjs` still overrides the file.
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, '..');

function loadEnvFile(file) {
  let raw;
  try {
    raw = fsSync.readFileSync(file, 'utf8');
  } catch {
    return false;
  }
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    // Strip one layer of surrounding quotes, if present.
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
  return true;
}

// Same precedence Next.js uses: .env.local beats .env.
const loadedEnvFiles = ['.env.local', '.env']
  .filter((f) => loadEnvFile(path.join(PROJECT_ROOT, f)))
  .map((f) => f);

// ── args ────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const arg = (name, dflt = null) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : dflt;
};
const flag = (name) => argv.includes(`--${name}`);

const OLD_ROOT = path.resolve(arg('from', '..'));
const OLD_DATA = path.join(OLD_ROOT, 'data');
const COPY_FILES = flag('copy-files');
const DRY_RUN = flag('dry-run');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const MONGODB_DB = process.env.MONGODB_DB || 'aimagegen';
const NEW_DATA = path.resolve(process.env.DATA_DIR || './data');

const log = (...a) => console.log(...a);
const warn = (...a) => console.warn('  ⚠', ...a);

// ── helpers ─────────────────────────────────────────────────────────

/** Filename only, regardless of the separator the path was saved with. */
const baseName = (p) => String(p ?? '').replace(/\\/g, '/').split('/').pop() ?? '';

/** Hide the password before a connection string is ever printed or logged. */
function redactUri(uri) {
  return String(uri).replace(/\/\/([^:/@]+):([^@]+)@/, '//$1:****@');
}

async function readJson(file, dflt = null) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    return dflt;
  }
}

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/** Bulk upsert keyed on _id. No-op on an empty list. */
async function upsertAll(col, docs, label) {
  if (!docs.length) {
    log(`  ${label}: nothing to migrate`);
    return 0;
  }
  if (DRY_RUN) {
    log(`  ${label}: would migrate ${docs.length}`);
    return docs.length;
  }
  const ops = docs.map((d) => ({
    replaceOne: { filter: { _id: d._id }, replacement: d, upsert: true },
  }));
  const res = await col.bulkWrite(ops, { ordered: false });
  log(`  ${label}: ${res.upsertedCount} inserted, ${res.modifiedCount} updated`);
  return docs.length;
}

// ── users + sessions ────────────────────────────────────────────────
async function migrateUsers(db) {
  const dbFile = path.join(OLD_DATA, 'users.db');
  if (!(await exists(dbFile))) {
    warn(`no users.db at ${dbFile} — skipping accounts`);
    return;
  }

  const sqlite = new DatabaseSync(dbFile, { readOnly: true });

  const userRows = sqlite.prepare('SELECT * FROM users').all();
  const users = userRows.map((u) => ({
    _id: String(u.id),
    email: String(u.email ?? '').toLowerCase().trim(),
    name: String(u.name ?? ''),
    pw_hash: String(u.pw_hash),
    pw_salt: String(u.pw_salt),
    is_admin: !!u.is_admin,
    balance: Number(u.balance ?? 0),
    created: String(u.created ?? ''),
    active: u.active === undefined || u.active === null ? true : !!u.active,
  }));
  await upsertAll(db.collection('users'), users, 'users');

  // Sessions carry over so nobody is logged out mid-migration. The new schema
  // adds a TTL `expires` field the old table never had; anchor it to the
  // session's creation time plus the same 7-day window the app has always used.
  let sessions = [];
  try {
    sessions = sqlite
      .prepare('SELECT * FROM sessions')
      .all()
      .map((s) => {
        const created = String(s.created ?? '');
        const base = Date.parse(created);
        const from = Number.isFinite(base) ? base : Date.now();
        return {
          _id: String(s.token),
          user_id: String(s.user_id),
          created,
          expires: new Date(from + 7 * 24 * 3600 * 1000),
        };
      })
      // Drop anything already past its window rather than importing dead rows.
      .filter((s) => s.expires.getTime() > Date.now());
  } catch {
    warn('no sessions table — users will simply sign in again');
  }
  await upsertAll(db.collection('sessions'), sessions, 'sessions');

  sqlite.close();
}

// ── shoots ──────────────────────────────────────────────────────────
async function migrateShoots(db) {
  const dir = path.join(OLD_DATA, 'shoots');
  if (!(await exists(dir))) {
    warn(`no shoots dir at ${dir}`);
    return;
  }

  const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.json'));
  const docs = [];

  for (const f of files) {
    const rec = await readJson(path.join(dir, f));
    if (!rec) {
      warn(`could not parse ${f} — skipped`);
      continue;
    }
    const pid = path.basename(f, '.json');

    // The old records stored absolute paths that broke whenever the app folder
    // moved. Only the filename was ever meaningful, so that's all we keep.
    docs.push({
      _id: pid,
      seed: Number(rec.seed ?? 0),
      opts: rec.opts ?? {},
      no: Number(rec.no ?? 0),
      name: String(rec.name ?? ''),
      look: String(rec.look ?? ''),
      garment_file: rec.garment_path ? baseName(rec.garment_path) : 'garment.jpg',
      hero_file: rec.hero_path ? baseName(rec.hero_path) : null,
      manifest: Array.isArray(rec.manifest) ? rec.manifest : [],
      created: String(rec.created ?? ''),
    });
  }

  await upsertAll(db.collection('shoots'), docs, 'shoots');
}

// ── saved models ────────────────────────────────────────────────────
async function migrateModels(db) {
  const dir = path.join(OLD_DATA, 'models');
  if (!(await exists(dir))) {
    warn(`no models dir at ${dir}`);
    return;
  }

  const entries = await fs.readdir(dir, { withFileTypes: true });
  const docs = [];

  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const rec = await readJson(path.join(dir, e.name, 'model.json'));
    if (!rec) continue;

    docs.push({
      _id: rec.id ?? e.name,
      name: String(rec.name ?? ''),
      owner: String(rec.owner ?? ''),
      owner_email: String(rec.owner_email ?? ''),
      created: String(rec.created ?? ''),
      source: rec.source ?? 'shoot',
      source_pid: String(rec.source_pid ?? ''),
      source_shoot: String(rec.source_shoot ?? ''),
      tags: rec.tags ?? {},
      refs: Array.isArray(rec.refs) ? rec.refs : [],
      kept_batch: String(rec.kept_batch ?? ''),
    });
  }

  await upsertAll(db.collection('models'), docs, 'models');
}

// ── event log ───────────────────────────────────────────────────────
async function migrateLogs(db) {
  const file = path.join(OLD_DATA, 'logs.jsonl');
  if (!(await exists(file))) {
    warn(`no logs.jsonl at ${file}`);
    return;
  }

  const raw = await fs.readFile(file, 'utf8');
  const rows = [];
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    try {
      rows.push(JSON.parse(t));
    } catch {
      // A truncated final line is normal for an append-only file — skip it.
    }
  }

  if (!rows.length) {
    log('  logs: nothing to migrate');
    return;
  }

  const col = db.collection('logs');

  if (DRY_RUN) {
    log(`  logs: would migrate ${rows.length}`);
    return;
  }

  // Log rows have no natural key, so re-running would duplicate them. Guard by
  // only importing when the collection is empty.
  const existing = await col.countDocuments({}, { limit: 1 });
  if (existing > 0) {
    warn(`logs collection is not empty — skipping (delete it first to re-import)`);
    return;
  }

  await col.insertMany(rows, { ordered: false });
  log(`  logs: ${rows.length} inserted`);
}

// ── settings ────────────────────────────────────────────────────────
async function migrateSettings(db) {
  const state = await readJson(path.join(OLD_DATA, 'state.json'));
  if (!state) {
    warn('no state.json — settings will use defaults');
    return;
  }

  const doc = {
    _id: 'app',
    price_per_image: Number(state.price_per_image ?? 1),
    genie_free: Number(state.genie_free ?? 1),
    genie_price: Number(state.genie_price ?? 0.1),
    genie_max: Number(state.genie_max ?? 5),
    shoot_seq: Number(state.shoot_seq ?? 0),
    prices: state.prices ?? {
      imagine: { '1K': 5, '2K': 10, '4K': 20 },
      saved: { '1K': 8, '2K': 16, '4K': 32 },
    },
  };

  // `state.history` is deliberately dropped: it was an append-only list that
  // nothing ever read, and it had grown to most of state.json's size.
  if (DRY_RUN) {
    log('  settings: would migrate (shoot_seq =', doc.shoot_seq, ')');
    return;
  }
  await db.collection('settings').replaceOne({ _id: 'app' }, doc, { upsert: true });
  log(`  settings: migrated (shoot_seq = ${doc.shoot_seq})`);
}

// ── image files ─────────────────────────────────────────────────────
async function migrateFiles() {
  const pairs = [
    [path.join(OLD_DATA, 'outputs'), path.join(NEW_DATA, 'outputs')],
    [path.join(OLD_DATA, 'models'), path.join(NEW_DATA, 'models')],
  ];

  for (const [src, dest] of pairs) {
    if (!(await exists(src))) continue;

    if (!COPY_FILES) {
      log(`  files: ${src} → ${dest}  (skipped; pass --copy-files to copy)`);
      continue;
    }
    if (DRY_RUN) {
      log(`  files: would copy ${src} → ${dest}`);
      continue;
    }

    log(`  files: copying ${src} → ${dest} …`);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    // Node 22+ recursive copy; `force: false` never clobbers an existing file,
    // which makes a re-run safe and resumable.
    await fs.cp(src, dest, { recursive: true, force: false, errorOnExist: false });
    log('  files: done');
  }

  // model.json files came along with the folder copy but are now redundant —
  // the model records live in MongoDB. Harmless to leave, so we do.
}

// ── main ────────────────────────────────────────────────────────────
async function main() {
  log('');
  log('═'.repeat(60));
  log('  AImageGen migration — Python/SQLite/JSON → MongoDB');
  log('═'.repeat(60));
  log(`  source   : ${OLD_DATA}`);
  log(`  env      : ${loadedEnvFiles.length ? loadedEnvFiles.join(', ') : 'none found (using defaults)'}`);
  log(`  mongo    : ${redactUri(MONGODB_URI)} / ${MONGODB_DB}`);
  log(`  new data : ${NEW_DATA}`);
  log(`  mode     : ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE'}`);
  log('');

  if (!(await exists(OLD_DATA))) {
    console.error(`✗ No data directory at ${OLD_DATA}`);
    console.error('  Pass the old app folder with --from /path/to/vdofy_app');
    process.exit(1);
  }

  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db(MONGODB_DB);

  try {
    await migrateUsers(db);
    await migrateShoots(db);
    await migrateModels(db);
    await migrateLogs(db);
    await migrateSettings(db);
    await migrateFiles();

    if (!DRY_RUN) {
      log('');
      log('  creating indexes…');
      await Promise.all([
        db.collection('users').createIndex({ email: 1 }, { unique: true }),
        db.collection('sessions').createIndex({ expires: 1 }, { expireAfterSeconds: 0 }),
        db.collection('shoots').createIndex({ 'opts.owner': 1, created: -1 }),
        db.collection('models').createIndex({ owner: 1, created: -1 }),
        db.collection('models').createIndex({ source_pid: 1 }),
        db.collection('logs').createIndex({ ts: -1 }),
        db.collection('logs').createIndex({ user: 1, ts: -1 }),
      ]);
      log('  indexes ready');
    }

    log('');
    log('✓ Migration complete.');
    if (!COPY_FILES) {
      log('');
      log('  NOTE: image files were NOT copied. Either re-run with --copy-files,');
      log(`  or point DATA_DIR at the existing folder: DATA_DIR=${OLD_DATA}`);
    }
    log('');
  } finally {
    await client.close();
  }
}

main().catch((e) => {
  // A connection failure is by far the most common way this script fails, and
  // the driver's stack trace buries the actual cause — so name it plainly.
  if (e?.name === 'MongoServerSelectionError') {
    console.error(`\n✗ Could not reach MongoDB at ${redactUri(MONGODB_URI)}`);
    console.error('');
    if (MONGODB_URI.includes('127.0.0.1') || MONGODB_URI.includes('localhost')) {
      console.error('  Nothing is listening on that port. Either start a local MongoDB:');
      console.error('     docker run -d -p 27017:27017 --name aimagegen-mongo mongo:7');
      console.error('');
      console.error('  …or point MONGODB_URI at your Atlas cluster in .env.local');
      console.error(`     (looked for env files in ${PROJECT_ROOT})`);
    } else {
      console.error('  Check that:');
      console.error('   • the cluster is running and not paused');
      console.error('   • your current IP is on the Atlas Network Access allow-list');
      console.error('   • the username and password in MONGODB_URI are correct');
      console.error('   • any password special characters are percent-encoded');
    }
    console.error('');
    process.exit(1);
  }
  console.error('\n✗ Migration failed:', e);
  process.exit(1);
});