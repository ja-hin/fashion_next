/**
 * Marketing layout.
 *
 * The landing page keeps its own design system (Playfair Display / Geist /
 * Geist Mono, a warm cream palette and a dark hero band) in
 * `public/landing.css`. It's linked here rather
 * than imported so it never enters the studio's CSS bundle — the two share
 * variable names (`--bg`, `--muted`, `--line`, `--shadow`) with very different
 * values, and loading both would corrupt whichever came second.
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Geist:wght@300..700&family=Geist+Mono:wght@400;500;700&family=Playfair+Display:ital,wght@0,400..700;1,400..600&display=swap"
      />
      <link rel="stylesheet" href="/landing.css" />
      {children}
    </>
  );
}