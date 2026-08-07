'use client';

import { useCallback, useEffect, useState } from 'react';
import { getJson, fmtLogDate, fmtUsd } from '@/lib/client/api';
import { SearchBox, TableWrap, Th, Td, Pill } from './ui';
import type { LogsPayload, LbItem } from '@/lib/client/types';

/**
 * Logs (admin) and Usage (everyone) render the same data at two levels of
 * detail — Logs adds the AI model, token counts and our USD spend.
 */
export default function LogsView({
  variant,
  onZoom,
}: {
  variant: 'logs' | 'usage';
  onZoom: (items: LbItem[], index: number) => void;
}) {
  const [q, setQ] = useState('');
  const [frm, setFrm] = useState('');
  const [to, setTo] = useState('');
  const [model, setModel] = useState('');
  const [data, setData] = useState<LogsPayload | null>(null);

  const detailed = variant === 'logs';

  const load = useCallback(async () => {
    // Usage is a personal view for everyone, admins included — it asks the API
    // to scope the result to the caller's own rows.
    const p = new URLSearchParams({
      q,
      frm,
      to,
      ...(detailed ? { model } : { scope: 'own' }),
    });
    try {
      setData(await getJson<LogsPayload>(`/api/logs?${p}`));
    } catch {
      setData(null);
    }
  }, [q, frm, to, model, detailed]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  const rows = data?.rows ?? [];
  const summary = data?.summary;
  // The server reports is_admin false whenever the rows are one person's own,
  // so this is off in Usage even for an admin — the column would repeat the
  // same id on every line.
  const showUser = !!data?.is_admin;

  const fileCell = (r: LogsPayload['rows'][number]) =>
    r.img ? (
      <a
        href="#"
        onClick={(e) => {
          e.preventDefault();
          onZoom([{ url: r.img!, dl: r.img!, name: r.file ?? 'image.jpg' }], 0);
        }}
        className="text-brand hover:underline"
      >
        {r.file}
      </a>
    ) : (
      r.file
    );

  return (
    <div className="animate-fade-up">
      <div className="mb-[22px] flex flex-wrap items-center gap-3">
        <SearchBox
          value={q}
          onChange={setQ}
          placeholder={detailed ? 'Search logs…' : 'Search your usage…'}
        />
        <div className="flex items-center gap-2 text-xs text-muted">
          From
          <input
            type="date"
            value={frm}
            onChange={(e) => setFrm(e.target.value)}
            className="w-[148px]"
          />
          to
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-[148px]"
          />
        </div>

        {detailed && (
          <>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-auto px-2.5 py-2"
            >
              <option value="">All AI models</option>
              {(data?.models ?? []).map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <a
              href="/api/logs/export"
              className="ml-auto rounded-[9px] bg-surface2 px-[13px] py-2 text-[12.5px] font-semibold text-muted hover:bg-line hover:text-ink"
            >
              ⬇ Export CSV
            </a>
          </>
        )}
      </div>

      <TableWrap>
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <Th>Date / time</Th>
              {showUser && <Th>User ID</Th>}
              <Th>Shoot</Th>
              <Th>Pose</Th>
              <Th>Category</Th>
              <Th>Type</Th>
              <Th>Status</Th>
              <Th>{detailed ? 'Cost' : 'Credits'}</Th>
              {detailed && (
                <>
                  <Th>AI Model</Th>
                  <Th>In tok</Th>
                  <Th>Out tok</Th>
                  <Th>Total tok</Th>
                  <Th>Cost (USD)</Th>
                </>
              )}
              <Th>File</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="hover:bg-surface2">
                <Td mono>{fmtLogDate(r.ts)}</Td>
                {showUser && (
                  <Td mono>
                    <span className="font-bold" title={r.user ?? ''}>
                      {r.uid || '—'}
                    </span>
                  </Td>
                )}
                <Td mono>{r.shoot ?? (r.seed != null ? String(r.seed) : '')}</Td>
                <Td>{r.pose}</Td>
                <Td>{r.category}</Td>
                <Td>{r.type === 'genie' ? 'Genie' : 'Image'}</Td>
                <Td>
                  <Pill status={r.status} />
                </Td>
                <Td mono>{r.cost ?? 0}</Td>
                {detailed && (
                  <>
                    <Td mono>{r.ai_model ?? '—'}</Td>
                    <Td mono>{r.in_tok ?? ''}</Td>
                    <Td mono>{r.out_tok ?? ''}</Td>
                    <Td mono>{r.tot_tok ?? ''}</Td>
                    <Td mono>{fmtUsd(r.usd)}</Td>
                  </>
                )}
                <Td mono className="max-w-[220px] truncate">
                  {fileCell(r)}
                </Td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={(detailed ? 13 : 8) + (showUser ? 1 : 0)}
                  className="px-[14px] py-6 text-center text-muted"
                >
                  No activity in this range.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {summary && (
          <div className="flex flex-wrap gap-6 bg-surface2 p-[13px_14px] text-[12.5px] font-semibold">
            <span>
              Images: <b className="text-brand">{summary.images}</b>
            </span>
            <span>
              Credits spent: <b className="text-brand">{summary.credits}</b>
            </span>
            {detailed && (
              <>
                <span>
                  Genie uses: <b className="text-brand">{summary.genie}</b>
                </span>
                <span>
                  Total tokens: <b className="text-brand">{(summary.tokens ?? 0).toLocaleString()}</b>
                </span>
                <span>
                  AI spend: <b className="text-brand">${(summary.usd ?? 0).toFixed(4)}</b>
                </span>
              </>
            )}
          </div>
        )}
      </TableWrap>
    </div>
  );
}