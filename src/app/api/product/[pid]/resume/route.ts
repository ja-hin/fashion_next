import { handler, json } from '@/lib/api';
import { requireOwnedShoot } from '@/lib/shoots';
import { storage, shootKey, shootUrl } from '@/lib/storage';
import { shootNoStr } from '@/lib/settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Everything the Generate view needs to rehydrate a saved shoot: the hero, every
 * pose with its per-image settings, and whether the hero still exists (without
 * it the shoot can't be continued, since the hero holds the locked model).
 */
export const GET = handler(
  async (_req: Request, ctx: { params: Promise<{ pid: string }> }) => {
    const { pid } = await ctx.params;
    const { shoot } = await requireOwnedShoot(pid);

    const heroFile = shoot.hero_file ?? null;
    const heroExists = heroFile ? await storage.exists(shootKey(pid, heroFile)) : false;

    // Skip manifest entries whose file has since vanished from storage, so the
    // UI never renders a broken image.
    const images = [];
    for (const m of shoot.manifest ?? []) {
      if (!(await storage.exists(shootKey(pid, m.file)))) continue;
      images.push({
        file: m.file,
        pose: m.pose ?? 'image',
        img: shootUrl(pid, m.file),
        is_hero: heroFile === m.file,
        aspect: m.aspect ?? '',
        framing: m.framing ?? '',
        backdrop: m.backdrop ?? '',
        mood: m.mood ?? '',
        lighting: m.lighting ?? '',
      });
    }

    /*
     * What this shoot was made FROM , the uploads, not the results.
     *
     * A reshoot starts over from the same garment: same input, new model, new
     * scene, new seed. That is a different thing from continuing, which adds
     * poses to the hero already locked, so it needs the source images rather
     * than the manifest.
     *
     * Ensemble shoots keep their refs in order, because that order IS the
     * numbered manifest the prompt refers to. A single-garment shoot has only
     * garment_file, which stands in as one 'front' reference.
     *
     * Files that have since vanished are skipped, so a reshoot never opens on
     * a broken thumbnail.
     */
    const srcRefs: Array<{ file: string; role: string; url: string }> = [];
    const stored = shoot.refs?.length
      ? shoot.refs
      : shoot.garment_file
        ? [{ file: shoot.garment_file, role: 'front' as const }]
        : [];
    for (const r of stored) {
      if (!(await storage.exists(shootKey(pid, r.file)))) continue;
      srcRefs.push({ file: r.file, role: r.role, url: shootUrl(pid, r.file) });
    }

    const name = (shoot.name ?? '').trim();
    return json({
      pid,
      seed: shoot.seed,
      no: shoot.no,
      shoot: shootNoStr(shoot.no),
      name,
      title: name || shootNoStr(shoot.no),
      style: shoot.opts?.style ?? '',
      hero_exists: heroExists,
      // The uploads this shoot came from, for starting a fresh one on them.
      source: {
        refs: srcRefs,
        ref_mode: shoot.opts?.ref_mode ?? 'same_garment',
        category: shoot.opts?.category ?? '',
      },
      images,
      // Restored with the stills , a reload that dropped the videos would look
      // exactly like the bug where they were never saved at all.
      videos: (shoot.videos ?? []).map((v) => ({
        file: v.file,
        url: shootUrl(pid, v.file),
        preset: v.preset,
        aspect: v.aspect,
        created: v.created,
      })),
    });
  },
);