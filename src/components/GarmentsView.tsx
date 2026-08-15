'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getJson, del, patchForm, imgSrc, ApiError } from '@/lib/client/api';
import { LABEL_FOR } from '@/lib/ensemble';
import { EmptyState, SearchBox } from './ui';
import { useDialog } from './Dialog';
import { DownloadIcon, TrashIcon, PlayIcon } from './icons';
import type { PublicGarment } from '@/lib/types';
import type { LbItem } from '@/lib/client/types';

/**
 * My Garments — the reusable product library.
 *
 * Tagging a garment's angles is the work that stops its back being invented,
 * and it is work nobody wants to repeat per shoot. This is where that work
 * lives: save once, then start any number of shoots from it.
 *
 * Using one deliberately does NOT re-upload. The bytes are already on the
 * server, so /generate is handed the garment's id and copies them itself.
 */
export default function GarmentsView({
  onZoom,
  refreshKey,
}: {
  onZoom: (items: LbItem[], index: number) => void;
  /** Bumped elsewhere to force a reload after a save. */
  refreshKey?: number;
}) {
  const router = useRouter();
  const dialog = useDialog();

  const [rows, setRows] = useState<PublicGarment[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const j = await getJson<{ garments: PublicGarment[] }>('/api/garments');
      setRows(j.garments ?? []);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Could not load your garments.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const needle = q.trim().toLowerCase();
  const shown = needle
    ? rows.filter((g) =>
        [g.name, g.category, g.mode].join(' ').toLowerCase().includes(needle),
      )
    : rows;

  async function rename(g: PublicGarment) {
    const next = await dialog.prompt('Rename this garment', g.name);
    if (!next?.trim() || next.trim() === g.name) return;
    try {
      await patchForm(`/api/garments/${g.id}`, { name: next.trim() });
      await load();
    } catch (e) {
      await dialog.alert(e instanceof ApiError ? e.message : 'Could not rename it.');
    }
  }

  async function remove(g: PublicGarment) {
    if (
      !(await dialog.confirm(
        `Delete "${g.name}" and its ${g.ref_count} image${g.ref_count === 1 ? '' : 's'}? Shoots already made from it are not affected.`,
        { title: 'Delete garment' },
      ))
    )
      return;

    try {
      await del(`/api/garments/${g.id}`);
      setRows((prev) => prev.filter((r) => r.id !== g.id));
    } catch (e) {
      await dialog.alert(e instanceof ApiError ? e.message : 'Could not delete it.');
    }
  }

  /** Hand the id to /generate; the panel picks it up and the server copies it. */
  function use(g: PublicGarment) {
    router.push(`/generate?garment=${encodeURIComponent(g.id)}`);
  }

  if (loading) {
    return <div className="text-[13px] text-muted">Loading your garments…</div>;
  }

  if (err) {
    return <div className="text-[13px] font-semibold text-brand">{err}</div>;
  }

  if (!rows.length) {
    return (
      <EmptyState icon="👕" title="No saved garments yet">
        Tag a garment&apos;s photos on the Generate tab and press <b>Save garment</b>. It lands here,
        ready to start any number of shoots without tagging it again.
      </EmptyState>
    );
  }

  return (
    <div className="animate-fade-up">
      <div className="mb-5 flex items-center gap-[14px]">
        <h2 className="text-[23px] font-bold tracking-[-0.01em]">My Garments</h2>
        <span className="rounded-[20px] bg-surface2 px-2.5 py-1 text-xs font-semibold text-muted">
          {rows.length} saved
        </span>
        <div className="ml-auto w-[240px]">
          <SearchBox value={q} onChange={setQ} placeholder="Search garments…" />
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        {shown.map((g) => {
          const lb: LbItem[] = g.refs.map((r) => ({
            url: r.url,
            dl: r.url,
            name: r.file,
            pose: LABEL_FOR[g.mode]?.[r.role] ?? r.role,
          }));

          return (
            <div
              key={g.id}
              className="w-[230px] overflow-hidden rounded-card border border-line bg-surface shadow-card transition hover:-translate-y-[3px] hover:shadow-pop"
            >
              <div
                className="relative aspect-[4/5] cursor-zoom-in bg-surface2"
                onClick={() => onZoom(lb, 0)}
              >
                {g.thumb && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imgSrc(g.thumb, 'thumb')}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                )}
                <span className="absolute bottom-2 right-2 rounded-md bg-black/70 px-2 py-[3px] text-[10px] font-bold text-white">
                  {g.ref_count} image{g.ref_count === 1 ? '' : 's'}
                </span>
                {g.mode === 'ensemble' && (
                  <span className="absolute left-2 top-2 rounded-md bg-accent/90 px-2 py-[3px] text-[9.5px] font-bold text-white">
                    Look
                  </span>
                )}
              </div>

              <div className="px-[11px] py-[9px]">
                <button
                  onClick={() => rename(g)}
                  title="Rename"
                  className="block w-full truncate text-left text-[13px] font-bold hover:text-brand"
                >
                  {g.name}
                </button>
                <div className="mt-0.5 flex flex-wrap gap-1">
                  {g.refs.map((r) => (
                    <span
                      key={r.file}
                      className="rounded bg-surface2 px-1.5 py-[2px] text-[9px] font-semibold text-muted"
                    >
                      {LABEL_FOR[g.mode]?.[r.role] ?? r.role}
                    </span>
                  ))}
                </div>

                <div className="mt-2.5 flex items-center gap-1.5">
                  <button
                    onClick={() => use(g)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand px-2 py-[7px] text-[11.5px] font-bold text-white"
                  >
                    <PlayIcon /> Use
                  </button>
                  <a
                    href={`/api/garments/${g.id}/zip`}
                    title="Download the original images"
                    className="flex h-[30px] w-[30px] items-center justify-center rounded-lg border border-line text-muted hover:border-brand hover:text-brand"
                  >
                    <DownloadIcon />
                  </a>
                  <button
                    onClick={() => remove(g)}
                    title="Delete"
                    className="flex h-[30px] w-[30px] items-center justify-center rounded-lg border border-line text-muted hover:border-brand hover:text-brand"
                  >
                    <TrashIcon />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
