import type { Metadata } from 'next';
import Script from 'next/script';

/**
 * The public marketing homepage.
 *
 * Element ids and class names are load-bearing: `public/landing.js` drives the
 * scroll-pinned narrative, the cost counter, the feature rail and the contact
 * sheet animation by querying them. Renaming anything here silently breaks an
 * animation, so keep the hooks intact.
 */

export const metadata: Metadata = {
  title: 'AI Fashion Photography India — ₹25/Photo On-Model Shoots | AImageGen',
  description:
    'Turn one garment photo into a full on-model AI photoshoot. Consistent AI models, marketplace-ready images for Amazon, Flipkart & Myntra. From ₹25/photo, no minimum SKUs.',
  alternates: { canonical: 'https://aimagegen.com/' },
};

const ORG_LD = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'AImageGen',
  legalName: '3rd i Visuals Pvt Ltd',
  url: 'https://aimagegen.com/',
  logo: 'https://aimagegen.com/Webassets/front.jpg',
  description:
    'AI-powered on-model fashion photography platform for D2C brands, ecommerce sellers and agencies in India.',
  address: { '@type': 'PostalAddress', addressCountry: 'IN' },
};

const APP_LD = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'AImageGen',
  applicationCategory: 'DesignApplication',
  operatingSystem: 'Web',
  description:
    'AI fashion photography SaaS: turns a single garment photo into a full on-model photoshoot with consistent AI models, custom prompts, 2K/4K output and marketplace-ready framing for Amazon, Flipkart, Myntra and Meesho.',
  offers: [
    { '@type': 'Offer', name: 'Sampler — 50 photo credits', price: '499', priceCurrency: 'INR', url: 'https://aimagegen.com/#pricing' },
    { '@type': 'Offer', name: 'Studio — 500 photo credits', price: '3999', priceCurrency: 'INR', url: 'https://aimagegen.com/#pricing' },
    { '@type': 'Offer', name: 'Brand — 1600 photo credits', price: '11999', priceCurrency: 'INR', url: 'https://aimagegen.com/#pricing' },
    { '@type': 'Offer', name: 'Scale — 5000 photo credits', price: '34999', priceCurrency: 'INR', url: 'https://aimagegen.com/#pricing' },
  ],
};

const FAQS: Array<[string, string]> = [
  [
    'How much does an AI photoshoot cost in India?',
    'AImageGen produces on-model photos from ₹25 per photo on a prepaid credit wallet. A traditional ecommerce apparel photoshoot in India typically costs ₹250–₹2,500 per photo, plus model, studio and crew fees.',
  ],
  [
    'Can I use AI-generated photos on Amazon, Flipkart, Myntra and Meesho?',
    "Yes. AImageGen generates marketplace-ready, correctly framed on-model images. Always review each marketplace's current listing guidelines for your category before publishing.",
  ],
  [
    'Will the same model appear across my whole catalogue?',
    'Yes. You can save your own AI models and reuse them on every SKU — the same recognisable face across your entire catalogue, drop after drop.',
  ],
  [
    'Is there a minimum number of SKUs or photos?',
    'No minimums. Traditional studios often require 100+ SKUs per shoot; with AImageGen you can shoot a single garment or a thousand.',
  ],
  [
    'Can I come back later and continue a shoot?',
    'Yes. Every shoot is saved with its model, look and lighting. Restart weeks later — for a new colourway or a missing angle — with full continuity and no re-booking.',
  ],
  [
    'What image resolution do I get?',
    'Standard output is optimised for product pages and social. Native 2K and 4K renders are available for web heroes, print and billboards — true native resolution, not upscaled.',
  ],
  [
    'Do I need a subscription?',
    'No. AImageGen is prepaid: load an INR credit wallet (GST invoice available) and spend it whenever you shoot. Credits stay valid for 12 months.',
  ],
];

const FAQ_LD = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQS.map(([q, a]) => ({
    '@type': 'Question',
    name: q,
    acceptedAnswer: { '@type': 'Answer', text: a },
  })),
};

