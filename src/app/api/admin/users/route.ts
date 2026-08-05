import { handler, json, requireAdmin } from '@/lib/api';
import { listUsers } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = handler(async () => {
  await requireAdmin();
  return json({ users: await listUsers() });
});