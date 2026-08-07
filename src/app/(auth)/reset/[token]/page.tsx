import type { Metadata } from 'next';
import { ensureBootstrapped } from '@/lib/bootstrap';
import { peekReset } from '@/lib/password-reset';
import AuthShell from '@/components/AuthShell';
import ResetForm from '@/components/ResetForm';

export const runtime = 'nodejs';
// The token is checked live, so this must never be prerendered or cached.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Choose a new password — AImageGen',
  robots: { index: false, follow: false },
};

/**
 * The page a reset link opens.
 *
 * Validity is checked on the server before rendering — `peekReset` looks the
 * token up WITHOUT spending it, so merely opening the link (or an email client
 * prefetching it) can't burn the one use. It's consumed on submit.
 *
 * No redirect for signed-in users here: someone who requested a reset because
 * their account may be compromised needs the link to work even if a session
 * cookie is still lying around.
 */
export default async function ResetPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  await ensureBootstrapped();
  const { token } = await params;
  const doc = await peekReset(token);

  return (
    <AuthShell>
      <ResetForm token={token} valid={!!doc} />
    </AuthShell>
  );
}