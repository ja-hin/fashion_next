'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { imgSrc } from '@/lib/client/api';
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

  // imgSrc() cache-busts with Date.now(), so it has to be pinned per image —
  // recomputing it on every render would restart the load (and the spinner).
  const url = item?.url ?? '';
  const src = useMemo(() => (url ? imgSrc(url, 'web') : ''), [url]);
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');

  useEffect(() => {
    setStatus('loading');
  }, [src]);

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
      {/* Fixed frame: the image loading, failing or being a different shape must
          never move the nav, close or download controls. */}
      <div
        className="relative flex h-[76vh] w-[min(78vw,1000px)] items-center justify-center rounded-[10px] bg-transparent"
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

        {status === 'loading' && (
          <div className="animate-spin-cs absolute h-10 w-10 rounded-full border-[3px] border-white/25 border-t-white" />
        )}

        {status === 'error' ? (
          <div className="flex flex-col items-center gap-2 text-white/60">
            <span className="text-3xl">🖼</span>
            <span className="text-sm">Image unavailable</span>
          </div>
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            key={src}
            // A cached image can finish before React attaches onLoad, so the ref
            // catches the already-complete case.
            ref={(el) => {
              if (el?.complete) setStatus(el.naturalWidth ? 'ok' : 'error');
            }}
            src={src}
            alt={item.pose ?? 'Generated image'}
            onLoad={() => setStatus('ok')}
            onError={() => setStatus('error')}
            className={`block max-h-full max-w-full rounded-[10px] object-contain shadow-pop transition-opacity duration-200 ${
              status === 'ok' ? 'opacity-100' : 'opacity-0'
            }`}
          />
        )}

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