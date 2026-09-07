'use client';

import { useEffect, useRef, useState } from 'react';
import { LABEL_FOR, MAX_ENSEMBLE_REFS, type RefMode } from '@/lib/ensemble';
import { UploadIcon, ShirtIcon } from './icons';
import type { EnsembleRef } from '@/lib/client/ensemble-types';

/**
 * The ensemble block in the setup panel.
 *
 * Deliberately thin: dropping images here opens the tagging window rather than
 * trying to tag them in a 336px column. Six items with a role select, a
 * confidence badge and a reason line each do not fit in a sidebar, and tagging
 * is the step that decides whether the hero comes out right , see
 * EnsembleTagModal.
 *
 * Once tagged, this shows the summary so the panel still tells you what the
 * shoot is made of, and clicking it reopens the window.
 */
export default function EnsembleUploader({
  mode,
  refs,
  onAdd,
  onOpen,
  onPickSaved,
}: {
  mode: RefMode;
  refs: EnsembleRef[];
  /** Files dropped straight onto the panel , the modal opens to tag them. */
  onAdd: (files: File[]) => void;
  onOpen: () => void;
  /** Open the library instead of uploading. */
  onPickSaved: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [menu, setMenu] = useState(false);
  const menuWrap = useRef<HTMLDivElement>(null);

  /* Close on a click anywhere else, or on Escape. `mousedown` rather than
     `click`, so the menu is gone before the zone underneath sees the release
     and opens the file picker. Bound only while it is open. */
  useEffect(() => {
    if (!menu) return;
    const away = (e: MouseEvent) => {
      if (!menuWrap.current?.contains(e.target as Node)) setMenu(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenu(false);
    };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [menu]);

  function take(files: FileList | File[] | null | undefined) {
    const picked = Array.from(files ?? []).filter((f) => f.type.startsWith('image/'));
    if (picked.length) onAdd(picked);
    if (inputRef.current) inputRef.current.value = '';
  }

  if (refs.length) {
    return (
      <div className="mb-4">
        <button
          onClick={onOpen}
          className="w-full rounded-xl border border-line bg-surface2 p-2.5 text-left transition hover:border-brand"
        >
          <div className="mb-2 flex items-center gap-1.5">
            <span className="text-[11.5px] font-bold">
              {refs.length} {mode === 'ensemble' ? 'item' : 'photo'}{refs.length === 1 ? '' : 's'}
            </span>
            {refs.some((r) => r.detecting) ? (
              <span className="flex items-center gap-1 text-[9.5px] font-bold text-muted">
                <span className="animate-spin-cs inline-block h-[9px] w-[9px] rounded-full border-[1.5px] border-line border-t-brand" />
                identifying…
              </span>
            ) : refs.some((r) => r.unsure) && (
              <span className="rounded bg-amber-soft px-1.5 py-[2px] text-[9.5px] font-bold text-amber">
                confirm tags
              </span>
            )}
            <span className="ml-auto text-[10.5px] font-bold text-brand">edit ›</span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {refs.map((r) => (
              <span key={r.url} className="w-[52px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={r.url}
                  alt=""
                  className="h-[52px] w-[52px] rounded-lg bg-surface object-cover"
                />
                <span className="mt-0.5 block truncate text-[8.5px] font-semibold text-muted">
                  {r.detecting ? '…' : LABEL_FOR[mode][r.role]}
                </span>
              </span>
            ))}
          </div>
        </button>
      </div>
    );
  }

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        take(e.dataTransfer.files);
      }}
      className={`mb-4 cursor-pointer rounded-xl border-[1.5px] border-dashed px-4 py-7 text-center transition ${
        dragging ? 'border-brand bg-brand-soft' : 'border-line bg-surface hover:border-brand'
      }`}
    >
      <UploadIcon className="mx-auto mb-3 h-9 w-9 text-brand" />
      <div className="text-[13.5px] font-bold text-ink">Drag &amp; drop files here</div>
      <div className="mt-1 text-[11.5px] leading-[1.5] text-muted">
        {mode === 'ensemble' ? 'A top, a bag, shoes…' : 'Front, back, a detail…'} up to{' '}
        {MAX_ENSEMBLE_REFS} images
      </div>

      {/* A split button, and real buttons at that: the whole panel being
          clickable is an affordance you cannot see, and a bare <div onClick>
          cannot be reached by keyboard at all. The zone still takes a click and
          a drop; this is the part that takes a Tab and an Enter.
          Every handler in here stops propagation, or the click bubbles back to
          the zone and opens the file picker behind the menu. */}
      <div
        ref={menuWrap}
        className="relative mt-4 inline-flex"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="rounded-l-[9px] bg-brand px-5 py-2.5 text-[12.5px] font-bold text-white transition hover:brightness-110"
        >
          Select File
        </button>
        {/* Hairline between the halves so the caret reads as its own control. */}
        <button
          type="button"
          aria-label="More upload options"
          aria-haspopup="menu"
          aria-expanded={menu}
          onClick={() => setMenu((v) => !v)}
          className="rounded-r-[9px] border-l border-white/25 bg-brand px-2.5 py-2.5 text-white transition hover:brightness-110"
        >
          <span className={`block text-[9px] leading-none transition ${menu ? '' : 'rotate-180'}`}>
            ▲
          </span>
        </button>

        {menu && (
          <div
            role="menu"
            className="absolute left-1/2 top-[calc(100%+6px)] z-30 w-[196px] -translate-x-1/2 overflow-hidden rounded-xl border border-line bg-surface py-1 text-left shadow-card"
          >
            <button
              role="menuitem"
              type="button"
              onClick={() => {
                setMenu(false);
                inputRef.current?.click();
              }}
              className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-[12.5px] font-semibold text-ink hover:bg-surface2"
            >
              <UploadIcon className="h-4 w-4 text-muted" />
              From my computer
            </button>
            <button
              role="menuitem"
              type="button"
              onClick={() => {
                setMenu(false);
                onPickSaved();
              }}
              className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-[12.5px] font-semibold text-ink hover:bg-surface2"
            >
              <ShirtIcon className="h-4 w-4 text-accent" />
              Use a saved garment
            </button>
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => take(e.target.files)}
      />
    </div>
  );
}
