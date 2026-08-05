import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ensureBootstrapped } from '@/lib/bootstrap';
import { currentUser } from '@/lib/auth';
import AuthForm from '@/components/AuthForm';

export const metadata: Metadata = { title: 'Create your account — AImageGen' };

export default async function RegisterPage() {
  await ensureBootstrapped();
  if (await currentUser()) redirect('/generate');
  return <AuthForm mode="register" />;
}
