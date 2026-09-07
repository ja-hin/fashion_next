/**
 * Backfill the `videos` list on shoots that already have generated clips.
 *
 * Clips written before the shoot document tracked them are on disk but on no
 * list, so nothing renders them , the storage folder is never enumerated, the
 * document is what every view reads. This walks the outputs directory and adds
 * the entry that should have been written at generation time.
 *
 * Safe to run repeatedly: a file already listed on its shoot is skipped, so it
 * cannot double-add.
 *
 *   node scripts/backfill-videos.mjs           # report only
 *   node scripts/backfill-videos.mjs --apply   # write
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { MongoClient } from 'mongodb';

for (const f of ['.env.local', '.env']) {
  if (!existsSync(f)) continue;
  for (const line of readFileSync(f, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

const APPLY = process.argv.includes('--apply');
const DATA_DIR = process.env.DATA_DIR || './data';
const URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const DB = process.env.MONGODB_DB || 'aimagegen';

const outputs = join(DATA_DIR, 'outputs');
if (!existsSync(outputs)) {
  console.error(`No outputs directory at ${outputs}`);
  process.exit(1);
}

const client = new MongoClient(URI);
await client.connect();
const shoots = client.db(DB).collection('shoots');

let found = 0;
let added = 0;

for (const pid of readdirSync(outputs)) {
  const dir = join(outputs, pid);
  if (!statSync(dir).isDirectory()) continue;

  const clips = readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.mp4'));
  if (!clips.length) continue;

  const shoot = await shoots.findOne({ _id: pid });
  if (!shoot) {
    console.log(`  ${pid}  ${clips.length} clip(s) , NO SHOOT DOCUMENT, skipped`);
    continue;
  }

  const listed = new Set((shoot.videos ?? []).map((v) => v.file));
  for (const file of clips) {
    found++;
    if (listed.has(file)) continue;

    // Filenames are `video_<base36 ms>_<9x16|16x9>.mp4`. The timestamp is real
    // information , better than "now" for a clip made days ago , and the aspect
    // is recoverable too. The preset is not, so it is labelled honestly.
    const m = file.match(/^video_([a-z0-9]+)_(\d+x\d+)\.mp4$/i);
    const ms = m ? parseInt(m[1], 36) : NaN;
    const created =
      Number.isFinite(ms) && ms > 1e12
        ? new Date(ms).toISOString()
        : statSync(join(dir, file)).mtime.toISOString();

    const entry = {
      file,
      preset: 'Video',
      aspect: m ? m[2].replace('x', ':') : '9:16',
      frames: [],
      created,
    };

    console.log(`  ${pid}  + ${file}  (${entry.aspect}, ${created.slice(0, 16)})`);
    if (APPLY) await shoots.updateOne({ _id: pid }, { $push: { videos: entry } });
    added++;
  }
}

console.log(
  `\n${found} clip(s) on disk, ${added} needed listing.` +
    (APPLY ? ' Written.' : ' Dry run , re-run with --apply to write.'),
);
await client.close();