const RAIL_CARDS = [
  {
    idx: '01 / FULL DIRECTION',
    h: 'Any model. Any pose. Any backdrop. Any mood.',
    p: 'Full-body to close-up, studio seamless to sunlit street, editorial to catalogue-clean. Every frame answers to you.',
    visual: <div className="vgrid" id="vg1" />,
  },
  {
    idx: '02 / YOUR OWN AI MODELS',
    h: 'Your own AI models. Every SKU. Same face.',
    p: 'Build a model once, save her, and she fronts your entire catalogue — the same recognisable face on every product, drop after drop.',
    visual: <div className="vgrid" id="vg2" />,
  },
  {
    idx: '03 / CUSTOM PROMPTS',
    h: 'Describe the shot. Get the shot.',
    p: 'Need something specific? Type it — "golden-hour terrace, side profile, dupatta mid-swirl" — and AImageGen composes pose, backdrop, lighting and framing to match, exactly.',
    visual: <div className="pv" id="pv1" />,
  },
  {
    idx: '04 / PROMPT GENIE',
    h: 'Complex prompts, written in seconds.',
    p: 'Not a prompt engineer? Tell Genie the vibe in plain words and it drafts the full studio-grade prompt — pose, lighting, mood, framing — ready to run or tweak.',
    visual: <div className="pv" id="pv2" />,
  },
  {
    idx: '05 / GLOBAL CASTING',
    h: 'Models from across the world.',
    p: 'South-Asian presets out of the box — plus faces, skin tones and looks for every market you sell into. Shoot the same garment for Delhi, Dubai and Dallas.',
    visual: (
      <div className="swrow">
        {['#F0D5BE', '#E7C6A8', '#D8AE8C', '#C0946E', '#9A6F4E', '#6F4A30'].map((c) => (
          <span key={c} className="sw" style={{ background: c }} />
        ))}
      </div>
    ),
  },
  {
    idx: '06 / SHOOT CONTINUITY',
    h: 'Pause today. Reshoot next season.',
    p: 'Every shoot is saved with its model, look and lighting. Come back weeks later — for a new colourway, a festive drop, one missing angle — and continue with full continuity. No re-booking, ever.',
    visual: (
      <div className="pv">
        <div className="pline">SHOOT #12 · Summer drop · 42 frames</div>
        <div className="parrow">↳ RESUMED 3 MONTHS LATER</div>
        <div className="pline genie">
          same model · same light · +18 new frames<span className="pc" />
        </div>
      </div>
    ),
  },
  {
    idx: '07 / 2K & 4K OUTPUT',
    h: 'Marketplace listing to billboard.',
    p: 'Standard shots for PDPs and social — or native 2K and 4K renders when the same image has to carry a homepage banner, a hoarding, or print.',
    visual: (
      <div className="pv">
        <div className="ptags" style={{ alignItems: 'center' }}>
          <span className="ptag">1K · PDP &amp; social</span>
          <span className="ptag hot">2K · web hero</span>
          <span className="ptag hot">4K · print &amp; billboard</span>
        </div>
        <div className="parrow">↳ TRUE NATIVE RESOLUTION — NOT UPSCALED</div>
      </div>
    ),
  },
  {
    idx: '08 / PREPAID WALLET',
    h: 'Pay for photos. Not seats, not months.',
    p: 'Top up a ₹ credit wallet and spend it whenever you shoot. No subscription, no minimum SKUs, GST-ready invoicing.',
    visual: (
      <div className="visual-wallet wallet">
        <div className="wchip">
          <span className="k-label">Credit wallet</span>
          <div className="amt">₹11,999</div>
          <div className="cr">1,600 CREDITS · ₹7.50/PHOTO</div>
        </div>
      </div>
    ),
  },
];

const ASSURANCES = [
  'No minimum SKUs — shoot one kurti or a thousand',
  'Restart any shoot later with full continuity',
  'Save your own models & reuse them forever',
  'Commercial rights on every image — yours, permanently',
  'Marketplace-ready framing for Amazon, Flipkart, Myntra & Meesho',
  '2K & 4K output when you need print-grade',
  'GST invoice · INR billing · prepaid wallet',
  'Credits valid 12 months — no subscription, no lock-in',
];

