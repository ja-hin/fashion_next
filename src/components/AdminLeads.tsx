'use client';

import { useCallback, useEffect, useState } from 'react';
import { getJson, postForm, fmtLogDate, ApiError } from '@/lib/client/api';
import { TableWrap, Th, Td, EmptyState } from './ui';
import { useDialog } from './Dialog';
import type { LeadDoc, LeadStatus } from '@/lib/types';

const STATUSES: LeadStatus[] = ['new', 'contacted', 'closed'];

const TONE: Record<LeadStatus, string> = {
  new: 'bg-brand-soft text-brand',
  contacted: 'bg-amber-soft text-amber',
  closed: 'bg-surface2 text-muted',
};

/**
 * Enquiries from the marketing page's contact form.
 *
 * A working list rather than a CRM: the useful questions are "who is waiting"
 * and "has anyone replied", so status is the only thing editable here. The
 * message is shown in full — truncating the one field that says what they
 * actually want would mean opening every row to read it.
 */
export default function AdminLeads() {
  const dialog = useDialog();
  const [rows, setRows] = useState<LeadDoc[]>([]);
  const [open, setOpen] = useState(0);
  const [only, setOnly] = useState<LeadStatus | 'all'>('all');
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const j = await getJson<{ leads: LeadDoc[]; open: number }>('/api/admin/leads');
      setRows(j.leads ?? []);
      setOpen(j.open ?? 0);
    } catch {
      setRows([]);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function setStatus(id: string, status: LeadStatus) {
    // Applied locally first: the round trip is fast but not instant, and a
    // dropdown that does not move when you pick something reads as broken.
    const before = rows;
    setRows((r) => r.map((l) => (l._id === id ? { ...l, status } : l)));
    setOpen((n) => {
      const was = before.find((l) => l._id === id)?.status;
      return n + (status === 'new' ? 1 : 0) - (was === 'new' ? 1 : 0);
    });
    try {
      await postForm('/api/admin/leads', { id, status });
    } catch (e) {
      setRows(before);
      await load();
      await dialog.alert(e instanceof ApiError ? e.message : 'Could not update that lead.');
    }
  }

  const shown = only === 'all' ? rows : rows.filter((l) => l.status === only);

  return (
    <div className="mb-4 rounded-card border border-line bg-surface p-[22px] shadow-card">
      <div className="mb-[5px] flex flex-wrap items-center gap-2.5">
        <h3 className="text-[15px] font-bold">Enquiries</h3>
        {open > 0 && (
          <span className="rounded-[20px] bg-brand-soft px-[9px] py-[3px] text-[10.5px] font-bold text-brand">
            {open} new
          </span>
        )}
      </div>
      <p className="mb-4 text-[12.5px] leading-[1.5] text-muted">
        Sent from the contact form on the landing page. Replying happens in your inbox — this is
        where you record that you have.
      </p>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {(['all', ...STATUSES] as const).map((s) => (
          <button
            key={s}
            onClick={() => setOnly(s)}
            className={`rounded-[20px] px-3 py-1 text-[12px] font-semibold capitalize ${
              only === s ? 'bg-ink text-surface' : 'bg-surface2 text-muted hover:text-ink'
            }`}
          >
            {s}
            {s !== 'all' && ` (${rows.filter((l) => l.status === s).length})`}
          </button>
        ))}
      </div>

      {loaded && !shown.length ? (
        <EmptyState icon="✉" title={rows.length ? 'Nothing in this state' : 'No enquiries yet'}>
          {rows.length
            ? 'Try another filter.'
            : 'They will appear here as soon as someone uses the contact form on the landing page.'}
        </EmptyState>
      ) : (
        <TableWrap>
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <Th>Received</Th>
                <Th>Who</Th>
                <Th>Contact</Th>
                <Th>Volume</Th>
                <Th>Message</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {shown.map((l) => (
                <tr key={l._id} className="align-top">
                  <Td mono>{fmtLogDate(l.created)}</Td>
                  <Td>
                    <div className="font-semibold">{l.name}</div>
                    {l.brand && <div className="text-[12px] text-muted">{l.brand}</div>}
                  </Td>
                  <Td>
                    {/* mailto rather than plain text: the reply is the whole
                        point of the row, so it should be one click away. */}
                    <a className="text-brand hover:underline" href={`mailto:${l.email}`}>
                      {l.email}
                    </a>
                    {l.phone && <div className="text-[12px] text-muted">{l.phone}</div>}
                  </Td>
                  <Td>{l.volume || '—'}</Td>
                  <Td className="max-w-[420px] whitespace-pre-wrap leading-[1.5]">{l.message}</Td>
                  <Td>
                    <select
                      value={l.status}
                      onChange={(e) => setStatus(l._id, e.target.value as LeadStatus)}
                      className={`cursor-pointer rounded-[20px] border-0 px-[9px] py-[3px] text-[10.5px] font-bold capitalize ${
                        TONE[l.status]
                      }`}
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    {l.handled && (
                      <div className="mt-1 text-[11px] text-muted">{fmtLogDate(l.handled)}</div>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}
    </div>
  );
}
