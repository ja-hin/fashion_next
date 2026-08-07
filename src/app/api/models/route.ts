import { handler, json, requireUser } from '@/lib/api';
import { savedModels, users } from '@/lib/mongo';
import { publicModel } from '@/lib/saved-models';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Every saved model this user may use, newest first. Admins see all. */
export const GET = handler(async (req: Request) => {
  const me = await requireUser();
  const userFilter = (new URL(req.url).searchParams.get('user') ?? '').trim();

  /*
   * Non-admins are pinned to their own models, always. `user` is honoured ONLY
   * for admins — reading it for anyone else would turn this into an "any
   * model by owner" endpoint and defeat the isolation.
   */
  const filter: Record<string, unknown> = me.is_admin ? {} : { owner: me._id };

  let filteredUser: { uid: string; email: string } | null = null;
  if (me.is_admin && userFilter) {
    const target = await (await users()).findOne({
      $or: [
        { uid: userFilter.toUpperCase() },
        { email: userFilter.toLowerCase() },
        { _id: userFilter },
      ],
    });
    // An unmatched filter must return nothing, not fall back to "everyone".
    filter.owner = target?._id ?? '__no_such_user__';
    if (target) filteredUser = { uid: target.uid ?? '', email: target.email };
  }

  const rows = await (await savedModels()).find(filter).sort({ created: -1 }).toArray();

  // Owner labels, admin only. One query for the whole page rather than per row.
  const ownerById = new Map<string, { uid: string; email: string }>();
  if (me.is_admin) {
    const ids = [...new Set(rows.map((r) => r.owner).filter(Boolean))];
    if (ids.length) {
      const owners = await (await users())
        .find({ _id: { $in: ids } }, { projection: { uid: 1, email: 1 } })
        .toArray();
      for (const o of owners) ownerById.set(o._id, { uid: o.uid ?? '', email: o.email });
    }
  }

  return json({
    models: rows.map((r) => {
      const pub = publicModel(r);
      if (!me.is_admin) return pub;
      // Attached for admins only — a regular user never receives another
      // account's identity, even as a label.
      const o = ownerById.get(r.owner ?? '');
      return { ...pub, owner_uid: o?.uid ?? '', owner_email: o?.email ?? r.owner_email ?? '' };
    }),
    is_admin: !!me.is_admin,
    filtered_user: filteredUser,
  });
});