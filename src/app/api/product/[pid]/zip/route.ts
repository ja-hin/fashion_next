import { Readable } from 'node:stream';
import archiver from 'archiver';
import { handler } from '@/lib/api';
import { requireOwnedShoot, shootFilePrefix } from '@/lib/shoots';
import { storage, shootKey } from '@/lib/storage';
import { safeName } from '@/lib/settings';
import { applyWatermark, shouldWatermark } from '@/lib/watermark';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Download the whole shoot as a ZIP, with every image named after its pose.
 * Streamed rather than buffered, so a large shoot doesn't sit in memory.
 *
 * Free-tier archives are watermarked per entry , this is the bulk path, so it
 * is the one that matters most if the mark is meant to hold.
 */
export const GET = handler(
  async (_req: Request, ctx: { params: Promise<{ pid: string }> }) => {
    const { pid } = await ctx.params;
    const { user, shoot } = await requireOwnedShoot(pid);
    const wm = shouldWatermark(user);

    const prefix = shootFilePrefix(shoot);
    const archive = archiver('zip', { zlib: { level: 9 } });

    // Two poses can share a name ("side profile" twice) , suffix duplicates so
    // no entry silently overwrites another inside the archive.
    const used = new Map<string, number>();

    void (async () => {
      try {
        for (const item of shoot.manifest ?? []) {
          const stored = await storage.get(shootKey(pid, item.file));
          if (!stored) continue;
          const bytes = wm ? await applyWatermark(stored) : stored;
          const base = `${prefix}_${safeName(item.pose)}`;
          const n = (used.get(base) ?? 0) + 1;
          used.set(base, n);
          archive.append(bytes, { name: n === 1 ? `${base}.jpg` : `${base}_${n}.jpg` });
        }

        // Clips go in the same download. "Download all" that quietly omitted
        // the thing that cost 35 credits would be the wrong kind of surprise.
        // No watermark pass , that is an image operation.
        for (const v of shoot.videos ?? []) {
          const stored = await storage.get(shootKey(pid, v.file));
          if (!stored) continue;
          const base = `${prefix}_${safeName(v.preset)}`;
          const n = (used.get(base) ?? 0) + 1;
          used.set(base, n);
          archive.append(stored, { name: n === 1 ? `${base}.mp4` : `${base}_${n}.mp4` });
        }

        await archive.finalize();
      } catch (e) {
        archive.abort();
        console.error('[zip] failed to build archive', e);
      }
    })();

    // archiver is a Node stream; the Response body needs a web ReadableStream.
    const body = Readable.toWeb(archive) as unknown as ReadableStream<Uint8Array>;

    return new Response(body, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${prefix}_shoot.zip"`,
      },
    });
  },
);