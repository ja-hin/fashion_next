import { Readable } from 'node:stream';
import archiver from 'archiver';
import { handler } from '@/lib/api';
import { requireOwnedGarment } from '@/lib/garments';
import { storage, garmentKey } from '@/lib/storage';
import { safeName } from '@/lib/settings';
import { LABEL_FOR } from '@/lib/ensemble';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Download a garment's reference images as a ZIP, named by their role.
 *
 * These are the user's own uploads, so they come back exactly as stored — no
 * watermark, no derivative. The point of downloading is to get the originals.
 */
export const GET = handler(
  async (_req: Request, ctx: { params: Promise<{ gid: string }> }) => {
    const { gid } = await ctx.params;
    const { rec } = await requireOwnedGarment(gid);

    const prefix = safeName(rec.name || 'garment');
    const archive = archiver('zip', { zlib: { level: 9 } });

    void (async () => {
      try {
        // Two refs can share a role, so duplicates are suffixed rather than
        // silently overwriting each other inside the archive.
        const used = new Map<string, number>();
        for (const ref of rec.refs ?? []) {
          const bytes = await storage.get(garmentKey(gid, ref.file));
          if (!bytes) continue;
          const label = LABEL_FOR[rec.mode]?.[ref.role] ?? ref.role;
          const base = `${prefix}_${safeName(label)}`;
          const n = (used.get(base) ?? 0) + 1;
          used.set(base, n);
          archive.append(bytes, { name: n === 1 ? `${base}.jpg` : `${base}_${n}.jpg` });
        }
        await archive.finalize();
      } catch (e) {
        archive.abort();
        console.error('[garment zip] failed to build archive', e);
      }
    })();

    const body = Readable.toWeb(archive) as unknown as ReadableStream<Uint8Array>;
    return new Response(body, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${prefix}_references.zip"`,
      },
    });
  },
);
