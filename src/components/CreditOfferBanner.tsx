'use client';

import { useState } from 'react';
import { postForm, ApiError } from '@/lib/client/api';

/**
 * The complimentary-credits offer , ported from public/leads.html.
 *
 * Two steps, because they ask different things. The banner is a pitch and
 * costs one click to leave; the form is six fields and only appears once
 * someone has said they want it. Showing the form outright would put a
 * questionnaire in front of a customer who came to make a photograph.
 *
 * Shown on first sign-in, and again when the balance runs down to a fifth of
 * the last grant , see lib/offer.ts, which decides. Clicking outside does NOT
 * dismiss: an accidental tap on the page behind should not spend the one
 * chance this account gets to see it.
 */

const CHANNELS = [
  'Own website',
  'Amazon',
  'Flipkart',
  'Myntra',
  'Nykaa Fashion',
  'Other',
];
const VOLUMES = ['Under 50', '50–100', '101–250', '251–500', '501–1,000', '1,000+'];
const USE_CASES = [
  'E-commerce catalogue',
  'Marketplace listings',
  'Campaign / social content',
  'Product launch / lookbook',
  'Multiple use cases',
  'Other',
];

export default function CreditOfferBanner({
  reason,
  mark,
  onClose,
}: {
  reason: string;
  mark: number;
  onClose: () => void;
}) {
  const [step, setStep] = useState<'banner' | 'form' | 'done'>('banner');
  const [brand, setBrand] = useState('');
  const [website, setWebsite] = useState('');
  const [channels, setChannels] = useState<string[]>([]);
  const [volume, setVolume] = useState('');
  const [useCase, setUseCase] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const low = reason === 'low';

  /** Dismissing is recorded, so the banner can stay quiet for a week. */
  async function dismiss() {
    onClose();
    try {
      await postForm('/api/offer', { action: 'dismiss' });
    } catch {
      /* Closing must never fail in front of the customer. Worst case it is
         offered again next load, which is a far smaller harm than a modal
         that will not shut. */
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErr('');
    try {
      await postForm('/api/offer', {
        brand,
        website,
        channels: JSON.stringify(channels),
        volume,
        use_case: useCase,
        message,
      });
      setStep('done');
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : 'Could not send that , please try again.');
    } finally {
      setBusy(false);
    }
  }

  const toggle = (c: string) =>
    setChannels((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]));

  return (
    <div className="fixed inset-0 z-[99990] flex items-center justify-center bg-black/25 p-4 backdrop-blur-[5px]">
      <div className="max-h-full w-full max-w-[620px] overflow-y-auto rounded-[28px] border border-line bg-surface shadow-[0_28px_80px_rgba(24,24,27,.18)]">
        {/* The brand rule along the top, straight from the reference. */}
        <div className="h-1 rounded-t-[28px] bg-gradient-to-r from-brand via-brand/60 to-brand/20" />

        {step === 'done' ? (
          <div className="px-8 py-10 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green/10 text-[22px] text-green">
              ✓
            </div>
            <h2 className="text-[19px] font-bold">Request received</h2>
            <p className="mx-auto mt-2 max-w-[420px] text-[13px] leading-[1.65] text-muted">
              Thanks. We&apos;ll review your details, and someone from our team may contact you by
              phone or email to understand your requirements and take the discussion forward.
            </p>
            <button onClick={onClose} className="mt-6 rounded-[11px] bg-ink px-6 py-2.5 text-[13px] font-bold text-surface">
              Close
            </button>
          </div>
        ) : step === 'form' ? (
          <form onSubmit={submit} className="px-7 pb-7 pt-6">
            <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-brand">
              Complimentary credit access
            </div>
            <h2 className="mt-1.5 text-[18px] font-bold">Tell us a little about your business</h2>
            <p className="mt-1 text-[12.5px] leading-[1.6] text-muted">
              A few quick details help us understand your usage and decide the right credit
              allocation.
            </p>

            <div className="mt-5 grid gap-3.5 sm:grid-cols-2">
              <Field label="Brand / company name" required>
                <input
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  required
                  maxLength={160}
                  placeholder="e.g. North &amp; Loom"
                  className={inputCls}
                />
              </Field>
              <Field label="Website / store URL" required>
                <input
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  required
                  maxLength={300}
                  placeholder="https://yourbrand.com"
                  className={inputCls}
                />
              </Field>
            </div>

            <div className="mt-3.5">
              <span className="lbl">Where do you currently sell?</span>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {CHANNELS.map((c) => {
                  const on = channels.includes(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => toggle(c)}
                      aria-pressed={on}
                      className={`rounded-[20px] border px-3 py-1.5 text-[12px] font-semibold transition ${
                        on
                          ? 'border-ink bg-ink text-surface'
                          : 'border-line bg-surface text-muted hover:border-ink hover:text-ink'
                      }`}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-3.5 grid gap-3.5 sm:grid-cols-2">
              <Field label="Approx. images needed per month" required>
                <select
                  value={volume}
                  onChange={(e) => setVolume(e.target.value)}
                  required
                  className={inputCls}
                >
                  <option value="">Select a range</option>
                  {VOLUMES.map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </Field>
              <Field label="Primary use case" required>
                <select
                  value={useCase}
                  onChange={(e) => setUseCase(e.target.value)}
                  required
                  className={inputCls}
                >
                  <option value="">Select a use case</option>
                  {USE_CASES.map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="mt-3.5">
              <span className="lbl">Anything specific you&apos;d like us to know?</span>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={4000}
                rows={3}
                placeholder="For example: number of SKUs, image styles, model diversity, campaign frequency, video needs…"
                className={`${inputCls} mt-1.5 resize-y`}
              />
            </div>

            {err && <div className="mt-3 text-[12px] font-semibold text-brand">{err}</div>}

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <p className="min-w-0 flex-1 text-[11px] leading-[1.5] text-muted">
                Your account contact details are used only to follow up on this request and
                related Faishon Studio services.
              </p>
              <button type="button" onClick={() => setStep('banner')} className="text-[12.5px] font-bold text-muted hover:text-ink">
                Back
              </button>
              <button
                type="submit"
                disabled={busy}
                className="rounded-[11px] bg-brand px-5 py-2.5 text-[13px] font-bold text-white disabled:opacity-50"
              >
                {busy ? 'Sending…' : 'Submit request'}
              </button>
            </div>
          </form>
        ) : (
          <div className="relative px-7 pb-7 pt-6">
            <button
              onClick={dismiss}
              aria-label="Close"
              className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full text-[17px] text-muted transition hover:bg-surface2 hover:text-ink"
            >
              ×
            </button>

            <span className="inline-flex items-center gap-2 rounded-[999px] border border-brand-soft bg-brand-soft px-2.5 py-1.5 text-[11.5px] font-bold text-brand">
              <span className="h-1.5 w-1.5 rounded-full bg-brand" />
              {low ? 'Credits running low' : 'Private credit access'}
            </span>

            {/* The headline is the one thing that changes between the two
                moments: an introduction on the first visit, and a reason on the
                day the balance is nearly gone. */}
            <h2 className="mt-3.5 text-[22px] font-bold leading-[1.25]">
              {low
                ? `You're down to your last ${mark} credits.`
                : 'Your first credits are on us.'}
            </h2>
            <p className="mt-2 max-w-[460px] text-[13px] leading-[1.65] text-muted">
              If you are a fashion brand or seller with regular image needs, you may qualify for
              additional complimentary credits and priority access.
            </p>

            <div className="mt-5 grid gap-2.5 sm:grid-cols-3">
              {[
                ['Built for brands', 'For regular catalogue, campaign and marketplace content.'],
                [
                  'Complimentary credits',
                  'Selected business accounts may receive an additional credit allocation.',
                ],
                [
                  'Priority review',
                  'Tell us your use case and our team can take the discussion forward.',
                ],
              ].map(([t, d]) => (
                <div key={t} className="rounded-card border border-line bg-surface2 p-3">
                  <b className="block text-[12.5px]">{t}</b>
                  <span className="mt-1 block text-[11.5px] leading-[1.5] text-muted">{d}</span>
                </div>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                onClick={() => setStep('form')}
                className="rounded-[11px] bg-brand px-5 py-3 text-[13.5px] font-bold text-white transition hover:-translate-y-px"
              >
                Request complimentary credits
              </button>
              <span className="text-[11px] font-semibold text-muted">
                Limited approvals • For business accounts
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const inputCls =
  'w-full rounded-[10px] border border-line bg-bg px-3 py-2.5 text-[13px] text-ink';

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block min-w-0">
      <span className="lbl">
        {label}
        {required && <span className="text-brand"> *</span>}
      </span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
