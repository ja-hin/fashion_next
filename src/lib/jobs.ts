/**
 * In-flight generation jobs.
 *
 * Generation takes 15-60s, so the API starts the work in the background and
 * returns a job id immediately; the browser polls /api/job/<id> until it flips
 * to "done". Same contract as the FastAPI BackgroundTasks version.
 *
 * Jobs live in process memory, which means:
 *   - the app must run as ONE long-lived Node process (`next start`), not on a
 *     serverless platform and not behind a multi-worker cluster, or a poll can
 *     land on a worker that has never heard of the job
 *   - a restart mid-generation loses the job (the images and the charge are
 *     already persisted, so nothing is lost but the progress view)
 *
 * If this ever needs to scale past one box, this module is the seam to replace
 * with Redis or a Mongo-backed queue.
 */
import 'server-only';
import crypto from 'node:crypto';
import type { Job, JobResult } from './types';

const JOB_TTL_MS = 60 * 60 * 1000; // keep finished jobs an hour for late polls

declare global {
  // eslint-disable-next-line no-var
  var _aimagegenJobs: Map<string, Job> | undefined;
}

const jobs: Map<string, Job> = (global._aimagegenJobs ??= new Map());

/** Drop jobs older than the TTL so a long-running server can't leak memory. */
function sweep(): void {
  const cutoff = Date.now() - JOB_TTL_MS;
  for (const [id, job] of jobs) {
    if (job.createdAt < cutoff) jobs.delete(id);
  }
}

export function createJob(total: number): string {
  sweep();
  const id = crypto.randomBytes(4).toString('hex');
  jobs.set(id, { status: 'running', total, done: 0, results: [], createdAt: Date.now() });
  return id;
}

export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}

export function pushResult(id: string, result: JobResult): void {
  const job = jobs.get(id);
  if (!job) return;
  job.results.push(result);
  job.done += 1;
}

export function patchJob(id: string, patch: Partial<Job>): void {
  const job = jobs.get(id);
  if (!job) return;
  Object.assign(job, patch);
}

export function finishJob(id: string, productId?: string): void {
  patchJob(id, { status: 'done', ...(productId ? { product_id: productId } : {}) });
}

/**
 * Run background work without blocking the response.
 *
 * A rejection here would otherwise be an unhandled promise rejection that can
 * take the whole Node process down, so every task is wrapped: the job is marked
 * done and the error surfaced as a result the UI can render.
 */
export function runBackground(jobId: string, task: () => Promise<void>): void {
  void (async () => {
    try {
      await task();
    } catch (e) {
      console.error('[jobs] background task failed', e);
      const job = jobs.get(jobId);
      if (job) {
        job.results.push({
          pose: 'error',
          error: (e as Error)?.message || 'Generation failed unexpectedly.',
        });
        job.done += 1;
      }
    } finally {
      patchJob(jobId, { status: 'done' });
    }
  })();
}