const PLANS = [
  {
    name: 'Sampler',
    price: '₹499',
    per: '≈ ₹9.98 / PHOTO',
    cap: '50 credits — kick the tyres on a real drop.',
    items: ['50 on-model photos', 'All South-Asian presets', 'Any pose, backdrop & mood', 'Save one model'],
    cta: 'Start free →',
    feat: false,
    delay: '0s',
  },
  {
    name: 'Studio',
    price: '₹3,999',
    per: '₹8.00 / PHOTO',
    cap: '500 credits — a growing single-brand catalogue.',
    items: ['500 on-model photos', 'Save up to 10 models', 'Character-sheet consistency', 'Bulk runs'],
    cta: 'Load wallet →',
    feat: false,
    delay: '.06s',
  },
  {
    name: 'Brand',
    price: '₹11,999',
    per: '₹7.50 / PHOTO',
    cap: '1,600 credits — full seasonal catalogues.',
    items: ['1,600 on-model photos', 'Unlimited saved models', 'Ethnic-wear tuning', 'Priority queue', 'GST invoice'],
    cta: 'Load wallet',
    feat: true,
    delay: '.12s',
  },
  {
    name: 'Scale',
    price: '₹34,999',
    per: '₹7.00 / PHOTO',
    cap: '5,000 credits — agencies & multi-brand teams.',
    items: ['5,000 on-model photos', 'Everything in Brand', 'Team access', 'Bulk API-ready runs'],
    cta: 'Load wallet →',
    feat: false,
    delay: '.18s',
  },
];

