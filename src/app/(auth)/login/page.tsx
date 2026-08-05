import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ensureBootstrapped } from '@/lib/bootstrap';
import { currentUser } from '@/lib/auth';
import AuthForm from '@/components/AuthForm';

export const metadata: Metadata = { title: 'Sign in — AImageGen' };

export default async function LoginPage() {
  await ensureBootstrapped();
  // Already signed in? Skip the form entirely.
  if (await currentUser()) redirect('/generate');
  return <AuthForm mode="login" />;
}
