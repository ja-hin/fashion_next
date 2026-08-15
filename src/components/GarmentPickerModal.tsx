'use client';

import { useEffect, useState } from 'react';
import { getJson, imgSrc, ApiError } from '@/lib/client/api';
import { LABEL_FOR } from '@/lib/ensemble';
import { SearchBox } from './ui';
import type { PublicGarment } from '@/lib/types';

/**
 * Pick a garment from the library instead of uploading one.
 *
 * The counterpart to the model picker: the first thing a shoot needs is a
 * garment, and after the first few shoots the user already has the one they
 * want — asking them to find the files again is asking them to redo work they
 * saved specifically to avoid redoing.
 *
 * Choosing one hands it straight back; the caller turns it into tagged refs and
 * opens the tagging window, so it lands in exactly the same place an upload
 * would. See lib/client/garment-refs.ts.
 */
export default function GarmentPickerModal({
  onClose,
  onPick,
}: {
  onClose: () => void;
  onPick: (g: PublicGarment) => void;
}) {
  const [rows, setRows] = useState<PublicGarment[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const j = await getJson<{ garments: PublicGarment[] }>('/api/garments');
        if (live) setRows(j.garments ?? []);
      } catch (e) {
        if (live) setErr(e instanceof ApiError ? e.message : 'Could not load your garments.');
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const needle = q.trim().toLowerCase();
  const shown = needle
    ? rows.filter((g) => [g.name, g.category].join(' ').toLowerCase().includes(needle))
    : rows;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[58] flex items-center justify-center bg-black/50 p-[30px]"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-fade-up flex max-h-full w-full max-w-[760px] flex-col overflow-hidden rounded-[18px] bg-surface shadow-pop"
      >
        <div className="flex items-center gap-3 border-b border-line px-6 py-4">
          <h2 className="text-[17px] font-bold">Use a saved garment</h2>
          <div className="ml-auto w-[200px]">
            <SearchBox value={q} onChange={setQ} placeholder="Search…" />
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-full bg-surface2 text-[15px] text-muted hover:bg-line hover:text-ink"
          >
            ×
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {loading && <div className="text-[13px] text-muted">Loading your garments…</div>}
          {err && <div className="text-[13px] font-semibold text-brand">{err}</div>}

          {!loading && !err && !rows.length && (
            <div className="py-8 text-center text-[13px] leading-[1.6] text-muted">
              You haven&apos;t saved any garments yet.
              <br />
              Tag one below and press <b className="text-ink">Save to My Garments</b> — it will be
              here next time.
            </div>
          )}

          <div className="flex flex-wrap gap-3.5">
            {shown.map((g) => (
              <button
                key={g.id}
                onClick={() => onPick(g)}
                className="w-[164px] overflow-hidden rounded-[13px] border border-line bg-surface text-left transition hover:-translate-y-px hover:border-brand hover:shadow-card"
              >
                <span className="relative block aspect-[4/5] bg-surface2">
                  {g.thumb && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imgSrc(g.thumb, 'thumb')}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  )}
                  <span className="absolute bottom-1.5 right-1.5 rounded bg-black/70 px-1.5 py-[2px] text-[9.5px] font-bold text-white">
                    {g.ref_count}
                  </span>
                  {g.mode === 'ensemble' && (
                    <span className="absolute left-1.5 top-1.5 rounded bg-accent/90 px-1.5 py-[2px] text-[9px] font-bold text-white">
                      Look
                    </span>
                  )}
                </span>

                <span className="block px-2.5 py-2">
                  <span className="block truncate text-[12.5px] font-bold">{g.name}</span>
                  {/* The angles it has decide whether a rear or detail pose can
                      come out right, so they are worth seeing before choosing. */}
                  <span className="mt-1 flex flex-wrap gap-1">
                    {g.refs.map((r) => (
                      <span
                        key={r.file}
                        className="rounded bg-surface2 px-1.5 py-[2px] text-[8.5px] font-semibold text-muted"
                      >
                        {LABEL_FOR[g.mode]?.[r.role] ?? r.role}
                      </span>
                    ))}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
