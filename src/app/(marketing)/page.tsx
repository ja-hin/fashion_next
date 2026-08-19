import type { Metadata } from 'next';
import Script from 'next/script';
import { ensureBootstrapped } from '@/lib/bootstrap';
import { getBilling } from '@/lib/settings';
import { activePacks, packCredits, rupees, bonusPct, type Pack } from '@/lib/pricing';

/**
 * The public marketing homepage.
 *
 * Element ids and class names are load-bearing: `public/landing.js` drives the
 * scroll-pinned narrative, the cost counter, the feature rail and the contact
 * sheet animation by querying them. Renaming anything here silently breaks an
 * animation, so keep the hooks intact.
 */

export const runtime = 'nodejs';
/**
 * The pricing section reads admin-managed packs, so this page must not be
 * statically prerendered — a build-time snapshot would freeze prices and keep
 * serving them after an admin changed them.
 */
export const dynamic = 'force-dynamic';

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
};

/**
 * Offers for the SoftwareApplication schema, built from the live packs.
 * Hardcoding these means Google indexes a price the admin has since changed —
 * which is both wrong and a rich-result penalty.
 */
const appLd = (packs: Pack[]) => ({
  ...APP_LD,
  offers: packs.map((p) => ({
    '@type': 'Offer',
    name: `${p.name} — ${packCredits(p)} photo credits`,
    price: String(p.paise / 100),
    priceCurrency: 'INR',
    url: 'https://aimagegen.com/pricing',
  })),
});

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


