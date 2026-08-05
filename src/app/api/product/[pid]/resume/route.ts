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
      images,
    });
  },
);