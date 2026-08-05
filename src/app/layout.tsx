import type { Metadata, Viewport } from 'next';

/**
 * Root layout — deliberately renders nothing but the document shell.
 *
 * The marketing page and the studio have their OWN design systems that both
 * define `--bg`, `--muted`, `--line` and `--shadow` with different values, so
 * neither stylesheet may be global. Each route group's layout imports only its
 * own CSS (see (marketing)/layout.tsx and (studio)/layout.tsx).
 */

export const metadata: Metadata = {
  title: 'AImageGen',
  description:
    'AI on-model fashion photography. One garment photo becomes a full photoshoot.',
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