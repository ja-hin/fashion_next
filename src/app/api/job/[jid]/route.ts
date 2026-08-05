import { handler, json, requireUser, HttpError } from '@/lib/api';
import { getJob } from '@/lib/jobs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = handler(
  async (_req: Request, ctx: { params: Promise<{ jid: string }> }) => {
    const u = await requireUser();
    const { jid } = await ctx.params;

    const job = getJob(jid);
    if (!job) throw new HttpError(404, 'Unknown job');

    // The balance rides along so the wallet in the header updates as each image
    // lands, without the client needing a second round trip.
    return json({
      status: job.status,
      total: job.total,
      done: job.done,
      results: job.results,
      product_id: job.product_id,
      seed: job.seed,
      no: job.no,
      shoot: job.shoot,
      balance: u.balance,
    });
  },
);