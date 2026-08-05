import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import AdminClient from './AdminClient';

/** Admin-only, enforced server-side (see logs/page.tsx for the rationale). */
export default async function AdminPage() {
  const u = await currentUser();
  if (!u) redirect('/login');
  if (!u.is_admin) redirect('/generate');

  return <AdminClient />;
}
