'use client';

import { bust } from '@/lib/client/api';
import type { SavedModel, LbItem } from '@/lib/client/types';

/**
 * The grid + six sliced frames of one character-sheet batch.
 *
 * Shared by the model folder and the inline picker flow so both render the
 * result identically.
 */
export default function CharsheetResult({
  model,
  batch,
  onZoom,
  onDeleteFrame,
}: {
  model: SavedModel;
  batch: string | null;
  onZoom?: (items: LbItem[], index: number) => void;
  onDeleteFrame?: (file: string) => void;
}) {
  const refs = model.refs ?? [];
  const grids = refs.filter((r) => r.charsheet === 'grid');
  // Batches are appended, never reordered, so the last grid is the newest.
  const activeBatch = batch ?? (grids.length ? grids[grids.length - 1].batch : null);
  const gridRef = grids.find((r) => r.batch === activeBatch);
  const frames = refs.filter((r) => r.charsheet === 'frame' && r.batch === activeBatch);

  if (!gridRef) return null;

  const lbItems: LbItem[] = [
    { url: gridRef.url, dl: gridRef.url, name: 'charsheet_grid', pose: 'Full character sheet' },
    ...frames.map((r) => ({
      url: r.url,
      dl: r.url,
      name: `charsheet_${r.file}`,
      pose: r.pose,
    })),
  ];

  return (
    <div className="flex flex-wrap items-start gap-5">
      <div
        onClick={() => onZoom?.(lbItems, 0)}
        className={`w-[200px] flex-shrink-0 overflow-hidden rounded-xl transition ${
          onZoom ? 'cursor-zoom-in hover:scale-[1.02]' : ''
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={bust(gridRef.url)} alt="Character sheet grid" className="block w-full" />
      </div>

      <div className="min-w-[220px] flex-1">
        <div className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.03em] text-muted">
          Sliced into {frames.length} individual references
          {onZoom ? ' — click any to zoom' : ''}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {frames.map((r, i) => (
            <div
              key={r.file}
              className="relative aspect-[3/4] overflow-hidden rounded-lg transition hover:scale-[1.04]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={bust(r.url)}
                alt={r.pose}
                onClick={() => onZoom?.(lbItems, i + 1)}
                className={`block h-full w-full object-cover ${onZoom ? 'cursor-zoom-in' : ''}`}
              />
              <span className="absolute inset-x-0 bottom-0 bg-black/55 px-[5px] py-1 text-[9px] text-white">
                {r.pose}
              </span>
              {onDeleteFrame && (
                <button
                  title="Remove"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteFrame(r.file);
                  }}
                  className="absolute right-[5px] top-[5px] z-[2] flex h-[22px] w-[22px] items-center justify-center rounded-full bg-black/55 text-white hover:bg-brand"
                >
                  <svg viewBox="0 0 24 24" className="h-[11px] w-[11px]" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M3 6h18" />
                    <path d="M8 6V4h8v2" />
                    <path d="M6 6l1 14h10l1-14" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}