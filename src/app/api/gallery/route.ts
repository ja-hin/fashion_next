import { handler, json, requireUser } from '@/lib/api';
import { shoots, users } from '@/lib/mongo';
import { shootUrl } from '@/lib/storage';
import { shootNoStr } from '@/lib/settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The Gallery: every shoot that has at least one image, newest first, grouped
 * by date. Non-admins only ever see their own.
 */
export const GET = handler(async (req: Request) => {
  const me = await requireUser();
  const params = new URL(req.url).searchParams;
  const q = (params.get('q') ?? '').toLowerCase().trim();
  const userFilter = (params.get('user') ?? '').trim();

  /*
   * Non-admins are pinned to their own shoots, always. The `user` parameter is
   * read ONLY for admins — honouring it for anyone else would turn this into an
   * "any shoot by id" endpoint and undo the isolation entirely.
   */
  const filter: Record<string, unknown> = me.is_admin ? {} : { 'opts.owner': me._id };

  // Admin-only: narrow to one account, given its uid (U0007), email or raw id.
  let filteredUser: { uid: string; email: string } | null = null;
  if (me.is_admin && userFilter) {
    const target = await (await users()).findOne({
      $or: [
        { uid: userFilter.toUpperCase() },
        { email: userFilter.toLowerCase() },
        { _id: userFilter },
      ],
    });
    // An unmatched filter must return nothing, not silently fall back to "all".
    filter['opts.owner'] = target?._id ?? '__no_such_user__';
    if (target) filteredUser = { uid: target.uid ?? '', email: target.email };
  }

  const rows = await (await shoots()).find(filter).sort({ created: -1 }).toArray();

  // Owner labels for the admin view. One query for every owner on the page
  // rather than a lookup per shoot.
  const ownerById = new Map<string, { uid: string; email: string }>();
  if (me.is_admin) {
    const ids = [...new Set(rows.map((s) => s.opts?.owner).filter(Boolean))] as string[];
    if (ids.length) {
      const owners = await (await users())
        .find({ _id: { $in: ids } }, { projection: { uid: 1, email: 1 } })
        .toArray();
      for (const o of owners) ownerById.set(o._id, { uid: o.uid ?? '', email: o.email });
    }
  }

  const items = [];
  for (const s of rows) {
    const man = s.manifest ?? [];
    if (!man.length) continue;

    const thumbFile = s.hero_file ?? man[0].file;
    const created = s.created ?? '';
    const name = (s.name ?? '').trim();
    const shootNo = shootNoStr(s.no);
    const category = s.opts?.category ?? '';

    // Search covers the seed, category, name, shoot number, every pose and the
    // date — the same haystack as the old app.
    const owner = me.is_admin ? ownerById.get(s.opts?.owner ?? '') : undefined;

    if (q) {
      const hay = [
        String(s.seed),
        category.toLowerCase(),
        name.toLowerCase(),
        shootNo.toLowerCase(),
        man.map((m) => m.pose).join(' ').toLowerCase(),
        created,
        // Admins can search by who made it; regular users have no owner data
        // in scope, so this adds nothing to their haystack.
        (owner?.uid ?? '').toLowerCase(),
        (owner?.email ?? '').toLowerCase(),
      ].join(' ');
      if (!hay.includes(q)) continue;
    }

    items.push({
      pid: s._id,
      seed: s.seed,
      no: s.no ?? 0,
      shoot: shootNo,
      name,
      title: name || shootNo,
      created,
      date: created.slice(0, 10),
      count: man.length,
      thumb: shootUrl(s._id, thumbFile),
      category,
      model: s.opts?.style ?? '',
      // Present only for admins — a regular user never receives another
      // account's identity, even as a label.
      owner_uid: owner?.uid,
      owner_email: owner?.email,
    });
  }

  const today = new Date().toISOString().slice(0, 10);
  const groups = new Map<string, typeof items>();
  for (const r of items) {
    const label = r.date === today ? 'Today' : r.date;
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(r);
  }

  return json({
    groups: [...groups.entries()].map(([date, list]) => ({ date, items: list })),
    is_admin: !!me.is_admin,
    // Echoed back so the UI can show "showing U0007's shoots" and offer a clear.
    filtered_user: filteredUser,
    total: items.length,
  });
});