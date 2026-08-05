'use client';

import { bust } from '@/lib/client/api';
import { CopyIcon, RegenIcon, DownloadIcon, TrashIcon } from './icons';
import type { CardItem } from '@/lib/client/types';

/** One generated image, with copy / regenerate / download / delete actions. */
export default function ResultCard({
  card,
  pid,
  onZoom,
  onRetry,
  onDelete,
}: {
  card: CardItem;
  pid: string | null;
  onZoom: () => void;
  onRetry: () => void;
  onDelete?: () => void;
}) {
  if (card.error) {
    return (
      <div className="w-[212px] overflow-hidden rounded-card border border-line bg-surface shadow-card">
        <div className="p-[14px] text-xs leading-[1.5] text-brand">
          {card.error}
          <br />
          <button
            onClick={onRetry}
            className="mt-2 rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-white"
          >
            ↻ Retry
          </button>
        </div>
      </div>
    );
  }

  const dlUrl = pid ? `/api/product/${pid}/file/${card.file}` : card.img;

  return (
    <div className="w-[212px] overflow-hidden rounded-card border border-line bg-surface shadow-card transition hover:-translate-y-[3px] hover:shadow-pop">
      <div className="relative aspect-[4/5] bg-surface2">
        {card.isHero && (
          <div className="absolute left-[9px] top-[9px] z-[2] flex items-center gap-1 rounded-md bg-black/75 px-2 py-[3px] text-[9.5px] font-bold text-white">
            🔒 locked
          </div>
        )}
        {!card.isHero && card.warn && (
          <div className="absolute inset-x-[9px] top-[9px] z-[2] rounded-md bg-amber-soft px-[7px] py-1 text-[9.5px] font-bold text-amber">
            ⚠ {card.warn}
          </div>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={bust(card.img)}
          alt={card.pose}
          onClick={onZoom}
          className="block h-full w-full cursor-zoom-in object-cover"
        />
      </div>

      <div className="flex items-center justify-between gap-1.5 px-[11px] py-[9px]">
        <span className="truncate text-xs font-semibold" title={card.pose}>
          {card.pose}
        </span>
        <span className="flex flex-shrink-0 items-center gap-2 text-muted">
          <button
            title="Copy prompt"
            onClick={() => navigator.clipboard?.writeText(card.pose)}
            className="hover:text-brand"
          >
            <CopyIcon />
          </button>
          <button title="Regenerate" onClick={onRetry} className="hover:text-brand">
            <RegenIcon />
          </button>
          <a title="Download" href={dlUrl} className="hover:text-brand">
            <DownloadIcon />
          </a>
          {onDelete && (
            <button title="Delete" onClick={onDelete} className="hover:text-brand">
              <TrashIcon />
            </button>
          )}
        </span>
      </div>
    </div>
  );
}