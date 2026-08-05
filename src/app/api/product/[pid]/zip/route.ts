import { Readable } from 'node:stream';
import archiver from 'archiver';
import { handler } from '@/lib/api';
import { requireOwnedShoot, shootFilePrefix } from '@/lib/shoots';
import { storage, shootKey } from '@/lib/storage';
import { safeName } from '@/lib/settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Download the whole shoot as a ZIP, with every image named after its pose.
 * Streamed rather than buffered, so a large shoot doesn't sit in memory.
 */
export const GET = handler(
  async (_req: Request, ctx: { params: Promise<{ pid: string }> }) => {
    const { pid } = await ctx.params;
    const { shoot } = await requireOwnedShoot(pid);

    const prefix = shootFilePrefix(shoot);
    const archive = archiver('zip', { zlib: { level: 9 } });

    // Two poses can share a name ("side profile" twice) — suffix duplicates so
    // no entry silently overwrites another inside the archive.
    const used = new Map<string, number>();

    void (async () => {
      try {
        for (const item of shoot.manifest ?? []) {
          const bytes = await storage.get(shootKey(pid, item.file));
          if (!bytes) continue;
          const base = `${prefix}_${safeName(item.pose)}`;
          const n = (used.get(base) ?? 0) + 1;
          used.set(base, n);
          archive.append(bytes, { name: n === 1 ? `${base}.jpg` : `${base}_${n}.jpg` });
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