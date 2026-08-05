import { handler, json, requireUser } from '@/lib/api';
import { history } from '@/lib/billing';
import { getBalance } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** The signed-in user's payment history. */
export const GET = handler(async (req: Request) => {
  const me = await requireUser();
  const limit = Number(new URL(req.url).searchParams.get('limit') ?? 100);

  return json({
    rows: await history(me._id, Number.isFinite(limit) ? limit : 100),
    balance: await getBalance(me._id),
  });
});