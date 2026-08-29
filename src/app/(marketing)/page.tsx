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

/**
 * The three proof points, and the doors into the product beneath them.
 *
 * Every number here is a claim this page already makes elsewhere — the 10x in
 * the cost counter, the 2 min and the ₹25 in the stats band. Nothing new is
 * asserted, so there is one set of numbers to keep honest rather than two.
 */
const WHY_STATS = [
  {
    n: '80%',
    t: 'Lower production cost',
    d: 'Save up to 80% against a traditional studio shoot. No crew, no location, no model day-rates, no reshoot fees.',
  },
  {
    n: '2 min',
    t: 'Upload to full shoot',
    d: 'One garment photo in, a finished on-model set back. Generated while you wait, not booked for next week.',
  },
  {
    n: '0',
    t: 'Minimums, subscriptions, lock-ins',
    d: 'No minimum SKUs, no monthly plan, no seats. Shoot one garment or a thousand, whenever you like.',
  },
];

const USE_CASES = [
  'Launch collections',
  'Catalogues at scale',
  'Update listings',
  'Every marketplace',
  'Sample designs',
  'Visual lookbooks',
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
            <a href="#why" data-c="">Why</a>
            <a href="#features" data-c="">Features</a>
            <a href="#demo" data-c="">See it run</a>
            <a href="/pricing" data-c="">Pricing</a>
          </nav>
          <div className="nav-right">
            <a href="/login" className="btn btn-line nav-cta" style={{ padding: '.6em 1.2em' }} data-c="">
              Log in
            </a>
            <a href="/register" className="btn btn-cta nav-cta" style={{ padding: '.6em 1.2em' }} data-c="">
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
            <a href="#why" data-c="">Why</a>
            <a href="#features" data-c="">Features</a>
            <a href="#demo" data-c="">See it run</a>
            <a href="/pricing" data-c="">Pricing</a>
          </nav>
          <div className="mnav-cta">
            <a href="/login" className="btn btn-line" data-c="">Log in</a>
            <a href="/register" className="btn btn-cta" data-c="">
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
            <h1>
              <span className="ln"><span><em>Fashion photoshoots & videos</em> for your brand in minutes.</span></span>
            </h1>
            <p className="sub">
              Create a full on-model editorial shoot with AI for{' '}
              <span className="rotw" id="rotw">Amazon & Myntra listings</span> <br></br><b>Studio-grade, photo-real stills</b> and reel-ready videos from the same shoot for D2C brands and ecommerce sellers. No photographer, no model booking, no studio.
            </p>
            <div className="hero-cta">
              <a href="/register" className="btn btn-cta" data-c="">
                Start free trial <span className="arw">→</span>
              </a>
              <a href="#demo" className="btn btn-line" data-c="">Book a Demo</a>
            </div>
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
            <h2 className="sec-h2">Photos, models, video</h2>
            <span>On-model photography, custom AI models, reel-ready video — start where you need to.</span>
          </div>
          {/* The row sits in a pin zone on a phone: the section sticks while the
              scroll steps through the cards, so arriving at speed cannot skip
              past them. Both wrappers are inert above 860px — the zone gets no
              height and the pin no stickiness — so the desktop fan is
              untouched. Sized and driven by landing.js. */}
          <div className="create-pinzone" id="createZone">
            <div className="create-pin">
              <div className="create-row" id="createRow" />
            </div>
          </div>
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
        <div className="wrap-1">
          <div className="hiw-head rv">
            <span className="eyebrow">How it works</span>
            <h2 className="sec-h2">From garment to finished photo</h2>
            <p className="sec-p">
              Upload a garment, pick a model, backdrop and pose. Generate studio-grade, on-model photo. Flip through the options below to see how a shot comes together.
            </p>
          </div>

          <div className="hiw-card">
            <div className='hiw-center'>
              {/* Womenswear / Menswear. Each carries its own garments, cast and
                  poses, so everything below is rebuilt when this changes —
                  which is why it sits above the rest of the controls. */}
              <div className="hiw-group">
                <span className="k-label">Category</span>
                <div className="hiw-tabs" id="hiwCats" role="tablist" aria-label="Category" />
              </div>

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
      {/* <section className="darkroom" id="darkroom">
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
      </section> */}

      {/* ── casting matrix ── */}
      {/* Follows the darkroom: that panel proves one garment becomes a finished
          photograph, this one proves it becomes ANY of them — five models, six
          setups, identity held down each row. Built by landing.js from
          /webassets/m{row}p{col}. */}
          <section className="ens" id="ensemble">
        <div className="wrap ens-head rv">
          <span className="eyebrow">Ensemble · style the whole look</span>
          <h2 className="sec-h2">
            Not one garment. The <em>whole outfit.</em>
          </h2>
          <p className="sec-p">
            Upload the pieces — the dress, the heels, the eyewear, the hat, the bag, the necklace.
            Each one is recognised, given its role, and styled onto a single model as one complete
            look. Swap any piece and the rest of the look holds.
          </p>
        </div>

        <div className="wrap ens-grid rv">
          <div className="ens-pieces" id="ensPieces" />

          <div className="ens-stage">
            <div className="ens-figure" id="ensFigure" />
            <div className="ens-pins" id="ensPins" />
            <span className="ens-flag" id="ensFlag" />
          </div>
        </div>

      </section>
      <section className="castworld" id="casting">
        <div className="wrap-1">
          {/* Wrapped so the three lines centre as one block on a shared measure
              — the same `-head` pattern the reels, create and cats sections
              already use. */}
          <div className="castworld-head rv">
            <span className="eyebrow">CAST ANY MODEL IN ANY BACKDROP</span>
            <h2 className="sec-h2">Cast the world. Shoot it your way.</h2>
            <p className="sec-p">
              Cast any model you can imagine. Any skin tone, body type and look, against any backdrop, from studio seamless to a sunlit street. Delhi, Dubai or Dallas.
            </p>
          </div>

          <div className="lr-box" id="panel">

            <div className="lr-main">
              <div className="loupe" id="loupe">
                {/* Just the photograph and the progress bar. The chip, the frame
                    counter and the name/setting caption were labels for something
                    the picture already shows, and they sat on top of it. */}
                <div className="media" id="loupeMedia" />
                <div className="bar" id="cycleBar" />
              </div>

              <div className="mapside">
                <div>
                  <div className="mm-cols" id="mmCols" />
                  <div id="mmRows" />
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── ensemble: the styling map ── */}
      {/* Not a before/after: the point of an ensemble shoot is that each piece
          lands somewhere specific on one model, so the widget SHOWS where. The
          pieces sit beside the figure, a line ties the active one to its pin,
          and the pin marks the exact spot it is styled onto. Built by
          landing.js — the imagery probes for real renders at runtime. */}
      

      {/* Copy left, sheet right. Full-width the sheet was taller than the
          viewport and the paragraph above it was read and forgotten before the
          frames arrived; side by side they are read together, and the sheet
          lands at a size that fits on screen. */}
      <section className="demo" id="demo">
        <div className="wrap-1 demo-grid">
          <div className="demo-copy rv">
            <span className="eyebrow">AI fashion shoot studio</span>
            <h2 className="sec-h2">One garment photo IN. A full catalogue OUT.</h2>
            <p className="sec-p desktop">
              Every angle a listing needs: front, back, three-quarter and close-up, all from a single garment photo, all worn by the same model. Shoot by shoot, your catalogue builds itself. <br></br><br></br>

