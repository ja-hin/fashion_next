'use client';

import { useRef, useState } from 'react';
import { LABEL_FOR, MAX_ENSEMBLE_REFS, type RefMode } from '@/lib/ensemble';
import type { EnsembleRef } from '@/lib/client/ensemble-types';

/**
 * The ensemble block in the setup panel.
 *
 * Deliberately thin: dropping images here opens the tagging window rather than
 * trying to tag them in a 336px column. Six items with a role select, a
 * confidence badge and a reason line each do not fit in a sidebar, and tagging
 * is the step that decides whether the hero comes out right — see
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
  /** Files dropped straight onto the panel — the modal opens to tag them. */
  onAdd: (files: File[]) => void;
  onOpen: () => void;
  /** Open the library instead of uploading. */
  onPickSaved: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

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
    <>
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
      className={`mb-4 cursor-pointer rounded-xl border-[1.5px] border-dashed p-[22px_14px] text-center text-[12.5px] transition ${
        dragging
          ? 'border-brand bg-brand-soft text-brand'
          : 'border-line bg-surface2 text-muted hover:border-brand hover:bg-brand-soft hover:text-brand'
      }`}
    >
      <span className="mb-1.5 block text-[22px] opacity-60">⤓</span>
      Drop your{' '}
      <b className="text-ink">{mode === 'ensemble' ? 'product images' : 'garment photos'}</b>
      <br />
      <span className="text-[11px]">
        {mode === 'ensemble' ? 'a top, a bag, shoes…' : 'front, back, a detail…'} up to{' '}
        {MAX_ENSEMBLE_REFS}
      </span>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => take(e.target.files)}
      />
    </div>

    {/* After the first few shoots the garment you want is usually already
        saved, and hunting for the files again is redoing the work the library
        exists to avoid. */}
    <div className="mb-4 mt-2 flex items-center gap-2">
      <span className="h-px flex-1 bg-line" />
      <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-muted">or</span>
      <span className="h-px flex-1 bg-line" />
    </div>
    <button
      onClick={onPickSaved}
      className="mb-4 -mt-2 w-full rounded-[9px] border border-accent/40 bg-accent-soft p-[9px] text-[12px] font-bold text-accent hover:border-accent"
    >
      ♡ Use a saved garment
    </button>
    </>
  );
}
