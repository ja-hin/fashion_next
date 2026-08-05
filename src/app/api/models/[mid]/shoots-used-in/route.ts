import { handler, json } from '@/lib/api';
import { requireOwnedModel } from '@/lib/saved-models';
import { shoots } from '@/lib/mongo';
import { shootNoStr } from '@/lib/settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Every shoot anchored to this model. Queried directly off `opts.model_id`
 * rather than maintained as a separate index, so it can never drift out of sync
 * with what's actually saved.
 */
export const GET = handler(
  async (_req: Request, ctx: { params: Promise<{ mid: string }> }) => {
    const { mid } = await ctx.params;
    await requireOwnedModel(mid);

    const rows = await (await shoots())
      .find({ 'opts.model_id': mid })
      .sort({ created: -1 })
      .toArray();

    return json({
      shoots: rows.map((s) => ({
        pid: s._id,
        name: (s.name ?? '').trim() || shootNoStr(s.no),
        created: s.created ?? '',
        image_count: (s.manifest ?? []).length,
      })),
    });
  },
);