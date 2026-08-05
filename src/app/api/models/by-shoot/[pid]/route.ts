import { handler, json, requireUser } from '@/lib/api';
import { savedModels } from '@/lib/mongo';
import { canSeeModel, publicModel } from '@/lib/saved-models';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Has a model already been saved from this shoot? Used by the Save-as-model
 * dialog to warn about a duplicate before the user names a second one.
 */
export const GET = handler(
  async (_req: Request, ctx: { params: Promise<{ pid: string }> }) => {
    const me = await requireUser();
    const { pid } = await ctx.params;

    const rec = await (await savedModels()).findOne({ source_pid: pid });
    return json({ model: rec && canSeeModel(me, rec) ? publicModel(rec) : null });
  },
);