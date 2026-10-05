'use client';

import { useCallback, useEffect, useState } from 'react';
import { getJson, fmtLogDate, fmtUsd } from '@/lib/client/api';
import { SearchBox, TableWrap, Th, Td, Pill } from './ui';
import type { LogsPayload, LbItem } from '@/lib/client/types';

/**
 * Logs (admin) and Usage (everyone) render the same data at two levels of
 * detail , Logs adds the AI model, token counts and our USD spend.
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
    // Usage is a personal view for everyone, admins included , it asks the API
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
  // so this is off in Usage even for an admin , the column would repeat the
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
    /* `min-w-0 w-full` is load-bearing. LogsClient renders this inside a
       `flex` <main>, which makes this div a flex ITEM , and a flex item's
       default `min-width:auto` refuses to shrink below its content's intrinsic
       width. It was sizing itself to 845px inside a 390px phone and taking the
       page sideways with it, no matter what was hidden inside. */
    <div className="w-full min-w-0 animate-fade-up">
      <div className="mb-[22px] flex flex-wrap items-center gap-3">
        <SearchBox
          value={q}
          onChange={setQ}
          placeholder={detailed ? 'Search logs…' : 'Search your usage…'}
        />
        {/* Two 148px date inputs plus their labels need ~340px, which is wider
            than a phone's content column , and this row did not wrap, so the
            whole page scrolled sideways. The inputs now share the width they
            have and the group wraps onto its own line when it has to. */}
        <div className="flex w-full flex-wrap items-center gap-2 text-xs text-muted sm:w-auto">
          From
          <input
            type="date"
            value={frm}
            onChange={(e) => setFrm(e.target.value)}
            className="min-w-0 flex-1 sm:w-[148px] sm:flex-none"
          />
          to
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="min-w-0 flex-1 sm:w-[148px] sm:flex-none"
          />
        </div>

        {detailed && (
          <>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full min-w-0 px-2.5 py-2 sm:w-auto"
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
        {/* Thirteen columns cannot be made to fit a phone , they can only be
            scrolled sideways, which hides the two things anyone opens this
            screen for (what it cost, and whether it worked). The table is kept
            for the desktop it was designed for and a stacked list takes over
            below `sm`, the same split the Billing view already uses. */}
        <table className="hidden w-full border-collapse text-[13px] sm:table">
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
                      {r.uid || ','}
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
                    <Td mono>{r.ai_model ?? ','}</Td>
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

        {/* One card per row. Status and cost lead, because they are the
            question; the rest is context under them. */}
        <div className="divide-y divide-line sm:hidden">
          {rows.map((r, i) => (
            <div key={i} className="p-3.5">
              <div className="flex items-center gap-2">
                <Pill status={r.status} />
                <span className="ml-auto font-mono text-[13px] font-bold">
                  {detailed ? fmtUsd(r.usd) : `${r.cost ?? 0} cr`}
                </span>
              </div>

              <div className="mt-2 text-[12.5px] font-semibold leading-[1.4]">
                {r.pose || (r.type === 'genie' ? 'Genie' : 'Image')}
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-[11px] text-muted">
                <span>{fmtLogDate(r.ts)}</span>
                {r.shoot && <span>{r.shoot}</span>}
                {showUser && r.uid && (
                  <span className="font-bold" title={r.user ?? ''}>
                    {r.uid}
                  </span>
                )}
                {r.category && <span>{r.category}</span>}
              </div>

              {/* Only in the admin view, and only when there is something to
                  say , on a phone these are three extra lines of noise for
                  anyone who is not debugging a bill. */}
              {detailed && r.ai_model && (
                <div className="mt-1 font-mono text-[10.5px] text-muted">
                  {r.ai_model}
                  {r.tot_tok ? ` · ${r.tot_tok} tok` : ''}
                  {` · ${r.cost ?? 0} cr`}
                </div>
              )}

              <div className="mt-1.5 truncate font-mono text-[11px] text-muted">{fileCell(r)}</div>
            </div>
          ))}
          {rows.length === 0 && (
            <div className="px-4 py-6 text-center text-[12.5px] text-muted">
              No activity in this range.
            </div>
          )}
        </div>

        {summary && (
          <div className="flex flex-wrap gap-x-6 gap-y-1.5 bg-surface2 p-[13px_14px] text-[12.5px] font-semibold">
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