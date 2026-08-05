import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import LogsClient from './LogsClient';

/**
 * Admin-only. The check runs on the server, so a non-admin never receives the
 * page at all — the old client-side hash guard could be bypassed by editing the
 * URL fragment.
 */
export default async function LogsPage() {
  const u = await currentUser();
  if (!u) redirect('/login');
  if (!u.is_admin) redirect('/generate');

  return <LogsClient />;
}
