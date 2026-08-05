# AImageGen — Next.js + MongoDB

On-model AI fashion photography. Upload a garment, get a photo-real model wearing
it in every pose you direct.

This is the Next.js rewrite of the original FastAPI app. Same product, same
generation behaviour, same prompts — different stack.

| | Before | Now |
|---|---|---|
| Backend | FastAPI + uvicorn | Next.js route handlers |
| Frontend | 1,685-line single HTML file | React + Tailwind CSS v4 |
| Accounts | SQLite (`users.db`) | MongoDB |
| Shoots / models | JSON files on disk | MongoDB |
| Event log | `logs.jsonl` | MongoDB |
| Settings | `state.json` | MongoDB (one document) |
| Images | files on disk | files on disk, behind a storage adapter |
| Image processing | Pillow | sharp |
| AI SDK | `google-genai` (Python) | `@google/genai` (Node) |

---

## Run it locally

**Prerequisites:** Node 20+ and a MongoDB you can reach (local install, Docker,
or Atlas).

```bash
cd vdofy-next
npm install
cp .env.example .env.local     # then edit it
npm run dev                     # http://localhost:3000
```

Leave `GEMINI_API_KEY` blank to run in **DEMO mode** — placeholder images, no key
needed, every flow clickable end to end. Paste a real key to switch to live
Gemini. Nothing else changes.

On first boot with an empty database the app seeds one admin account from
`ADMIN_EMAIL` / `ADMIN_PASSWORD`. It skips seeding entirely once any admin
exists, so it can never resurrect a deleted account or reset a changed password.

### MongoDB in one line

```bash
docker run -d -p 27017:27017 --name aimagegen-mongo mongo:7
```

---

## Migrating from the Python app

A one-time script imports everything: accounts, shoots, saved models, logs and
settings.

```bash
# Dry run first — reports what it would do, writes nothing.
node scripts/migrate.mjs --from /path/to/old/vdofy_app --dry-run

# For real, copying the image files across too:
node scripts/migrate.mjs --from /path/to/old/vdofy_app --copy-files
```

**Passwords carry over unchanged.** The Next app uses the identical
pbkdf2-hmac-sha256 / 200,000-round scheme, so nobody has to reset anything.
Live sessions carry over too, so nobody is logged out mid-migration.

Prefer not to copy 650 MB of images? Skip `--copy-files` and point the app at
the folder that already exists:

```bash
DATA_DIR=/path/to/old/vdofy_app/data
```

The script is **safe to re-run** — every write is an upsert keyed on the original
id. The one exception is the event log, which has no natural key: it imports only
when the `logs` collection is empty, so a re-run can't duplicate 600 rows.

---

## Layout

```
src/
  app/
    (marketing)/       public landing page  →  /
    (auth)/            /login, /register
    (studio)/          one real route per view:
                         /generate  /gallery  /models
                         /usage  /recharge
                         /logs  /admin   (admin-only, guarded server-side)
    api/               every JSON endpoint
    outputs/[pid]/     generated shoot images (access-controlled)
    models/[mid]/      saved-model references (access-controlled)
    auth/              signup / login / logout
  components/          React UI
  lib/
    config.ts          all env reading, in one place
    mongo.ts           connection + typed collections + indexes
    auth.ts            accounts, sessions, the credit wallet
    storage.ts         the storage adapter  ← swap this to move off local disk
    images.ts          sharp: resize, grid compose, headless detection
    gemini.ts          the AI provider, with retry policy
    prompts.ts         every prompt builder
    gen.ts             the generation core
    jobs.ts            in-memory job tracking
    client/            browser-side helpers, hooks and types
scripts/migrate.mjs    the one-time importer
```

### Routing

Every view is a real page with its own URL — there are no `#hash` routes. The
studio layout holds the shared state (crucially the in-progress shoot), so
moving between `/generate` and `/gallery` is a client-side navigation that
doesn't lose your work.

Auth is enforced in `(studio)/layout.tsx` on the **server**, so a signed-out
visitor is redirected before any HTML is sent — no flash of the app. `/logs` and
`/admin` re-check the admin role the same way, which the old client-side hash
guard couldn't do safely.

Old URLs still resolve: `/app` → `/generate`, `/signup` → `/register`,
`/home` → `/`.

### The two design systems

The marketing page and the studio each have their own palette, and both define
`--bg`, `--muted`, `--line` and `--shadow` with **different values**. They're
kept apart with route groups: `(marketing)/layout.tsx` links `public/landing.css`,
`(studio)/layout.tsx` imports `globals.css`. Neither is global. Don't move a CSS
import up into the root layout — the two will fight and one page will render with
the other's colours.

**Keep element resets inside `@layer base` in `globals.css`.** Tailwind v4 emits
utilities into `@layer utilities`, and unlayered CSS beats layered CSS in the
cascade no matter the specificity. A bare `button { background: none }` written
outside a layer silently kills every `bg-*` class in the app — buttons render
unstyled and it looks like Tailwind is broken.

---

## Moving images off local disk

Everything that touches a file goes through `src/lib/storage.ts`. Nothing else in
the codebase does any I/O.

To switch to S3 / Cloudflare R2, implement the six-method `StorageDriver`
interface against the SDK, add a case to `makeDriver()`, and set
`STORAGE_DRIVER`. No other file changes.

---

## Things worth knowing

**Generation runs in-process.** A shoot takes 15–60s, so the API starts the work
in the background and the browser polls `/api/job/<id>`. Jobs live in process
memory, which means the app must run as **one** long-lived Node process — not on
a serverless platform, and not clustered across workers, or a poll can land on a
process that's never heard of the job. `src/lib/jobs.ts` is the seam to replace
with Redis if this ever needs more than one box.

**Charge-on-success.** Credits come off the wallet only after an image actually
lands in storage. A failed or blocked generation costs the user nothing.

**Images are access-controlled.** The old app mounted `data/outputs` as public
static files — anyone with a URL could read anyone's shoot. Here `/outputs/...`
and `/models/...` run the same ownership check as the rest of the API. URL shapes
are unchanged, so image links stored in migrated log rows still resolve.

**Child safety.** The relaxed sexual-content threshold is only ever sent when a
shoot explicitly opts in, and `gen.ts` forces it off for the kidswear category
regardless. Don't route around that.

**Dead code that wasn't ported.** The Python app carried four unused functions:
`slice_grid`, `gemini_generate_multiref`, `build_charsheet_prompt` and
`latest_charsheet_identity_frames` — none were ever called, and the last one
referenced an undefined constant and would have crashed if it had been. The
`state.history` list was also dropped: nothing read it, and it had grown to most
of `state.json`.

---

## Scripts

| | |
|---|---|
| `npm run dev` | dev server, hot reload |
| `npm run build` | production build |
| `npm start` | run the production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run migrate` | the Python → MongoDB importer |

---

## Deploying

See [DEPLOY.md](./DEPLOY.md) — Hostinger VPS, nginx, pm2, HTTPS, backups.
# fashion_next
