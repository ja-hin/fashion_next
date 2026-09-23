import type { Metadata, Viewport } from 'next';

/**
 * Root layout, deliberately renders nothing but the document shell.
 *
 * The marketing page and the studio have their OWN design systems that both
 * define `--bg`, `--muted`, `--line` and `--shadow` with different values, so
 * neither stylesheet may be global. Each route group's layout imports only its
 * own CSS (see (marketing)/layout.tsx and (studio)/layout.tsx).
 */

/**
 * `metadataBase` is what every relative URL in the tree resolves against.
 */
const SITE = 'https://faishon.studio';

/** The share card. */
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

/**
 * Organization structured data.
 * Helps search engines understand the identity of Faishon Studio.
 */
const ORGANIZATION_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Faishon Studio',
  legalName: '3rd i Visuals Pvt. Ltd.',
  alternateName: 'Faishon Studio by 3rd i Visuals',
  url: SITE,
  logo: `${SITE}/logo-black.png`,
  description:
    'AI on-model fashion photography and video for D2C brands and ecommerce sellers in India.',
  email: 'studio.support@faishon.studio',
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Bangalore',
    addressRegion: 'Karnataka',
    addressCountry: 'IN',
  },
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE),

  title: 'Faishon.studio',

  description:
    'AI on-model fashion photography. One garment photo becomes a full photoshoot.',

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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(ORGANIZATION_SCHEMA),
          }}
        />

        {children}
      </body>
    </html>
  );
}