import { handler, json, requireUser } from '@/lib/api';
import { logs } from '@/lib/mongo';
import { rowUsd } from '@/lib/logs';
import type { WithId } from 'mongodb';
import type { LogDoc } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_ROWS = 1000;

export const GET = handler(async (req: Request) => {
  const me = await requireUser();
  const sp = new URL(req.url).searchParams;
  const q = (sp.get('q') ?? '').toLowerCase();
  const frm = sp.get('frm') ?? '';
  const to = sp.get('to') ?? '';
  const modelFilter = sp.get('model') ?? '';

  const filter: Record<string, unknown> = {};

  // Non-admins only ever see their own rows.
  if (!me.is_admin) filter.user = me.email;

  // ts is an ISO string, so a lexicographic range is also a chronological one.
  // `to` gets a ￿ suffix so the whole end day is included, not just midnight.
  if (frm || to) {
    const range: Record<string, string> = {};
    if (frm) range.$gte = frm;
    if (to) range.$lte = `${to}￿`;
    filter.ts = range;
  }

  const all = (await (await logs())
    .find(filter)
    .sort({ ts: -1 })
    .limit(20_000)
    .toArray()) as WithId<LogDoc>[];

  // Free-text search across the whole row, matching the old behaviour of
  // grepping the serialised JSON.
  const matched = q
    ? all.filter((r) => JSON.stringify(r).toLowerCase().includes(q))
    : all;

  // Build the AI-model dropdown from what's available BEFORE applying that filter.
  const aiModels = [...new Set(matched.map((r) => r.ai_model).filter(Boolean))].sort();

  const filtered = modelFilter
    ? matched.filter((r) => r.ai_model === modelFilter)
    : matched;

  const shown = filtered.slice(0, MAX_ROWS).map((r) => {
    const { _id: _drop, ...rest } = r;
    const out: Record<string, unknown> = { ...rest };
    if (r.tot_tok || r.in_tok || r.out_tok) out.usd = rowUsd(r);
    return out;
  });

  const images = filtered.filter((r) => r.type === 'image' && r.status !== 'uploaded');

  return json({
    rows: shown,
    models: aiModels,
    summary: {
      images: images.length,
      credits: Math.round(filtered.reduce((a, r) => a + Number(r.cost ?? 0), 0) * 100) / 100,
      genie: filtered.filter((r) => r.type === 'genie').length,
      tokens: filtered.reduce((a, r) => a + (Number(r.tot_tok ?? 0) || 0), 0),
      usd: Math.round(filtered.reduce((a, r) => a + rowUsd(r), 0) * 10_000) / 10_000,
    },
  });
});