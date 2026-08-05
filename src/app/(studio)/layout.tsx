import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Inter } from 'next/font/google';
import '../globals.css';
import { ensureBootstrapped } from '@/lib/bootstrap';
import { getMePayload } from '@/lib/me';
import StudioShell from '@/components/StudioShell';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'AImageGen Studio',
  robots: { index: false, follow: false },
};

/**
 * Layout for every signed-in studio route.
 *
 * The auth check runs on the server, so an unauthenticated visitor is redirected
 * before any HTML is sent — no flash of the app followed by a login screen.
 */
export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  await ensureBootstrapped();

  const me = await getMePayload();
  if (!me.authed) redirect('/login');

  return (
    <div className={inter.variable}>
      {/*
        Applies the saved theme before first paint. Without this the studio
        renders light and then flips, which reads as a flash of the wrong theme
        on every load for dark-mode users.
      */}
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){try{var t=localStorage.getItem('aig')||'light';document.documentElement.setAttribute('data-theme',t)}catch(e){}})()`,
        }}
      />
      <StudioShell me={me}>{children}</StudioShell>
    </div>
  );
}
