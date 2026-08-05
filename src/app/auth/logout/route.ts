import { cookies } from 'next/headers';
import { handler, json } from '@/lib/api';
import { destroySession, clearSessionCookie, SESSION_COOKIE } from '@/lib/auth';

export const runtime = 'nodejs';

export const POST = handler(async () => {
  const jar = await cookies();
  await destroySession(jar.get(SESSION_COOKIE)?.value);
  await clearSessionCookie();
  return json({ ok: true });
});