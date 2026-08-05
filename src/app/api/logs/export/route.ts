import { handler, requireUser } from '@/lib/api';
import { logs } from '@/lib/mongo';
import { rowUsd } from '@/lib/logs';
import type { LogDoc } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COLUMNS = [
  'timestamp',
  'type',
  'seed',
  'pose',
  'category',
  'model',
  'status',
  'cost',
  'ai_model',
  'input_tokens',
  'output_tokens',
  'total_tokens',
  'cost_usd',
  'file',
];

/** RFC4180 quoting — a pose containing a comma or quote must not break the CSV. */
function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const GET = handler(async () => {
  const me = await requireUser();

  // Non-admins export only their own rows — same visibility rule as the table.
  const filter = me.is_admin ? {} : { user: me.email };
  const rows = (await (await logs()).find(filter).sort({ ts: 1 }).toArray()) as LogDoc[];

  const lines = [COLUMNS.join(',')];
  for (const r of rows) {
    const hasTokens = r.tot_tok || r.in_tok || r.out_tok;
    lines.push(
      [
        r.ts ?? '',
        r.type ?? '',
        r.seed ?? '',
        r.pose ?? '',
        r.category ?? '',
        r.model ?? '',
        r.status ?? '',
        r.cost ?? '',
        r.ai_model ?? '',
        r.in_tok ?? '',
        r.out_tok ?? '',
        r.tot_tok ?? '',
        hasTokens ? rowUsd(r).toFixed(6) : '',
        r.file ?? '',
      ]
        .map(csvCell)
        .join(','),
    );
  }

  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="aimagegen_logs.csv"',
    },
  });
});