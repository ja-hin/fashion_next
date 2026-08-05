import { handler, json, requireUser } from '@/lib/api';
import { savedModels } from '@/lib/mongo';
import { publicModel } from '@/lib/saved-models';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Every saved model this user may use, newest first. Admins see all. */
export const GET = handler(async () => {
  const me = await requireUser();
  const filter = me.is_admin ? {} : { owner: me._id };
  const rows = await (await savedModels()).find(filter).sort({ created: -1 }).toArray();
  return json({ models: rows.map(publicModel) });
});