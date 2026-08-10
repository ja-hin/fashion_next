'use client';

import { useEffect, useState } from 'react';
import { getJson, postForm, fmt, ApiError } from '@/lib/client/api';
import { rupees, gstBreakdown, bonusPct, type Pack } from '@/lib/pricing';
import { useDialog } from './Dialog';

const CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

/** Razorpay Checkout, injected at runtime. Only the fields we actually pass. */
interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (r: CheckoutResult) => void;
  prefill: { name: string; email: string };
  theme: { color: string };
  modal: { ondismiss: () => void };
}
interface CheckoutResult {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}
interface RazorpayInstance {
  open: () => void;
  on: (event: string, cb: (r: { error?: { description?: string } }) => void) => void;
}
declare global {
  interface Window {
    Razorpay?: new (o: RazorpayOptions) => RazorpayInstance;
  }
}

interface Config {
  payments_enabled: boolean;
  paise_per_credit: number;
  gst_rate: number;
  custom_enabled: boolean;
  min_credits: number;
  max_credits: number;
  packs: Pack[];
  balance: number;
}

interface OrderResp {
  key_id: string;
  order_id: string;
  amount: number;
  currency: string;
  credits: number;
  label: string;
  brand: string;
  name: string;
  email: string;
}

/** Load Checkout once. Resolves immediately if it's already on the page. */
function loadCheckout(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${CHECKOUT_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('load failed')));
      return;
    }
    const el = document.createElement('script');
    el.src = CHECKOUT_SRC;
    el.async = true;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error('load failed'));
    document.body.appendChild(el);
  });
}

