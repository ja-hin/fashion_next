'use client';

import { useCallback, useEffect } from 'react';
import { bust } from '@/lib/client/api';
import { DownloadIcon } from './icons';
import type { LbItem } from '@/lib/client/types';

interface Props {
  items: LbItem[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
}

/** Full-screen image viewer with prev/next, keyboard nav and a download button. */
export default function Lightbox({ items, index, onIndex, onClose }: Props) {
  const item = items[index];

  const prev = useCallback(() => {
    if (index > 0) onIndex(index - 1);
  }, [index, onIndex]);

  const next = useCallback(() => {
    if (index < items.length - 1) onIndex(index + 1);
  }, [index, items.length, onIndex]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, prev, next]);

  if (!item) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-[14px] bg-[rgba(10,8,8,.9)]"
      onClick={onClose}
    >
      <div
        className="relative flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={prev}
          aria-label="Previous image"
          style={{ visibility: index > 0 ? 'visible' : 'hidden' }}
          className="absolute -left-[62px] top-1/2 z-[4] flex h-[46px] w-[46px] -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-2xl font-bold text-[#141414] shadow-[0_4px_14px_rgba(0,0,0,.4)] hover:bg-brand hover:text-white"
        >
          ‹
        </button>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={bust(item.url)}
          alt={item.pose ?? 'Generated image'}
          className="block max-h-[80vh] max-w-[82vw] rounded-[10px] shadow-pop"
        />

        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute -right-[15px] -top-[15px] z-[4] flex h-[34px] w-[34px] items-center justify-center rounded-full border border-black/5 bg-white text-[19px] font-bold text-[#141414] shadow-[0_4px_14px_rgba(0,0,0,.45)] hover:bg-brand hover:text-white"
        >
          ×
        </button>

        <button
          onClick={next}
          aria-label="Next image"
          style={{ visibility: index < items.length - 1 ? 'visible' : 'hidden' }}
          className="absolute -right-[62px] top-1/2 z-[4] flex h-[46px] w-[46px] -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-2xl font-bold text-[#141414] shadow-[0_4px_14px_rgba(0,0,0,.4)] hover:bg-brand hover:text-white"
        >
          ›
        </button>
      </div>

      <a
        href={item.dl ?? item.url}
        download={item.name ?? 'image.jpg'}
        onClick={(e) => e.stopPropagation()}
        className="inline-flex items-center gap-[9px] rounded-[30px] bg-brand px-[26px] py-3 text-sm font-bold text-white shadow-[0_8px_24px_rgba(225,29,42,.4)] transition hover:-translate-y-0.5"
      >
        <DownloadIcon className="h-4 w-4" /> Download
      </a>
    </div>
  );
}