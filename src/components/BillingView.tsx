'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getJson, fmt } from '@/lib/client/api';
import { money, invoiceDate } from '@/lib/invoice';
import { EmptyState } from './ui';

interface Row {
  order_id: string;
  invoice_no: string | null;
  date: string;
  status: 'created' | 'paid' | 'failed';
  label: string;
  credits: number;
  amount: number;
  currency: string;
  payment_id: string | null;
}

const STATUS: Record<Row['status'], { text: string; cls: string }> = {
  paid: { text: 'Paid', cls: 'bg-green-soft text-green' },
  failed: { text: 'Failed', cls: 'bg-brand-soft text-brand' },
  // An order that was started but never completed — the user closed Checkout.
  created: { text: 'Incomplete', cls: 'bg-surface2 text-muted' },
};

/** Payment history and invoices. */
export default function BillingView({ balance }: { balance: number }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getJson<{ rows: Row[] }>('/api/billing')
      .then((j) => setRows(j.rows))
      .catch(() => setError('Could not load your billing history.'));
  }, []);

  const paid = rows?.filter((r) => r.status === 'paid') ?? [];
  const totalPaid = paid.reduce((s, r) => s + r.amount, 0);
  const totalCredits = paid.reduce((s, r) => s + r.credits, 0);

  return (
    <div className="animate-fade-up max-w-[980px]">
      <div className="mb-[18px] flex flex-wrap gap-2.5">
        <Stat label="Current balance" value={`${fmt(balance)} credits`} />
        <Stat label="Credits purchased" value={fmt(totalCredits)} />
        <Stat label="Total paid" value={money(totalPaid)} />
      </div>

      <div className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
        <div className="flex items-center gap-3 border-b border-line p-[14px_16px]">
          <h3 className="text-[15px] font-bold">Billing history</h3>
          <span className="text-[11px] text-muted">
            {rows ? `${rows.length} transaction${rows.length === 1 ? '' : 's'}` : ''}
          </span>
          <div className="flex-1" />
          <Link
            href="/recharge"
            className="rounded-lg bg-surface2 px-3 py-[7px] text-xs font-semibold text-ink hover:bg-line"
          >
            + Add credits
          </Link>
        </div>

        {error && <div className="p-6 text-[12.5px] font-semibold text-brand">{error}</div>}

        {!rows && !error && <div className="p-6 text-[12.5px] text-muted">Loading…</div>}

        {rows && rows.length === 0 && (
          <div className="p-4">
            <EmptyState icon="🧾" title="No payments yet">
              Your invoices will appear here once you buy credits.
            </EmptyState>
          </div>
        )}

        {rows && rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[12.5px]">
              <thead>
                <tr className="text-[10.5px] uppercase tracking-[0.06em] text-muted">
                  <Th>Date</Th>
                  <Th>Invoice</Th>
                  <Th>Description</Th>
                  <Th right>Credits</Th>
                  <Th right>Amount</Th>
                  <Th>Status</Th>
                  <Th right>Invoice</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const st = STATUS[r.status];
                  return (
                    <tr key={r.order_id} className="border-t border-line">
                      <Td>{invoiceDate(r.date)}</Td>
                      <Td>
                        <span className="font-semibold">{r.invoice_no ?? '—'}</span>
                      </Td>
                      <Td>{r.label}</Td>
                      <Td right>{r.status === 'paid' ? fmt(r.credits) : '—'}</Td>
                      <Td right>{money(r.amount)}</Td>
                      <Td>
                        <span
                          className={`inline-block rounded-md px-2 py-[3px] text-[10.5px] font-bold ${st.cls}`}
                        >
                          {st.text}
                        </span>
                      </Td>
                      <Td right>
                        {r.status === 'paid' ? (
                          <Link
                            href={`/invoice/${r.order_id}`}
                            className="font-bold text-accent hover:underline"
                          >
                            View
                          </Link>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="mt-3 text-[11px] leading-[1.5] text-muted">
        Credits are prepaid and non-refundable once used. For a billing query, quote the invoice
        number.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[150px] flex-1 rounded-card border border-line bg-surface p-[14px_16px] shadow-card">
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted">
        {label}
      </div>
      <div className="mt-1 text-[19px] font-bold tabular-nums">{value}</div>
    </div>
  );
}

const Th = ({ children, right }: { children: React.ReactNode; right?: boolean }) => (
  <th className={`p-[10px_14px] font-bold ${right ? 'text-right' : 'text-left'}`}>{children}</th>
);

const Td = ({ children, right }: { children: React.ReactNode; right?: boolean }) => (
  <td className={`p-[11px_14px] ${right ? 'text-right tabular-nums' : ''}`}>{children}</td>
);