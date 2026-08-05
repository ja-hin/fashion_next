import { handler, json, requireUser } from '@/lib/api';
import { shoots } from '@/lib/mongo';
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
  const q = (new URL(req.url).searchParams.get('q') ?? '').toLowerCase().trim();

  const filter = me.is_admin ? {} : { 'opts.owner': me._id };
  const rows = await (await shoots()).find(filter).sort({ created: -1 }).toArray();

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
    if (q) {
      const hay = [
        String(s.seed),
        category.toLowerCase(),
        name.toLowerCase(),
        shootNo.toLowerCase(),
        man.map((m) => m.pose).join(' ').toLowerCase(),
        created,
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
  });
});