Every shoot on Faishon Studio is consistency locked. The neckline, the drape, the exact shade of the fabric, the model's face: nothing shifts from frame to frame, or from shoot to shoot. Every detail stays consistent. No drift, no surprises.<br></br>

Consistency is what makes the set catalogue-ready. No shot lists, no studio day, no reshoots for the missing angle. The whole set arrives together, correctly framed for Amazon, Flipkart, Myntra and Meesho.
            </p>
            <p className="sec-p mobile">
            Front, back, three-quarter and close-up, all from one garment photo, all on the same model. Every shoot is consistency locked: no drift, no surprises, no reshoots.

Catalogue-ready for Amazon, Flipkart, Myntra and Meesho.
</p>
          </div>

          <div className="sheet" id="sheetBox">
            <div className="sheet-top">
              <span className="lbl" id="topLbl">CONTACT SHEET · SET 01 / 05</span>
            </div>
            <div className="scan" id="scan" />
            <div className="frames" id="frames" />
            <div className="sheet-foot">
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

        </div>
      </section>
      {/* ── the output: stills become reels ── */}
      {/* A fan of frames from one shoot, each holding a clip. Hovering a card
          straightens it out of the arc and plays it; leaving puts it back.
          Cards, imagery and the arc geometry all come from landing.js — the
          angles depend on the rendered card width, so they cannot be static
          CSS. */}
      <section className="reels" id="reels">
        <div className="wrap reels-head rv">
          <span className="eyebrow">Fashion video</span>
          <h2>
            Turn a photoshoot into <em>scroll-stopping video</em>.
          </h2>
          <p className="sec-p desktop">
            Turn every shoot into reel-ready video: the same model, the same garment, brought to life for Instagram, product pages and ads. Start from ready-made presets for ultra-realistic Instagram fashion reels, ads and PDP videos. Customize any preset, or direct your own: set the mood, the movement and the camera, and shoot the editorial look you imagined.
          </p>
          <p className="sec-p mobile">
            Turn every shoot into reel-ready ultra-realistic videos for Instagram, PDPs and ads. Start from ready-made presets, customize them, or direct your own editorial look.
          </p>
        </div>
        {/* Outside .wrap: the arc is wider than the text column by design, and
            the outer frames are meant to run off the edge of the screen. */}
        <div className="reel-arc" id="reelArc" />
        <div className="wrap">
        </div>
      </section>

      {/* ── built for brands at every stage ── */}
      {/* A category deck: pills choose, three cards fan with the chosen one
          upright. Pills, cards and imagery all come from landing.js. */}
      <section className="cats" id="cats">
        <div className="wrap">
          <div className="cats-head rv">
            <span className="eyebrow">EVERY APPAREL CATEGORY</span>

            <h2 className="sec-h2">Built for every category.</h2>
            <p className="sec-p">Sarees to streetwear, kurtis to knitwears: category-right models, framing and styling. Pick yours:</p>
          </div>
          <div className="cats-pills" id="catsPills" role="tablist" aria-label="Category" />
        </div>
        {/* Outside .wrap so the fanned side cards can run past the text column
            without being clipped by its padding. */}
        <div className="cats-stage" id="catsStage" />
      </section>

      {/* ── cost counter ── */}
      <section className="counter-sec" style={{display:'none'}}>
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
          <span className="eyebrow">Inside the studio</span>
          <h2>
            Everything a studio does, <em>and more.</em>
          </h2>
          <p className="sec-p">
            Every feature below comes with every shoot. The whole studio, yours from your first
            upload.
          </p>
        </div>
        <div className="rail-pinzone" id="railZone">
          <div className="rail-pin">
            {/* Filled by landing.js — each card's imagery is probed at runtime,
                which is a job for the browser, not the server render. */}
            <div className="rail-track" id="railTrack" />
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
              <span className="eyebrow">PROMPT GENIE · YOUR AI ART DIRECTOR</span>
              <h2>
                Every shoot comes with an<em> art director.</em>
              </h2>
              <p className="desktop">
                Direct it yourself if you like: pick the pose, the backdrop, the light and the mood, down to the last detail. Every frame answers to you.
