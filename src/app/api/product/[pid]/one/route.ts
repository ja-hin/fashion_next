import { handler, json, formData, str } from '@/lib/api';
import { requireOwnedShoot } from '@/lib/shoots';
import { normaliseResolution } from '@/lib/settings';
import { createJob, runBackground } from '@/lib/jobs';
import { runOne } from '@/lib/gen';

export const runtime = 'nodejs';
export const maxDuration = 300;

export const POST = handler(
  async (req: Request, ctx: { params: Promise<{ pid: string }> }) => {
    const { pid } = await ctx.params;
    await requireOwnedShoot(pid);

    const fd = await formData(req);
    const label =
      str(fd, 'custom').trim() || str(fd, 'pose').trim() || 'standing front';

    const rawRes = str(fd, 'resolution');
    // Blank means "inherit the shoot's resolution", which is not the same as 1K.
    const resolution = rawRes ? normaliseResolution(rawRes) : null;

    const backdrop = str(fd, 'backdrop');
    const mood = str(fd, 'mood');
    const lighting = str(fd, 'lighting');

    // Only build a scene override when the user actually changed something —
    // otherwise the pose prompt keeps the hero's background verbatim.
    const scene =
      backdrop || mood || lighting
        ? `${backdrop || 'studio seamless'} background, ${
            lighting || 'soft bright commercial'
          } lighting, ${mood || 'clean'} mood`
        : null;

    const jobId = createJob(1);
    runBackground(jobId, () =>
      runOne(
        jobId,
        pid,
        label,
        str(fd, 'framing') || null,
        str(fd, 'aspect') || null,
        scene,
        { backdrop, mood, lighting },
        resolution,
      ),
    );

    return json({ job_id: jobId });
  },
);