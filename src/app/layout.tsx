import type { Metadata, Viewport } from 'next';

/**
 * Root layout , deliberately renders nothing but the document shell.
 *
 * The marketing page and the studio have their OWN design systems that both
 * define `--bg`, `--muted`, `--line` and `--shadow` with different values, so
 * neither stylesheet may be global. Each route group's layout imports only its
 * own CSS (see (marketing)/layout.tsx and (studio)/layout.tsx).
 */

/**
 * `metadataBase` is what every relative URL in the tree resolves against , the
 * legal pages' canonicals are written as '/privacy' and would otherwise resolve
 * to localhost in the built output.
 */
const SITE = 'https://faishon.studio';

/** The share card. 1.91:1 for Facebook/LinkedIn/X, square for WhatsApp. */
const OG_IMAGES = [
  {
    url: '/og/home.jpg',
    width: 1200,
    height: 630,
    alt: 'Faishon Studio: AI fashion photoshoots and videos for your brand in minutes',
  },
  {
    url: '/og/home-square.jpg',
    width: 1200,
    height: 1200,
    alt: 'Faishon Studio: AI fashion photoshoots and videos for your brand in minutes',
  },
];

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: 'Faishon.studio',
  description:
    'AI on-model fashion photography. One garment photo becomes a full photoshoot.',
  /*
   * Site-wide defaults. Next does NOT merge `openGraph` field by field , a page
   * that declares its own replaces this whole object , so any page wanting a
   * different title has to restate the images too (see (marketing)/page.tsx).
   */
  openGraph: {
    type: 'website',
    siteName: 'Faishon Studio',
    url: SITE,
    title: 'Faishon.studio',
    description:
      'AI on-model fashion photography. One garment photo becomes a full photoshoot.',
    images: OG_IMAGES,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Faishon.studio',
    description:
      'AI on-model fashion photography. One garment photo becomes a full photoshoot.',
    images: ['/og/home.jpg'],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}