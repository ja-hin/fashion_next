import Script from 'next/script';
import type { LegalDoc } from '@/lib/legal';

/**
 * The frame around a legal document: site nav, page head, contents, body,
 * footer.
 *
 * Shared by /privacy, /terms and /acceptable-use: the only difference between
 * them is the document, and three copies of this would drift the moment the
 * nav changed.
 * The body comes through as sanitised HTML from lib/legal.ts, which is what
 * keeps the signed-off wording verbatim.
 */
export default function LegalShell({ doc }: { doc: LegalDoc }) {
  return (
    <>
      {/* `nav-onlight`: these pages open on the cream background rather than the
          home page's dark hero, so the bar carries its own dark ground from the
          start instead of waiting for the scroll that solidifies it. */}
      <header className="nav nav-onlight" id="nav">
        <div className="wrap nav-in">
          <a className="logo" href="/" aria-label="Faishon.studio home">
            {/* eslint-disable @next/next/no-img-element */}
            <img className="logo-img logo-light" src="/logo-black.png" alt="Faishon.studio" />
            <img className="logo-img logo-dark" src="/logo-white.png" alt="Faishon.studio" />
            {/* eslint-enable @next/next/no-img-element */}
          </a>
          <nav className="nav-links">
            <a href="/#features">Features</a>
            <a href="/#demo">See it run</a>
            <a href="/#pricing">Pricing</a>
            <a href="/#contact">Contact</a>
          </nav>
          <div className="nav-right">
            <a href="/login" className="btn btn-line" style={{ padding: '.6em 1.2em' }}>
              Log in
            </a>
            <a href="/register" className="btn btn-cta" style={{ padding: '.6em 1.2em' }}>
              Register <span className="arw">→</span>
            </a>
          </div>
        </div>
      </header>

      <main className="legal">
        <div className="wrap lg-head">
          <span className="eyebrow">Legal · Faishon.studio</span>
          <h1>{doc.title}</h1>
          <p className="lg-tag">{doc.tagline}</p>
          <div className="lg-dates">
            <div>
              <span>Effective date</span>
              <b>{doc.effective}</b>
            </div>
            <div>
              <span>Last updated</span>
              <b>{doc.updated}</b>
            </div>
          </div>
        </div>

        <div className="wrap lg-shell">
          {/* A <details> rather than a heading with a click handler: on a phone
              this list runs to eighteen items and has to collapse, and the
              element that already does that needs no JavaScript to work. */}
          <aside className="lg-toc">
            <details open>
              <summary>On this page</summary>
              <ol>
                {doc.toc.map((t) => (
                  <li key={t.href}>
                    <a href={t.href}>{t.label}</a>
                  </li>
                ))}
              </ol>
            </details>
          </aside>

          {/* Sanitised in lib/legal.ts against a tag + attribute allowlist. */}
          <article className="lg-body" dangerouslySetInnerHTML={{ __html: doc.body }} />
        </div>

      </main>

      <footer>
        <div className="wrap fin">
          <div>
            <div className="logo">
              {/* eslint-disable @next/next/no-img-element */}
              <img className="logo-img logo-light" src="/logo-black.png" alt="Faishon.studio" />
              <img className="logo-img logo-dark" src="/logo-white.png" alt="Faishon.studio" />
              {/* eslint-enable @next/next/no-img-element */}
            </div>
            <p style={{ maxWidth: '32ch', fontSize: '.9rem', marginTop: 14 }}>
              On-model AI fashion photography and video for D2C brands and marketplace sellers.
              Built in India, by 3rd i Visuals Pvt. Ltd.
            </p>
          </div>
          <div>
            <span className="k-label">Product</span>
            <a href="/#features">Features</a>
            <a href="/#demo">See it run</a>
            <a href="/#pricing">Pricing</a>
          </div>
          <div>
            {/* Contact sits in this column, matching the landing page's footer ,
                it is the address on a legal document, so it belongs with them
                rather than in a column of its own. */}
            <span className="k-label">Legal</span>
            <a href="/#contact">Contact</a>
            <a href="/terms">Terms of Use</a>
            <a href="/privacy">Privacy Policy</a>
            <a href="/acceptable-use">Acceptable Use</a>
          </div>
        </div>
        <div className="wrap fbot">
          <span>
            © 2026 3rd i Visuals Pvt Ltd · All models shown are AI-generated synthetic individuals
          </span>
          <span>Prices in ₹ (INR) · Prepaid credits · Valid 12 months</span>
        </div>
      </footer>

      {/* Shared with the landing page , the theme toggle and the anchor
          smooth-scroll live there, and both apply here. */}
      <Script src="/landing.js" strategy="afterInteractive" />
    </>
  );
}
