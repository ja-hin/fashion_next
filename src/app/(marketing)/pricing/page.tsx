import type { Metadata } from 'next';
import Script from 'next/script';
import { getBilling, getSettings } from '@/lib/settings';
import { ensureBootstrapped } from '@/lib/bootstrap';
import {
  activePacks,
  packCredits,
  rupees,
  savingsPct,
  bonusPct,
  effectiveRate,
} from '@/lib/pricing';

export const runtime = 'nodejs';
// Packs are admin-editable, so this must never be cached into a stale price.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Pricing — Prepaid AI Fashion Photo Credits | AImageGen',
  description:
    'Simple prepaid credits for on-model AI fashion photography. No subscription, no minimum SKUs. Buy a pack or a custom amount — GST-inclusive, pay only for what you generate.',
  alternates: { canonical: 'https://aimagegen.com/pricing' },
};

/**
 * Public pricing page.
 *
 * A server component so the packs an admin has configured are in the HTML —
 * a price rendered client-side after a fetch is invisible to search engines and
 * flashes empty on load. Uses the landing design system from public/landing.css
 * (loaded by the marketing layout), not the studio's.
 */
export default async function PricingPage() {
  await ensureBootstrapped();
  const cfg = await getBilling();
  const settings = await getSettings();
  const packs = activePacks(cfg);
  const gstPct = Math.round(cfg.gst_rate * 100);

  // The cheapest shoot — an imagined model at 1K — is what the "per photo"
  // figure on each card is quoted against, so it is always a genuine floor
  // rather than a rate some options undercut.
  const creditsPerPhoto = Number(settings.prices?.imagine?.['1K'] ?? settings.price_per_image ?? 1);

  const faq = [
    [
      'Do credits expire?',
      'Credits stay on your account for 12 months from the date of purchase. There is no monthly commitment and nothing renews automatically.',
    ],
    [
      'What does one image cost?',
      'It depends on the shoot. An imagined model at 1K is the cheapest option; a saved model and higher resolutions cost more credits per image. The exact rate is always shown before you generate.',
    ],
    [
      'Is GST included?',
      gstPct > 0
        ? `Yes. Every price on this page already includes ${gstPct}% GST, and you get a proper tax invoice for each payment from your Billing tab.`
        : 'The prices on this page are the final amount charged. A receipt for each payment is available from your Billing tab.',
    ],
    [
      'How do I pay?',
      'Through Razorpay — UPI, cards, net banking and wallets. We never see or store your card details.',
    ],
    [
      'Can I get a refund?',
      'Unused credits can be refunded within 7 days of purchase. Credits already spent on generated images cannot be refunded.',
    ],
  ];

  return (
    <>
      <header className="nav" id="nav">
        <div className="wrap nav-in">
          <a className="logo" href="/" aria-label="AImageGen home">
            {/* eslint-disable @next/next/no-img-element */}
            <img className="logo-img logo-light" src="/logo-black.png" alt="AImageGen" />
            <img className="logo-img logo-dark" src="/logo-white.png" alt="AImageGen" />
            {/* eslint-enable @next/next/no-img-element */}
          </a>
          <nav className="nav-links">
            <a href="/#story">Why</a>
            <a href="/#features">Features</a>
            <a href="/#demo">See it run</a>
            <a href="/pricing">Pricing</a>
          </nav>
          <div className="nav-right">
            <button className="mode" id="modeBtn" aria-label="Toggle light and dark mode">
              <span className="orb" />
              <span className="txt" id="modeTxt">
                Dark
              </span>
            </button>
            <a href="/login" className="btn btn-line" style={{ padding: '.6em 1.2em' }}>
              Log in
            </a>
            <a href="/register" className="btn btn-flame" style={{ padding: '.6em 1.2em' }}>
              Register <span className="arw">→</span>
            </a>
          </div>
        </div>
      </header>

      <main style={{ paddingTop: 130 }}>
        <section className="wrap" style={{ textAlign: 'center', paddingBottom: 10 }}>
          <span className="eyebrow">Pricing</span>
          <h1
            style={{
              fontFamily: 'var(--serif)',
              fontSize: 'clamp(2.4rem,6vw,4.4rem)',
              lineHeight: 1.05,
              margin: '18px auto 0',
              maxWidth: '16ch',
            }}
          >
            Prepaid credits. <em style={{ fontStyle: 'italic', color: 'var(--flame)' }}>No
            subscription.</em>
          </h1>
          <p
            style={{
              color: 'var(--dim)',
              maxWidth: '52ch',
              margin: '24px auto 0',
              fontSize: '1.02rem',
            }}
          >
            Buy credits once and spend them whenever you shoot. No seats, no minimum SKUs, no
            monthly fee{gstPct > 0 ? ' — and every price below already includes GST' : ''}.
          </p>
        </section>

        <section className="wrap" style={{ padding: '54px 32px 20px' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))',
              gap: 20,
              alignItems: 'stretch',
            }}
          >
            {packs.map((p) => {
              const total = packCredits(p);
              const save = savingsPct(p, cfg);
              const perPhoto = Math.round(effectiveRate(p) * creditsPerPhoto);
              return (
                <div
                  key={p.id}
                  style={{
                    position: 'relative',
                    background: 'var(--card)',
                    border: p.popular
                      ? '1.5px solid var(--flame)'
                      : '1px solid var(--line)',
                    borderRadius: 3,
                    padding: '30px 26px 26px',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: p.popular ? 'var(--shadow)' : 'none',
                  }}
                >
                  {p.popular && <span className="badge">Most popular</span>}

                  <span className="k-label">{p.name}</span>
                    {p.blurb && (
                      <p
                        style={{
                          color: 'var(--dim)',
                          fontSize: '.84rem',
                          marginTop: 6,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {p.blurb}
                      </p>
                    )}
                  <div
                    style={{
                      fontFamily: 'var(--serif)',
                      fontSize: '2.6rem',
                      lineHeight: 1.1,
                      marginTop: 12,
                    }}
                  >
                    {rupees(p.paise)}
                  </div>

                  <div style={{ marginTop: 10, fontSize: '1.05rem', fontWeight: 600 }}>
                    {total.toLocaleString('en-IN')} credits
                  </div>

                  {p.bonus > 0 && (
                    <>
                      {/*
                        Labels and figures are two grid columns rather than one
                        flowed line, so the numbers line up down the card and
                        across cards whatever the label length.
                      */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'auto auto',
                          justifyContent: 'start',
                          columnGap: 8,
                          rowGap: 2,
                          marginTop: 8,
                          fontSize: '1rem',
                          color: 'var(--dim)',
                        }}
                      >
                        <span>Base Credit:</span>
                        <b style={{ color: 'var(--text)' }}>
                          {p.credits.toLocaleString('en-IN')}
                        </b>
                        <span>Bonus Credit:</span>
                        <b style={{ color: 'var(--mint)' }}>
                          {p.bonus.toLocaleString('en-IN')}
                        </b>
                      </div>
                      <div
                        style={{
                          color: 'var(--mint)',
                          fontSize: '.82rem',
                          fontWeight: 600,
                          marginTop: 4,
                        }}
                      >
                        ( {bonusPct(p)}% Extra Credits )
                      </div>
                    </>
                  )}

                  {/* <div style={{ color: 'var(--muted)', fontSize: '.82rem', marginTop: 8 }}>
                    {rupees(Math.round(p.paise / total))} per credit
                    {save > 0 && (
                      <span style={{ color: 'var(--mint)', fontWeight: 700 }}> · save {save}%</span>
                    )}
                  </div> */}

                  {/*
                    Everything above is what you buy; everything below is what
                    it works out to. The rule marks that break so the per-photo
                    figure reads as the takeaway, not another pack line item.
                  */}
                  <div
                    style={{
                      borderTop: '1px solid var(--line-soft)',
                      marginTop: 18,
                      paddingTop: 14,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                      <span
                        style={{
                          fontFamily: 'var(--serif)',
                          fontSize: '1.5rem',
                          lineHeight: 1.1,
                        }}
                      >
                        {rupees(perPhoto)}
                      </span>
                      <span style={{ color: 'var(--dim)', fontSize: '.88rem' }}>per photo</span>
                    </div>

                    
                  </div>

                  <div style={{ flex: 1, minHeight: 18 }} />

                  <a
                    href="/register"
                    className={`btn ${p.popular ? 'btn-flame' : 'btn-line'}`}
                    style={{ justifyContent: 'center', marginTop: 18 }}
                  >
                    Get started <span className="arw">→</span>
                  </a>
                </div>
              );
            })}
          </div>

          {packs.length === 0 && (
            <p style={{ textAlign: 'center', color: 'var(--dim)' }}>
              Packs are being updated — please check back shortly.
            </p>
          )}

          {cfg.custom_enabled && (
            <div
              style={{
                marginTop: 22,
                border: '1px dashed var(--line)',
                borderRadius: 3,
                padding: '22px 26px',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 18,
              }}
            >
              <div>
                <span className="k-label">Custom amount</span>
                <p style={{ marginTop: 8, color: 'var(--dim)', fontSize: '.92rem' }}>
                  Need something in between? Buy any amount from{' '}
                  {cfg.custom_min_credits.toLocaleString('en-IN')} to{' '}
                  {cfg.custom_max_credits.toLocaleString('en-IN')} credits at{' '}
                  <b style={{ color: 'var(--text)' }}>{rupees(cfg.paise_per_credit)}</b> per credit.
                </p>
              </div>
              <div style={{ flex: 1 }} />
              <a href="/register" className="btn btn-line">
                Start now <span className="arw">→</span>
              </a>
            </div>
          )}
        </section>

        <section className="wrap faq" style={{ paddingTop: 70 }}>
          <span className="eyebrow">Questions</span>
          <h2
            style={{
              fontFamily: 'var(--serif)',
              fontSize: 'clamp(1.9rem,4vw,3rem)',
              margin: '14px 0 34px',
            }}
          >
            Before you buy
          </h2>
          <div style={{ display: 'grid', gap: 2, maxWidth: 780 }}>
            {faq.map(([q, a]) => (
              <details
                key={q}
                style={{ borderTop: '1px solid var(--line-soft)', padding: '18px 0' }}
              >
                <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: '1rem' }}>
                  {q}
                </summary>
                <p style={{ color: 'var(--dim)', marginTop: 12, maxWidth: '62ch' }}>{a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <footer>
        <div className="wrap fbot">
          <span>© 2026 3rd i Visuals Pvt Ltd · AImageGen™</span>
          <span>
            Prices in ₹ (INR){gstPct > 0 ? ` · incl. ${gstPct}% GST` : ''} · Prepaid credits · Valid
            12 months
          </span>
        </div>
      </footer>

      {/* Shares the landing script purely for the light/dark toggle. */}
      <Script src="/landing.js" strategy="afterInteractive" />
    </>
  );
}