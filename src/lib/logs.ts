/**
 * The append-only event log that powers the Logs and Usage tabs.
 *
 * Was data/logs.jsonl; now a MongoDB collection. Rows are never updated — one
 * document per AI call (image, character-sheet frame, or Genie improvement).
 */
import 'server-only';
import { logs } from './mongo';
import { TOKEN_RATES_USD, TOKEN_RATE_DEFAULT } from './config';
import { nowIso } from './auth';
import type { LogDoc } from './types';

/**
 * USD spent on one AI call. Unknown model → the default rate. Never throws:
 * a costing slip must not be able to fail a generation that already succeeded.
 */
export function usdCost(
  modelId: string | undefined,
  inTok: number | undefined,
  outTok: number | undefined,
): number {
  try {
    const rate = TOKEN_RATES_USD[modelId ?? ''] ?? TOKEN_RATE_DEFAULT;
    const v =
      ((Number(inTok ?? 0) || 0) * (Number(rate.in) || 0) +
        (Number(outTok ?? 0) || 0) * (Number(rate.out) || 0)) /
      1_000_000;
    return Math.round(v * 1e6) / 1e6;
  } catch {
    return 0;
  }
}

/**
 * USD for a log row — the stored value when present, otherwise priced from the
 * row's token counts so rows written before this column existed still show a cost.
 */
export function rowUsd(r: LogDoc): number {
  if (r.usd !== undefined && r.usd !== null && (r.usd as unknown) !== '') {
    const n = Number(r.usd);
    if (Number.isFinite(n)) return n;
  }
  return usdCost(r.ai_model, r.in_tok, r.out_tok);
}

/**
 * Write one event. Fire-and-forget by design — logging must never be the reason
 * a successful generation reports failure, so errors are swallowed.
 */
export async function logEvent(row: Partial<LogDoc> & { type: LogDoc['type'] }): Promise<void> {
  try {
    const col = await logs();
    await col.insertOne({
      ts: nowIso(),
      status: 'success',
      cost: 0,
      ...row,
    } as LogDoc);
  } catch (e) {
    console.error('[logs] failed to write event', e);
  }
}