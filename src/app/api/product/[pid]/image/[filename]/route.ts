import { handler, json, HttpError } from '@/lib/api';
import { requireOwnedShoot, updateShoot } from '@/lib/shoots';
import { storage, shootKey, baseName } from '@/lib/storage';
import { removeDerivatives } from '@/lib/derivatives';

export const runtime = 'nodejs';

/**
 * Really delete one image: off storage AND out of the shoot manifest, so it
 * disappears from the results view, the Gallery folder and the ZIP alike.
 */
export const DELETE = handler(
  async (_req: Request, ctx: { params: Promise<{ pid: string; filename: string }> }) => {
    const { pid, filename } = await ctx.params;
    const { shoot } = await requireOwnedShoot(pid);

    const file = baseName(decodeURIComponent(filename));

    // The hero holds the shoot's locked model — deleting it would break every
    // later pose, so it's protected.
    if (shoot.hero_file && shoot.hero_file === file) {
      throw new HttpError(
        400,
        "Cannot delete the hero image (it holds the shoot's locked model).",
      );
    }

    const manifest = shoot.manifest ?? [];
    const next = manifest.filter((m) => m.file !== file);
    if (next.length === manifest.length) {
      throw new HttpError(404, 'Image not found in this shoot');
    }

    await updateShoot(pid, { manifest: next });
    const key = shootKey(pid, file);
    await storage.remove(key);
    await removeDerivatives(key);

    return json({ ok: true, file });
  },
);