export default async function LandingPage() {
  await ensureBootstrapped();
  const billing = await getBilling();
  const plans = activePacks(billing);

  return (
    <>
      {[ORG_LD, appLd(plans), FAQ_LD].map((ld, i) => (
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
            <a href="/pricing" data-c="">Pricing</a>
          </nav>
          <div className="nav-right">
            <button className="mode" id="modeBtn" data-c="" aria-label="Toggle light and dark mode">
              <span className="orb" />
              <span className="txt" id="modeTxt">Dark</span>
            </button>
            <a href="/login" className="btn btn-line nav-cta" style={{ padding: '.6em 1.2em' }} data-c="">
              Log in
            </a>
            <a href="/register" className="btn btn-flame nav-cta" style={{ padding: '.6em 1.2em' }} data-c="">
              Register <span className="arw">→</span>
            </a>

            {/* Below 960px the links and CTAs move into the sheet — the three
                bars are the only nav on a phone, so they must never be hidden. */}
            <button
              className="burger"
              id="burger"
              type="button"
              aria-label="Open menu"
              aria-controls="mobileNav"
              aria-expanded="false"
            >
              <span />
              <span />
              <span />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile sheet. Outside <header> so it can cover the viewport without
          inheriting the bar's height, and so a fixed header over a scrolling
          sheet never traps the last link out of reach. */}
      <div className="mnav" id="mobileNav" hidden>
        <button className="mnav-scrim" id="mnavScrim" type="button" aria-label="Close menu" />
        <div className="mnav-sheet" role="dialog" aria-modal="true" aria-label="Menu">
          <nav className="mnav-links">
            <a href="#how" data-c="">How it works</a>
            <a href="#story" data-c="">Why</a>
            <a href="#features" data-c="">Features</a>
            <a href="#demo" data-c="">See it run</a>
            <a href="/pricing" data-c="">Pricing</a>
          </nav>
          <div className="mnav-cta">
            <a href="/login" className="btn btn-line" data-c="">Log in</a>
            <a href="/register" className="btn btn-flame" data-c="">
              Register <span className="arw">→</span>
            </a>
          </div>
        </div>
      </div>

      <a id="top" />

      {/* ── hero ── */}
      {/* Editorial split: the copy holds the left column, real frames the right.
          The product is photographs, so they are shown at a size worth looking
          at rather than blurred behind a veil. Frames are filled by landing.js,
          which falls back through /assets → placeholder → a drawn figure. */}
      <section className="hero">
        <div className="wrap hero-grid">
          <div>
            <span className="eyebrow">Written with AI · Shot like a studio</span>
            <h1 style={{ marginTop: 18, fontSize:'49px' }}>
              <span className="ln"><span>Making studio photography</span></span>
              <span className="ln"><span><em>universally</em> accessible</span></span>
            </h1>
            <p className="sub">
              AI on-model fashion photography for D2C brands and ecommerce sellers in India. One
              garment photo — or an on-model shot — becomes a full editorial shoot for{' '}
              <span className="rotw" id="rotw">sarees</span> — <b>photo-real output that
              doesn&apos;t look AI-generated</b> — in minutes, not weeks.
            </p>
            <div className="hero-cta">
              <a href="/register" className="btn btn-flame" data-c="">
                Start with free credits <span className="arw">→</span>
              </a>
              <a href="#demo" className="btn btn-line" data-c="">See a shoot run</a>
            </div>
            <p className="hero-note">No studio · No crew · No minimum SKUs · Prepaid in ₹</p>
          </div>

          {/* Each frame carries its own media layer so the photograph can swap
              underneath a caption and shutter that stay put. landing.js cycles
              whole shoot SETS through the three plates, so the hero reads as a
              shoot running rather than a carousel. */}
          <div className="collage" id="collage" aria-label="Live AI photoshoot lookbook">
            <div className="pl main" id="plMain">
              <div className="pl-media" id="mMain" />
              <div className="shutter" id="shutter" />
              <span className="cap" id="capMain">S1 · FRAME 01</span>
            </div>
            <div className="pl b" id="plB">
              <div className="pl-media" id="mB" />
              <span className="cap" id="capB">S1 · FRAME 02</span>
            </div>
            <div className="pl d" id="plD">
              <div className="pl-media" id="mD" />
              <span className="cap" id="capD">S1 · FRAME 03</span>
            </div>
            <div className="pl c" id="plC">
              <div className="pl-media" id="mC" />
              <span className="cap" id="capC">S1 · FRAME 04</span>
            </div>
            <div className="stamp">
              SHOT ON <b>AIMAGEGEN</b> · <span className="rec" id="rec">● REC 00:00</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── what do you want to create ── */}
      {/* Straight after the hero: the visitor has just been told what this is,
          and this is where they pick which door to walk through. Panels expand
          on hover; images and behaviour come from landing.js. */}
      <section className="create" id="create">
        <div className="wrap">
          <div className="create-head rv">
            <span className="eyebrow">What do you want to create?</span>
            <h2 className="sec-h2">Photos, models, video, or listings. Start where you need to.</h2>
          </div>
          <div className="create-row" id="createRow" />
        </div>
      </section>

      {/* ── narrative ── */}
      <section className="narr" id="story" style={{display:"none"}}>
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

      {/* ── how it works: the shot setup ── */}
      {/* Placed right after the challenge→solution beat: the story has just
          said a garment becomes a shoot, and this is where the visitor gets to
          drive it themselves before any of the finished-work panels below.
          Wired by landing.js. */}
      <section className="hiw" id="how">
        <div className="wrap">
          <div className="hiw-head rv">
            <span className="eyebrow">How it works</span>
            <h2 className="sec-h2">From garment to finished photo</h2>
            <p className="sec-p">
              Upload a garment, set the model, scene and pose, and generate studio-grade photos.
              Try the shot setup below.
            </p>
          </div>

          {/* Womenswear / Menswear. Each carries its own garments, cast and
              poses, so the panel below is rebuilt when this changes. */}
          <div className="hiw-tabs" id="hiwCats" role="tablist" aria-label="Category" />

          <div className="hiw-card">
            <div>
              <div className="hiw-group">
                <span className="k-label">Garment</span>
                <div className="hiw-garments" id="hiwGarments" role="group" aria-label="Garment" />
              </div>

              <div className="hiw-group">
                <span className="k-label">Model</span>
                <div className="hiw-opts" id="hiwModels" role="group" aria-label="Model" />
              </div>
              <div className="hiw-group">
                <span className="k-label">Background</span>
                <div className="hiw-opts" id="hiwBgs" role="group" aria-label="Background" />
              </div>
              <div className="hiw-group">
                <span className="k-label">Poses</span>
                <div className="hiw-opts" id="hiwPoses" role="group" aria-label="Pose" />
              </div>

              <div className="hiw-cta">
                <a href="/register" className="btn btn-flame" data-c="">
                  Generate this shot free <span className="arw">→</span>
                </a>
              </div>
            </div>

            <div className="hiw-view" id="hiwView">
              <div className="media" id="hiwMedia" />
              <span className="hiw-cap" id="hiwCap">Anouk Steele · Studio white · Standing</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── darkroom filmstrip ── */}
      {/* Sits straight after the challenge→solution beat: the narrative has
          just claimed a garment becomes a shoot, and this shows it happening.
          Built and driven by landing.js. */}
      <section className="darkroom" id="darkroom">
        <div className="wrap">
          <span className="eyebrow">The darkroom · every frame develops as it passes the light</span>
          <h2 className="sec-h2">Watch the film develop.</h2>
          <p className="sec-p">
            Frames enter as raw negatives and develop into finished photographs as they cross the
            developer beam — the way a garment enters AImageGen and leaves as a shoot. Drag the
            film. Scroll the page and the reel speeds with you.
          </p>
        </div>

        <div className="dark-strip" id="strip">
          <div className="sprockets top" />
          <div className="sprockets bot" />
          <div className="track" id="track" />
          <div className="beam" />
          <div className="beam-lbl">Developing</div>
        </div>

        <div className="wrap strip-foot">
          <span className="slbl">Raw negative → developed · AImageGen reel 01</span>
          <span className="slbl">Drag to scrub · scroll to speed up</span>
        </div>
      </section>

      {/* ── casting matrix ── */}
      {/* Follows the darkroom: that panel proves one garment becomes a finished
          photograph, this one proves it becomes ANY of them — five models, six
          setups, identity held down each row. Built by landing.js from
          /webassets/m{row}p{col}. */}
      <section className="castworld" id="casting">
        <div className="wrap">
          <span className="eyebrow">Casting · One garment · Any model · Any backdrop</span>
          <h2 className="sec-h2">Cast the world. Shoot it your way.</h2>
          <p className="sec-p">
            Thirty frames, one garment. Five models from five continents, six setups each — flipping
            past at shutter speed so you can feel the <b>range</b>. Every frame in a row is the{' '}
            <b>same face</b>. Hover to pause; click any thumbnail to jump.
          </p>

          <div className="lr-box" id="panel">
            <div className="lr-top">
              <span className="lbl">Library · 1 garment · 5 models × 6 setups · auto-advance 0.45s</span>
              <span className="roll">● identity locked per row</span>
            </div>

            <div className="lr-main">
              <div className="loupe" id="loupe">
                <span className="idchip">Same model — locked</span>
                <span className="fno" id="fno">FRAME 01 / 30</span>
                <div className="media" id="loupeMedia" />
                <div className="veil" />
                <div className="who">
                  <div className="nm" id="whoNm">Aisha</div>
                  <div className="sub" id="whoSub">MUMBAI · STUDIO SEAMLESS</div>
                </div>
                <div className="bar" id="cycleBar" />
              </div>

              <div className="mapside">
                <div>
                  <div className="mm-cols" id="mmCols" />
                  <div id="mmRows" />
                </div>
                <div className="mm-legend">
                  <span className="same">● Same face across each row →</span>
                  <span className="lbl" id="pauseState">PLAYING</span>
                </div>
              </div>
            </div>

            <div className="lr-foot">
              <span className="lbl">30 frames · generated from one upload</span>
              <span className="lbl">Cells replaceable via webassets/m&#123;row&#125;p&#123;col&#125;.jpg</span>
            </div>
          </div>
        </div>
      </section>
      <section className="demo" id="demo">
        <div className="wrap">
          <div className="rv">
            <span className="eyebrow">Live on this page · webassets/shoot</span>
            <h2 className="sec-h2">One garment in. A full shoot out.</h2>
            <p className="sec-p">
              Five real shoots on one sheet — the <b>input</b> and everything it became. It advances
              on its own; use <b>◀ ▶</b> to browse at your own pace.
            </p>
          </div>

          <div className="sheet" id="sheetBox">
            <div className="sheet-top">
              <span className="lbl" id="topLbl">CONTACT SHEET · SET 01 / 05</span>
              <span className="roll">● REC · consistency locked</span>
            </div>
            <div className="scan" id="scan" />
            <div className="frames" id="frames" />
            <div className="sheet-foot">
              <span className="lbl" id="footLbl">
                6 FRAMES · SAME MODEL · ~00:02:11 <span className="swipe-hint">· swipe ⇄</span>
              </span>
              <div className="nav">
                <button className="nbtn prev" id="prevB" aria-label="Previous set">
                  <svg viewBox="0 0 16 16" fill="none">
                    <path d="M10 3 L5 8 L10 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <div className="thumbs" id="thumbs" />
                <button className="nbtn next" id="nextB" aria-label="Next set">
                  <svg viewBox="0 0 16 16" fill="none">
                    <path d="M6 3 L11 8 L6 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <div className="rv" style={{ marginTop: 34 }}>
            <a href="/register" className="btn btn-flame" data-c="">
              Run it on your garment <span className="arw">→</span>
            </a>
          </div>
        </div>
      </section>
      {/* ── built for brands at every stage ── */}
      {/* A category deck: pills choose, three cards fan with the chosen one
          upright. Pills, cards and imagery all come from landing.js. */}
      <section className="cats" id="cats">
        <div className="wrap">
          <div className="cats-head rv">
            <h2 className="sec-h2">Built for brands at every stage.</h2>
            <p className="sec-p">Pick the category that fits your brand:</p>
          </div>
          <div className="cats-pills" id="catsPills" role="tablist" aria-label="Category" />
        </div>
        {/* Outside .wrap so the fanned side cards can run past the text column
            without being clipped by its padding. */}
        <div className="cats-stage" id="catsStage" />
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


      {/* ── prompt genie: summoned by the scroll ── */}
      {/* One gesture spread over a pinned zone: the tile rises, bursts into
          smoke at the halfway mark, and the demo modal forms out of the same
          burst — every step scrubbed from scroll position, so scrolling back
          up gathers the smoke and puts Genie back. landing.js drives it all
          from zoneProgress(genieWrap); the tile stays clickable and simply
          scrolls you to the point where the modal is open. */}
      <section className="genie-sec" id="genie">
        <div className="pin-wrap" id="genieWrap">
          <div className="pin">
            <div className="genie-veil" id="genieVeil" />
            <div className="genie-copy" id="genieCopy">
              <span className="eyebrow">Prompt Genie</span>
              <h2>
                Not sure what to <em>ask for?</em>
              </h2>
              <p>
                Type a half-formed idea. Genie rewrites it into a brief a photographer would
                recognise — lens, light, pose, background — before a single credit is spent.
              </p>
              <span className="genie-hint" id="genieHint">
                Keep scrolling to summon <span className="arw">↓</span>
              </span>
            </div>

            <div className="genie-stage">
              <button
                className="genie-tile"
                id="genieTile"
                type="button"
                data-c=""
                aria-label="Summon the Prompt Genie demo"
              >
                <span className="gt-in">
                  <span className="gt-orb">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/genie.webp" alt="" width={76} height={76} />
                  </span>
                  <span className="gt-name">Ask Genie</span>
                  <span className="gt-sub">tap to summon ✨</span>
                </span>
              </button>

              {/* Filled by landing.js: /webassets/genie-demo.mp4 if it is there,
                  otherwise a still frame — never a broken player. */}
              <div
                className="genie-modal"
                id="genieModal"
                role="dialog"
                aria-label="Prompt Genie demo"
                aria-hidden="true"
              >
                <div className="gm-bar">
                  <span className="k-label">Prompt Genie · live</span>
                  <span className="gm-dot" />
                </div>
                <div className="gm-media" id="genieMedia" />
                <div className="gm-foot">
                  <span className="gm-line">
                    <b>You</b>red saree, nice background
                  </span>
                  <span className="gm-line gm-out">
                    <b>Genie</b>Full-length editorial of a deep-red silk saree — 85mm, soft key
                    from camera-left, warm sandstone backdrop, three-quarter turn, gold zari
                    catching the light.
                  </span>
                </div>
              </div>
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

      {/* ── demo: the contact sheet ── */}
      {/* Full width rather than the old half-column: the sheet is six frames
          plus a set-navigator, and that does not fit beside a paragraph.
          Driven by landing.js from /webassets/shoot. */}
      

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
            {plans.map((p, i) => {
              const total = packCredits(p);
              return (
                <div
                  className={`plan rv${p.popular ? ' feat' : ''}`}
                  key={p.id}
                  style={{ transitionDelay: `${i * 0.06}s` }}
                >
                  {p.popular && <div className="badge">Most popular</div>}
                  <div className="p-name">{p.name}</div>
                  <div className="p-price">{rupees(p.paise)}</div>
                  <div className="p-per">{rupees(Math.round(p.paise / total))} / PHOTO</div>
                  <div className="p-cap">
                    <b style={{ color: 'var(--text)', fontSize: '1rem' }}>
                      {total.toLocaleString('en-IN')} credits
                    </b>
                    {p.bonus > 0 && (
                      <>
                        {/* Two grid columns so the figures line up down the card. */}
                        <span
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'auto auto',
                            justifyContent: 'start',
                            columnGap: 8,
                            rowGap: 2,
                            marginTop: 6,
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
                        </span>
                        <span
                          style={{
                            display: 'block',
                            color: 'var(--mint)',
                            fontWeight: 600,
                            marginTop: 4,
                          }}
                        >
                          ( {bonusPct(p)}% Extra Credits )
                        </span>
                      </>
                    )}
                  </div>
                  {/* Keeps the CTA pinned to the bottom so cards align — this
                      is what `.plan ul { flex: 1 }` used to do. */}
                  <div style={{ flex: 1 }} />
                  <a
                    href="/pricing"
                    className={`btn ${p.popular ? 'btn-flame' : 'btn-line'}`}
                    data-c=""
                  >
                    Load wallet
                    {p.popular && <span className="arw"> →</span>}
                  </a>
                </div>
              );
            })}
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
            <a href="/pricing" data-c="">Pricing</a>
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