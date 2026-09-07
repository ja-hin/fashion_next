import { handler, json } from '@/lib/api';
import { requireOwnedShoot, shootFilePrefix } from '@/lib/shoots';
import { shootUrl } from '@/lib/storage';
import { shootNoStr, safeName } from '@/lib/settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = handler(
  async (_req: Request, ctx: { params: Promise<{ pid: string }> }) => {
    const { pid } = await ctx.params;
    const { shoot } = await requireOwnedShoot(pid);

    const prefix = shootFilePrefix(shoot);
    const images = (shoot.manifest ?? []).map((m) => ({
      file: m.file,
      pose: m.pose,
      url: shootUrl(pid, m.file),
      dlurl: `/api/product/${pid}/file/${m.file}`,
      dl: `${prefix}_${safeName(m.pose)}.jpg`,
    }));

    const videos = (shoot.videos ?? []).map((v) => ({
      file: v.file,
      url: shootUrl(pid, v.file),
      dlurl: `/api/product/${pid}/file/${v.file}`,
      dl: `${prefix}_${safeName(v.preset)}.mp4`,
      preset: v.preset,
      aspect: v.aspect,
      created: v.created,
    }));

    /*
     * The garment photos the shoot was built from.
     *
     * A shoot generated straight to video has no stills at all, but it does
     * have these , so "make another video" is still possible from them, which
     * is why they are listed rather than left as an internal detail.
     */
    const refs = (shoot.refs ?? []).map((r) => ({
      file: r.file,
      url: shootUrl(pid, r.file),
      role: r.role,
    }));

    const name = (shoot.name ?? '').trim();
    return json({
      pid,
      seed: shoot.seed,
      no: shoot.no,
      shoot: shootNoStr(shoot.no),
      name,
      title: name || shootNoStr(shoot.no),
      images,
      videos,
      refs,
    });
  },
);