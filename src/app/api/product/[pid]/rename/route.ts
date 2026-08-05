import { handler, json, formData, str } from '@/lib/api';
import { requireOwnedShoot, updateShoot, shootFilePrefix } from '@/lib/shoots';

export const runtime = 'nodejs';

export const POST = handler(
  async (req: Request, ctx: { params: Promise<{ pid: string }> }) => {
    const { pid } = await ctx.params;
    const { shoot } = await requireOwnedShoot(pid);

    const fd = await formData(req);
    const name = str(fd, 'name').trim().slice(0, 60);

    await updateShoot(pid, { name });
    shoot.name = name;

    // The name doubles as the download filename prefix, so hand the resolved
    // prefix back for the UI to display.
    return json({ ok: true, name, prefix: shootFilePrefix(shoot) });
  },
);