/** Self-service top-up, paid through Razorpay. */
export default function RechargeView({
  balance,
  onBalance,
}: {
  balance: number;
  onBalance: (b: number) => void;
}) {
  const dialog = useDialog();
  const [cfg, setCfg] = useState<Config | null>(null);
  // Set once the config loads — packs are admin-managed, so no id can be
  // assumed to exist.
  const [selected, setSelected] = useState<string>('');
  const [custom, setCustom] = useState('');
  const [flash, setFlash] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getJson<Config>('/api/recharge')
      .then((c) => {
        setCfg(c);
        onBalance(c.balance);
        // Prefer whichever pack the admin flagged popular, else the first.
        const first = c.packs.find((p) => p.popular) ?? c.packs[0];
        setSelected(first ? first.id : c.custom_enabled ? 'custom' : '');
      })
      .catch(() => setCfg(null));
    // Runs once — onBalance is stable enough and re-running would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const usingCustom = selected === 'custom';
  const customN = Number(custom || 0);
  const customValid =
    !!cfg &&
    Number.isInteger(customN) &&
    customN >= cfg.min_credits &&
    customN <= cfg.max_credits;

  const pack = cfg?.packs.find((p) => p.id === selected) ?? null;
  const payPaise = usingCustom
    ? customValid
      ? customN * (cfg?.paise_per_credit ?? 0)
      : 0
    : (pack?.paise ?? 0);
  const payCredits = usingCustom ? (customValid ? customN : 0) : (pack?.credits ?? 0) + (pack?.bonus ?? 0);
  const canPay = !!cfg?.payments_enabled && payPaise > 0 && !busy;

  async function pay() {
    if (!canPay || !cfg) return;
    setBusy(true);
    setFlash('');
    try {
      await loadCheckout();
      if (!window.Razorpay) throw new Error('Checkout unavailable');

      // The server prices this — we send what was chosen, never an amount.
      const order = await postForm<OrderResp>(
        '/api/recharge/order',
        usingCustom ? { credits: customN } : { pack: selected },
      );

      const rzp = new window.Razorpay({
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        name: order.brand,
        description: order.label,
        order_id: order.order_id,
        prefill: { name: order.name, email: order.email },
        theme: { color: '#e11d2a' },
        modal: {
          // Closing the sheet is not a failure — the order simply stays unpaid.
          ondismiss: () => setBusy(false),
        },
        handler: async (r: CheckoutResult) => {
          try {
            const j = await postForm<{ balance: number; credits: number }>(
              '/api/recharge/verify',
              {
                razorpay_order_id: r.razorpay_order_id,
                razorpay_payment_id: r.razorpay_payment_id,
                razorpay_signature: r.razorpay_signature,
              },
            );
            onBalance(j.balance);
            setFlash(
              `Payment successful — ${j.credits} credits added. ` +
                'Removing the watermark from your images…',
            );
            // A first payment lifts the watermark from every image the account
            // has ever generated, but the ones already on screen were fetched
            // watermarked. Reload so `me` refreshes and each <img> revalidates
            // and comes back clean — the moment the customer is paying for.
            setTimeout(() => window.location.reload(), 1600);
          } catch (e) {
            // The money may well have gone through; the webhook is the backstop.
            await dialog.alert(
              e instanceof ApiError
                ? e.message
                : 'Payment went through but confirming it failed. Your balance will update shortly.',
            );
          } finally {
            setBusy(false);
          }
        },
      });

      rzp.on('payment.failed', (resp) => {
        setBusy(false);
        void dialog.alert(resp?.error?.description ?? 'The payment failed. Nothing was charged.');
      });

      rzp.open();
    } catch (e) {
      setBusy(false);
      await dialog.alert(e instanceof ApiError ? e.message : 'Could not start the payment.');
    }
  }

  const gst = payPaise > 0 && cfg ? gstBreakdown(payPaise, cfg.gst_rate) : null;

  return (
    <div className="animate-fade-up max-w-[880px]">
      <div className="rounded-card border border-line bg-surface p-[22px] shadow-card">
        <h3 className="mb-[5px] text-[15px] font-bold">Recharge credits</h3>
        <p className="mb-4 text-[12.5px] leading-[1.5] text-muted">
          Add image credits to your balance. Payments are handled by Razorpay — we never see your
          card details.
        </p>

        <div className="mb-4 text-[13px] font-semibold text-muted">
          Current balance: <b className="text-ink">{fmt(balance)}</b> credits
        </div>

        {cfg && !cfg.payments_enabled && (
          <div className="mb-4 rounded-lg bg-brand-soft px-3 py-2.5 text-[12px] font-semibold text-brand">
            Payments aren&apos;t configured yet. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to
            enable checkout.
          </div>
        )}

        {!cfg && <div className="text-[12.5px] text-muted">Loading packs…</div>}

        {cfg && (
          <>
            <div className="mb-3 grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-2.5">
              {cfg.packs.map((p) => {
                const on = selected === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelected(p.id)}
                    className={`relative rounded-[11px] border-[1.5px] p-[13px] text-left transition ${
                      on
                        ? 'border-brand bg-brand-soft'
                        : 'border-line bg-surface hover:border-brand'
                    }`}
                  >
                    {p.popular && (
                      <span className="absolute -top-2 right-2 rounded-[5px] bg-brand px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.05em] text-white">
                        Popular
                      </span>
                    )}
                    <div className="text-[12.5px] font-bold">{p.name}</div>
                    <div className="mt-0.5 text-[17px] font-bold text-ink">
                      {p.credits + p.bonus}
                      <span className="ml-1 text-[11px] font-semibold text-muted">credits</span>
                    </div>
                    {p.bonus > 0 && (
                      <>
                        {/* Two columns so the figures line up across every tile. */}
                        <div className="mt-1 grid grid-cols-[auto_auto] justify-start gap-x-1.5 text-[10.5px] text-muted">
                          <span>Base Credit:</span>
                          <b className="text-ink">{p.credits}</b>
                          <span>Bonus Credit:</span>
                          <b className="text-green">{p.bonus}</b>
                        </div>
                        <div className="text-[10.5px] font-semibold text-green">
                          ( {bonusPct(p)}% Extra Credits )
                        </div>
                      </>
                    )}
                    <div className="mt-1 text-[13px] font-bold text-brand">{rupees(p.paise)}</div>
                    <div className="mt-0.5 text-[10.5px] text-muted">{p.blurb}</div>
                  </button>
                );
              })}

              {cfg.custom_enabled && (
                <button
                  type="button"
                  onClick={() => setSelected('custom')}
                  className={`rounded-[11px] border-[1.5px] border-dashed p-[13px] text-left transition ${
                    usingCustom ? 'border-brand bg-brand-soft' : 'border-line hover:border-brand'
                  }`}
                >
                  <div className="text-[12.5px] font-bold">Custom</div>
                  <div className="mt-0.5 text-[11px] leading-[1.4] text-muted">
                    Any amount from {cfg.min_credits} to {cfg.max_credits} credits
                  </div>
                </button>
              )}
            </div>

            {usingCustom && (
              <div className="mb-3">
                <label className="lbl">Credits to add</label>
                <input
                  type="number"
                  min={cfg.min_credits}
                  max={cfg.max_credits}
                  step={1}
                  value={custom}
                  placeholder={String(cfg.min_credits)}
                  onChange={(e) => setCustom(e.target.value)}
                  className="max-w-[200px]"
                />
                {custom !== '' && !customValid && (
                  <div className="mt-1.5 text-[11px] font-semibold text-brand">
                    Enter a whole number between {cfg.min_credits} and {cfg.max_credits}.
                  </div>
                )}
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                  You pay
                </div>
                <div className="text-[22px] font-bold leading-tight">
                  {payPaise > 0 ? rupees(payPaise) : '—'}
                </div>
                {gst && (
                  <div className="text-[10.5px] text-muted">
                    {gst.gst > 0
                      ? `incl. ${Math.round((cfg?.gst_rate ?? 0) * 100)}% GST (${rupees(gst.gst)}) · `
                      : ''}
                    {payCredits} credits
                  </div>
                )}
              </div>

              <div className="flex-1" />

              <button
                onClick={pay}
                disabled={!canPay}
                className="rounded-[11px] bg-brand px-6 py-[13px] text-[14.5px] font-bold text-white transition hover:-translate-y-px disabled:translate-y-0 disabled:opacity-50"
              >
                {busy ? 'Opening…' : payPaise > 0 ? `Pay ${rupees(payPaise)}` : 'Pay'}
              </button>
            </div>

            {flash && (
              <div className="mt-3 text-[12.5px] font-semibold text-green">{flash}</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}