<br></br>Or just tell Genie the idea. Describe what you imagine in plain words and Genie develops it the way an art director would: pose, lighting, framing and mood, composed into a complete shoot brief in seconds. Not quite there? Say &ldquo;warmer light&rdquo; or &ldquo;make it festive&rdquo; and Genie reworks the direction, before a single credit is spent.
              </p>
              <p className="mobile">
                Direct every detail yourself: pose, backdrop, light, mood. Or hand Genie the idea and your AI art director develops it into a complete shoot in seconds. Say &ldquo;warmer light&rdquo; and it reworks, before a single credit is spent.
              </p>
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
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── stats ── */}
      {/* <div className="stats">
        <div className="wrap stats-in">
          <div className="stat card-glow">
            <div className="num" data-count="25" data-prefix="<i class='pre'>₹</i>">
              <i className="pre">₹</i>0
            </div>
            <div className="cap k-label">Per photo, prepaid</div>
          </div>
          <div className="stat card-glow">
            <div className="num" data-count="2" data-suffix=" min">0</div>
            <div className="cap k-label">Upload → full shoot</div>
          </div>
          <div className="stat card-glow">
            <div className="num" data-count="10" data-suffix="×">0</div>
            <div className="cap k-label">Cheaper than studio</div>
          </div>
          <div className="stat card-glow">
            <div className="num" data-count="12" data-suffix=" mo">0</div>
            <div className="cap k-label">Credit validity, prepaid</div>
          </div>
        </div>
      </div> */}

      {/* ── why brands choose us ── */}
      {/* A dark band between the demos and the price: the page has just spent
          six sections showing what the product does, and this is the summary a
          visitor scrolls back to before deciding. Static markup — nothing here
          needs landing.js. */}
      <section className="why" id="why">
        <div className="wrap">
          <div className="why-head rv">
            <span className="eyebrow why-eyebrow">Why brands choose Faishon Studio</span>
          </div>

          <div className="why-grid rv">
            {WHY_STATS.map((s, i) => (
              <div className="wcard" key={s.t} style={{ '--i': i } as React.CSSProperties}>
                <div className="n">{s.n}</div>
                <div className="t">{s.t}</div>
                <p className="d">{s.d}</p>
              </div>
            ))}
          </div>

          <div className="why-sep" />

          <div className="why-use rv">
            <span className="eyebrow use-eyebrow">What&rsquo;s your use case?</span>
            {/* A ticker on every width. Four copies of the list, not two: the
                track only reads as endless while one copy is at least as wide
                as the viewport, and six chips are ~1100px — fine on a phone,
                a visible gap on a 1920 desktop. Four covers both, and the
                keyframe travels exactly one copy so the seam never shows.
                Copies after the first are hidden from the accessibility tree
                and taken out of the tab order, so the ticker is six links to a
                screen reader and to the keyboard, not twenty-four. */}
            <div className="use-marquee">
              <div className="use-track">
                {[0, 1, 2, 3].map((copy) => (
                  <div
                    className="use-row"
                    key={copy}
                    aria-hidden={copy > 0 ? true : undefined}
                  >
                    {USE_CASES.map((u) => (
                      <a
                        href="/register"
                        className="use-chip"
                        key={u}
                        data-c=""
                        tabIndex={copy > 0 ? -1 : undefined}
                      >
                        {u} <span className="arw">→</span>
                      </a>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── assurances ── */}
      {/* <section className="assure">
        <div className="wrap">
          <div className="rv" style={{ marginBottom: 34 }}>
            <span className="eyebrow">The fine print — in your favour</span>
          </div>
          <div className="agrid rv">
            {ASSURANCES.map((a, i) => (
              // `--i` is the card's place in the stagger once the grid reveals.
              <div className="aitem card-glow" key={a} style={{ '--i': i } as React.CSSProperties}>
                <span className="tick" aria-hidden="true">
                  ✓
                </span>
                {a}
              </div>
            ))}
          </div>
        </div>
      </section> */}

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
        </div>
        {/* Same mechanics as "Inside the studio": the zone is as tall as the
            row is wide, the pin holds the row still while you scroll through
            it, and a sideways drag scrolls the page rather than moving the
            row itself. Full-bleed, so it lives outside .wrap. */}
        <div className="price-pinzone" id="priceZone">
          <div className="price-pin">
            <div className="plans" id="priceTrack">
              {plans.map((p, i) => {
                const total = packCredits(p);
                return (
                  <div
                    className={`plan card-glow rv${p.popular ? ' feat' : ''}`}
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
                      className={`btn ${p.popular ? 'btn-cta' : 'btn-line'}`}
                      data-c=""
                    >
                      Load wallet
                      {p.popular && <span className="arw"> →</span>}
                    </a>
                  </div>
                );
              })}
            </div>
            <div className="rail-progress">
              <div className="fill" id="priceFill" />
            </div>
          </div>
        </div>
        <div className="wrap">
          {/* Filled by landing.js and shown only on the phone, where they stand
              in for the hairline. Empty here rather than four hardcoded dots so
              the count can never fall out of step with the packs. */}
          <div className="plan-dots" id="planDots" hidden />
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
          <a href="/register" className="btn btn-cta" data-c="">
            Start with free trial <span className="arw">→</span>
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