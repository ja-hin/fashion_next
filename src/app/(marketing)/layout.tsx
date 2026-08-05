/**
 * Marketing layout.
 *
 * The landing page keeps its own design system (Fraunces / Inter / Space Mono
 * plus a warm cream palette) in `public/landing.css`. It's linked here rather
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
        href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400..600;1,9..144,400..600&family=Inter:wght@300;400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap"
      />
      <link rel="stylesheet" href="/landing.css" />
      {children}
    </>
  );
}