export default function LandingPage() {
  return (
    <>
      {[ORG_LD, APP_LD, FAQ_LD].map((ld, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
        />
      ))}

      <div className="cur" id="cur" />
      <div className="progress" id="progress" />

      <header className="nav" id="nav">
        <div className="wrap nav-in">
          <a className="logo" href="#top" data-c="" aria-label="AImageGen home">
            {/* eslint-disable @next/next/no-img-element */}
            <img className="logo-img logo-light" src="/logo-black.png" alt="AImageGen" />
            <img className="logo-img logo-dark" src="/logo-white.png" alt="AImageGen" />
            {/* eslint-enable @next/next/no-img-element */}
          </a>
          <nav className="nav-links">
            <a href="#story" data-c="">Why</a>
            <a href="#features" data-c="">Features</a>
            <a href="#demo" data-c="">See it run</a>
            <a href="#pricing" data-c="">Pricing</a>
          </nav>
          <div className="nav-right">
            <button className="mode" id="modeBtn" data-c="" aria-label="Toggle light and dark mode">
              <span className="orb" />
              <span className="txt" id="modeTxt">Dark</span>
            </button>
            <a href="/login" className="btn btn-line" style={{ padding: '.6em 1.2em' }} data-c="">
              Log in
            </a>
            <a href="/register" className="btn btn-flame" style={{ padding: '.6em 1.2em' }} data-c="">
              Register <span className="arw">→</span>
            </a>
          </div>
        </div>
      </header>

      <a id="top" />

      {/* ── hero ── */}
      <section className="hero">
        <div className="hero-bg" id="heroBg" />
        <div className="hero-veil" />
        <div className="hero-c">
          <h1>
            <span className="ln"><span>Making studio photography</span></span>
            <span className="ln"><span><em>universally</em> accessible</span></span>
          </h1>
          <p className="sub">
            AI on-model fashion photography for D2C brands and ecommerce sellers in India. One
            garment photo becomes a full photoshoot — a consistent, photo-real model in every pose
            your catalogue needs. Minutes, not weeks.
          </p>
          <div className="hero-cta">
            <a href="/register" className="btn btn-flame" data-c="">
              Start with free credits <span className="arw">→</span>
            </a>
            <a href="#demo" className="btn btn-line" data-c="">See a shoot run</a>
          </div>
        </div>
        <div className="scroll-hint">
          <span className="k-label">Scroll</span>
          <span className="stem" />
        </div>
      </section>

      {/* ── narrative ── */}
      <section className="narr" id="story">
        <div className="pin-wrap" id="narrWrap">
          <div className="pin">
            <div className="scene" id="sc1">
              <div className="tag">The challenge</div>
              <h2>
                Professional catalogue photography is locked behind{' '}
                <b>studios, crews and weeks of waiting</b>
              </h2>
            </div>
            <div className="scene sol" id="sc2" style={{ opacity: 0 }}>
              <div className="tag">The solution</div>
              <h2>
                A photo-real model, dressed in your garment, <b>generated on demand</b> — in every
                pose you direct
              </h2>
            </div>
          </div>
        </div>
      </section>

      {/* ── cost counter ── */}
      <section className="counter-sec">
        <div className="pin-wrap" id="cntWrap">
          <div className="pin">
            <div className="cnt-cap">
              Catalogue photo cost
              <br />
              <b>studio shoot → AImageGen</b>
            </div>
            <div className="big-num">
              <span className="rup">₹</span>
              <span id="bigNum">250</span>
              <span className="unit">/PHOTO</span>
            </div>
            <div className="cost-bars">
              <div className="cbar">
                <div className="bar" id="barStudio" />
                <span className="k-label">Traditional studio</span>
              </div>
              <div className="cbar us">
                <div className="bar" id="barUs" />
                <span className="k-label">AImageGen</span>
              </div>
            </div>
            <div className="cnt-x" id="cntX">COST REDUCED UP TO 10× — AND NO RESHOOT EVER</div>
          </div>
        </div>
      </section>

      {/* ── feature rail ── */}
      <section className="rail-sec" id="features">
        <div className="wrap rail-head rv">
          <span className="eyebrow">The platform</span>
          <h2>Everything a studio does. Nothing a studio costs.</h2>
        </div>
        <div className="rail-pinzone" id="railZone">
          <div className="rail-pin">
            <div className="drag-hint">Keep scrolling →</div>
            <div className="rail-track" id="railTrack">
              {RAIL_CARDS.map((c) => (
                <div className="rcard" key={c.idx}>
                  <div>
                    <div className="idx">{c.idx}</div>
                    <h3>{c.h}</h3>
                    <p>{c.p}</p>
                  </div>
                  <div className="visual">{c.visual}</div>
                </div>
              ))}
            </div>
            <div className="rail-progress">
              <div className="fill" id="railFill" />
            </div>
          </div>
        </div>
      </section>

      {/* ── stats ── */}
      <div className="stats">
        <div className="wrap stats-in">
          <div className="stat">
            <div className="num" data-count="25" data-prefix="₹">₹0</div>
            <div className="cap k-label">Per photo, prepaid</div>
          </div>
          <div className="stat">
            <div className="num" data-count="2" data-suffix=" min">0</div>
            <div className="cap k-label">Upload → full shoot</div>
          </div>
          <div className="stat">
            <div className="num" data-count="10" data-suffix="×">0</div>
            <div className="cap k-label">Cheaper than studio</div>
          </div>
          <div className="stat">
            <div className="num" data-count="12" data-suffix=" mo">0</div>
            <div className="cap k-label">Credit validity, prepaid</div>
          </div>
        </div>
      </div>

      {/* ── assurances ── */}
      <section className="assure">
        <div className="wrap">
          <div className="rv" style={{ marginBottom: 34 }}>
            <span className="eyebrow">The fine print — in your favour</span>
          </div>
          <div className="agrid rv">
            {ASSURANCES.map((a) => (
              <div className="aitem" key={a}>
                <span className="tick">✓</span>
                {a}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── demo ── */}
      <section className="demo" id="demo">
        <div className="wrap demo-grid">
          <div className="rv">
            <span className="eyebrow">Live on this page</span>
            <h2>One garment in. A full shoot out.</h2>
            <p className="d">
              This is the product, in miniature. One garment frame becomes a full set — with the
              model&apos;s identity locked on every frame.
            </p>
            <a href="/register" className="btn btn-flame" data-c="">
              Run it on your garment <span className="arw">→</span>
            </a>
          </div>
          <div className="rv">
            <div className="sheet" id="sheetBox">
              <div className="sheet-top">
                <span className="lbl">Contact sheet · 1 upload</span>
                <span className="roll">● REC · consistency locked</span>
              </div>
              <div className="scan" id="scan" />
              <div className="frames" id="frames" />
              <div className="sheet-foot">
                <span className="lbl">6 frames · same model · ~00:02:11</span>
                <button className="replay" id="replay" data-c="">↻ Run again</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── pricing ── */}
      <section className="pricing" id="pricing">
        <div className="wrap">
          <div className="head rv">
            <span className="eyebrow">Prepaid credit wallet · 1 credit = 1 photo</span>
            <h2>Load a wallet. Shoot when you like.</h2>
            <p>
              Per-photo rate drops the more you load. No subscription, no minimum SKUs, credits
              valid 12 months. Come back any time — your models and shoots stay saved.
            </p>
          </div>
          <div className="plans">
            {PLANS.map((p) => (
              <div
                className={`plan rv${p.feat ? ' feat' : ''}`}
                key={p.name}
                style={{ transitionDelay: p.delay }}
              >
                {p.feat && <div className="badge">Most popular</div>}
                <div className="p-name">{p.name}</div>
                <div className="p-price">{p.price}</div>
                <div className="p-per">{p.per}</div>
                <div className="p-cap">{p.cap}</div>
                <ul>
                  {p.items.map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
                <a
                  href="/register"
                  className={`btn ${p.feat ? 'btn-flame' : 'btn-line'}`}
                  data-c=""
                >
                  {p.cta}
                  {p.feat && <span className="arw"> →</span>}
                </a>
              </div>
            ))}
          </div>
          <div className="pnote rv">
            Enterprise from ₹6/photo · Talk to us for custom volume, dedicated models &amp;
            onboarding
          </div>
        </div>
      </section>

      {/* ── faq ── */}
      <section className="faq" id="faq">
        <div className="wrap" style={{ maxWidth: 860 }}>
          <div className="rv" style={{ textAlign: 'center', marginBottom: 44 }}>
            <span className="eyebrow">Questions, answered</span>
            <h2 style={{ fontSize: 'clamp(2rem,4.4vw,3.2rem)', marginTop: 14 }}>
              Everything a studio-shopper asks us.
            </h2>
          </div>
          <div className="rv">
            {FAQS.map(([q, a]) => (
              <details className="qa" key={q}>
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── final CTA ── */}
      <section className="final">
        <div className="glow" />
        <div className="in rv">
          <h2>
            Your catalogue is <em>closer</em> than you think.
          </h2>
          <p className="sub">
            Load a wallet, upload a garment, and watch a full on-model shoot come back before the
            kettle boils.
          </p>
          <a href="/register" className="btn btn-flame" data-c="">
            Start with free credits <span className="arw">→</span>
          </a>
        </div>
      </section>

      <footer>
        <div className="wrap fin">
          <div>
            <div className="logo">
              {/* eslint-disable @next/next/no-img-element */}
              <img className="logo-img logo-light" src="/logo-black.png" alt="AImageGen" />
              <img className="logo-img logo-dark" src="/logo-white.png" alt="AImageGen" />
              {/* eslint-enable @next/next/no-img-element */}
            </div>
            <p style={{ maxWidth: '32ch', fontSize: '.9rem', marginTop: 14 }}>
              On-model AI fashion photography for D2C brands and agencies. Built in India, by 3rd i
              Visuals (VDOfy).
            </p>
          </div>
          <div>
            <span className="k-label">Product</span>
            <a href="#features" data-c="">Features</a>
            <a href="#demo" data-c="">See it run</a>
            <a href="#pricing" data-c="">Pricing</a>
          </div>
          <div>
            <span className="k-label">Use cases</span>
            <a href="#" data-c="">Ethnic wear</a>
            <a href="#" data-c="">Western wear</a>
            <a href="#" data-c="">Agencies</a>
          </div>
          <div>
            <span className="k-label">Company</span>
            <a href="#" data-c="">About</a>
            <a href="#" data-c="">Contact</a>
            <a href="#" data-c="">Terms</a>
          </div>
        </div>
        <div className="wrap fbot">
          <span>© 2026 3rd i Visuals Pvt Ltd · AImageGen™</span>
          <span>Prices in ₹ (INR) · Prepaid credits · Valid 12 months</span>
        </div>
      </footer>

      {/* Runs after hydration, so every id above is already in the DOM. */}
      <Script src="/landing.js" strategy="afterInteractive" />
    </>
  );
}