import { handler, json, requireUser } from '@/lib/api';
import { invoiceFor } from '@/lib/billing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Invoice data for one paid order. Ownership is enforced in invoiceFor(). */
export const GET = handler(
  async (_req: Request, ctx: { params: Promise<{ oid: string }> }) => {
    const { oid } = await ctx.params;
    const me = await requireUser();
    return json(await invoiceFor(oid, me));
  },
);