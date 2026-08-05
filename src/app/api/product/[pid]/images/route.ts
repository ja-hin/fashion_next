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
      pose: m.pose,
      url: shootUrl(pid, m.file),
      dlurl: `/api/product/${pid}/file/${m.file}`,
      dl: `${prefix}_${safeName(m.pose)}.jpg`,
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
    });
  },
);