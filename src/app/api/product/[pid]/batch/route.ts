import { handler, json, formData, str, HttpError } from '@/lib/api';
import { requireOwnedShoot } from '@/lib/shoots';
import { createJob, runBackground } from '@/lib/jobs';
import { runBatch, type BatchRow } from '@/lib/gen';

export const runtime = 'nodejs';
export const maxDuration = 900;

/** Hard cap so one request can't queue an unbounded run against the API. */
const MAX_ROWS = 40;

export const POST = handler(
  async (req: Request, ctx: { params: Promise<{ pid: string }> }) => {
    const { pid } = await ctx.params;
    await requireOwnedShoot(pid);

    const fd = await formData(req);

    let parsed: BatchRow[];
    try {
      parsed = JSON.parse(str(fd, 'rows'));
      if (!Array.isArray(parsed)) throw new Error('not an array');
    } catch {
      throw new HttpError(400, 'Bad rows');
    }

    if (!parsed.length) throw new HttpError(400, 'Add at least one row to the batch.');
    if (parsed.length > MAX_ROWS) {
      throw new HttpError(400, `A batch can hold at most ${MAX_ROWS} images.`);
    }

    // Per-row scene override, same rule as the single-add route.
    for (const r of parsed) {
      if (r.backdrop || r.mood || r.lighting) {
        r.scene = `${r.backdrop || 'studio seamless'} background, ${
          r.lighting || 'soft bright commercial'
        } lighting, ${r.mood || 'clean'} mood`;
      }
    }

    const jobId = createJob(parsed.length);
    runBackground(jobId, () => runBatch(jobId, pid, parsed));

    return json({ job_id: jobId, total: parsed.length });
  },
);