import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ensureBootstrapped } from '@/lib/bootstrap';
import { currentUser } from '@/lib/auth';
import AuthShell from '@/components/AuthShell';
import ForgotForm from '@/components/ForgotForm';

export const runtime = 'nodejs';
export const metadata: Metadata = { title: 'Reset your password — AImageGen' };

export default async function ForgotPage() {
  await ensureBootstrapped();
  // Already signed in? Nothing to recover.
  if (await currentUser()) redirect('/generate');

  return (
    <AuthShell>
      <ForgotForm />
    </AuthShell>
  );
}