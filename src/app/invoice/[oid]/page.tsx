import { redirect } from 'next/navigation';
import { ensureBootstrapped } from '@/lib/bootstrap';
import { currentUser } from '@/lib/auth';
import { invoiceFor } from '@/lib/billing';
import { money, amountInWords, invoiceDate } from '@/lib/invoice';
import PrintButton from './PrintButton';
import type { Metadata } from 'next';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Invoice',
  robots: { index: false, follow: false },
};

/**
 * A printable tax invoice.
 *
 * Rendered as a plain, self-contained page rather than a generated PDF: the
 * browser's own "Save as PDF" produces a correct A4 document, and every PDF
 * library for Node either ships a headless browser or renders Indian rupee
 * glyphs badly. Deliberately outside the (studio) group so none of the app
 * chrome or the dark theme reaches it.
 */
export default async function InvoicePage({
  params,
}: {
  params: Promise<{ oid: string }>;
}) {
  await ensureBootstrapped();
  const { oid } = await params;

  const me = await currentUser();
  if (!me) redirect('/login');

  let inv;
  try {
    inv = await invoiceFor(oid, me);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Invoice unavailable.';
    return (
      <main style={{ font: '15px/1.6 system-ui, sans-serif', padding: 40, color: '#111' }}>
        <h1 style={{ fontSize: 18 }}>Invoice unavailable</h1>
        <p style={{ color: '#666' }}>{msg}</p>
        <a href="/billing" style={{ color: '#e11d2a', fontWeight: 700 }}>
          ← Back to billing
        </a>
      </main>
    );
  }

  const { seller: s, buyer, tax } = inv;
  const cell: React.CSSProperties = { padding: '9px 12px', borderBottom: '1px solid #e6e6e6' };
  const th: React.CSSProperties = {
    ...cell,
    fontSize: 11,
    letterSpacing: '.05em',
    textTransform: 'uppercase',
    color: '#666',
    textAlign: 'left',
    borderBottom: '1.5px solid #ddd',
  };
  const num: React.CSSProperties = { textAlign: 'right', fontVariantNumeric: 'tabular-nums' };
  const label: React.CSSProperties = {
    fontSize: 10.5,
    letterSpacing: '.06em',
    textTransform: 'uppercase',
    color: '#888',
    marginBottom: 3,
  };

  return (
    <>
      <style>{`
        @page { size: A4; margin: 14mm; }
        @media print { .no-print { display: none !important; } body { background: #fff; } }
        body { background: #f4f4f5; margin: 0; }
      `}</style>

      <div
        style={{
          font: '13.5px/1.55 system-ui, -apple-system, Segoe UI, sans-serif',
          color: '#111',
          maxWidth: 820,
          margin: '0 auto',
          padding: 24,
        }}
      >
        <div className="no-print" style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <a
            href="/billing"
            style={{ color: '#666', fontWeight: 600, textDecoration: 'none', padding: '9px 0' }}
          >
            ← Billing
          </a>
          <div style={{ flex: 1 }} />
          <PrintButton />
        </div>

        <div style={{ background: '#fff', border: '1px solid #e6e6e6', borderRadius: 10, padding: 32 }}>
          {/* Header */}
          <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 19, fontWeight: 800 }}>{s.name || 'Your Company'}</div>
              {s.address && (
                <div style={{ color: '#666', whiteSpace: 'pre-line', marginTop: 4 }}>{s.address}</div>
              )}
              <div style={{ color: '#666', marginTop: 4 }}>
                {s.gstin && (
                  <>
                    GSTIN: <b style={{ color: '#111' }}>{s.gstin}</b>
                    <br />
                  </>
                )}
                {s.pan && (
                  <>
                    PAN: {s.pan}
                    <br />
                  </>
                )}
                {s.email}
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.02em' }}>
                {s.gstRegistered ? 'TAX INVOICE' : 'INVOICE'}
              </div>
              <div style={{ marginTop: 8, ...label }}>Invoice no.</div>
              <div style={{ fontWeight: 700 }}>{inv.invoice_no}</div>
              <div style={{ marginTop: 8, ...label }}>Date</div>
              <div style={{ fontWeight: 700 }}>{invoiceDate(inv.invoice_date)}</div>
            </div>
          </div>

          <div style={{ height: 1, background: '#e6e6e6', margin: '22px 0' }} />

          {/* Parties + refs */}
          <div style={{ display: 'flex', gap: 32 }}>
            <div style={{ flex: 1 }}>
              <div style={label}>Billed to</div>
              <div style={{ fontWeight: 700 }}>{buyer.email}</div>
              {buyer.gstin && <div style={{ color: '#666' }}>GSTIN: {buyer.gstin}</div>}
              {buyer.state && <div style={{ color: '#666' }}>{buyer.state}</div>}
            </div>
            <div style={{ flex: 1 }}>
              <div style={label}>Payment reference</div>
              <div style={{ color: '#666' }}>
                Order: {inv.order_id}
                <br />
                {inv.payment_id && <>Payment: {inv.payment_id}</>}
              </div>
            </div>
          </div>

          {/* Line items */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 24 }}>
            <thead>
              <tr>
                <th style={th}>Description</th>
                {s.gstRegistered && <th style={{ ...th, ...num }}>SAC</th>}
                <th style={{ ...th, ...num }}>Qty</th>
                <th style={{ ...th, ...num }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={cell}>
                  <b>{inv.description}</b>
                  <div style={{ color: '#666', fontSize: 12 }}>
                    Prepaid image generation credits
                  </div>
                </td>
                {s.gstRegistered && <td style={{ ...cell, ...num, color: '#666' }}>{s.sac}</td>}
                <td style={{ ...cell, ...num }}>{inv.credits}</td>
                <td style={{ ...cell, ...num }}>{money(tax.base)}</td>
              </tr>
            </tbody>
          </table>

          {/* Totals */}
          <div style={{ display: 'flex', marginTop: 18 }}>
            <div style={{ flex: 1 }} />
            <table style={{ borderCollapse: 'collapse', minWidth: 300 }}>
              <tbody>
                <tr>
                  <td style={{ padding: '5px 12px', color: '#666' }}>Taxable value</td>
                  <td style={{ padding: '5px 0', ...num }}>{money(tax.base)}</td>
                </tr>
                {s.gstRegistered && tax.interState && (
                  <tr>
                    <td style={{ padding: '5px 12px', color: '#666' }}>
                      IGST @ {tax.ratePct}%
                    </td>
                    <td style={{ padding: '5px 0', ...num }}>{money(tax.igst)}</td>
                  </tr>
                )}
                {s.gstRegistered && !tax.interState && (
                  <>
                    <tr>
                      <td style={{ padding: '5px 12px', color: '#666' }}>
                        CGST @ {tax.ratePct / 2}%
                      </td>
                      <td style={{ padding: '5px 0', ...num }}>{money(tax.cgst)}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '5px 12px', color: '#666' }}>
                        SGST @ {tax.ratePct / 2}%
                      </td>
                      <td style={{ padding: '5px 0', ...num }}>{money(tax.sgst)}</td>
                    </tr>
                  </>
                )}
                <tr>
                  <td
                    style={{
                      padding: '10px 12px',
                      borderTop: '1.5px solid #ddd',
                      fontWeight: 800,
                    }}
                  >
                    Total paid
                  </td>
                  <td
                    style={{
                      padding: '10px 0',
                      borderTop: '1.5px solid #ddd',
                      fontWeight: 800,
                      fontSize: 16,
                      ...num,
                    }}
                  >
                    {money(inv.amount)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 14, ...label }}>Amount in words</div>
          <div style={{ fontWeight: 600 }}>{amountInWords(inv.amount)}</div>

          <div
            style={{
              marginTop: 26,
              paddingTop: 16,
              borderTop: '1px solid #e6e6e6',
              color: '#888',
              fontSize: 11.5,
            }}
          >
            Paid online via Razorpay — this invoice is computer generated and valid without a
            signature.
            {!s.gstRegistered && (
              <>
                <br />
                GST not charged.
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}