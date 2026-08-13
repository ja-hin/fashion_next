'use client';

import { useEffect, useRef, useState } from 'react';
import { postMultipart } from '@/lib/client/api';
import { Select } from './ui';
import {
  ROLES_FOR,
  LABEL_FOR,
  MAX_ENSEMBLE_REFS,
  asRole,
  type RefMode,
  type RefRole,
} from '@/lib/ensemble';
import type { EnsembleRef } from '@/lib/client/ensemble-types';

interface Detected {
  role: RefRole;
  confidence: number;
  reason?: string;
  unsure?: boolean;
}

/** Object URLs are created here, so they are revoked here. */
const toRef = (file: File, mode: RefMode): EnsembleRef => ({
  file,
  role: asRole(null, mode),
  url: URL.createObjectURL(file),
  detecting: true,
  unsure: true,
});

/** Wording per mode — the two windows ask genuinely different questions. */
const COPY: Record<RefMode, { badge: string; blurb: string; hint: string }> = {
  ensemble: {
    badge: 'Ensemble',
    blurb:
      'Each image is a separate item. Tag what each one is, then generate one model wearing the whole look.',
    hint: 'a top, a bag, shoes…',
  },
  same_garment: {
    badge: 'Same garment',
    blurb:
      'Every image is the SAME garment from a different angle. Tag which view each one is — the back photo becomes the truth for the back, so it is never invented.',
    hint: 'front, back, a detail…',
  },
};

/**
 * "Tag your images" — the window that opens as soon as ensemble images are
 * dropped.
 *
 * Tagging is not optional decoration: the hero prompt addresses each reference
 * by position ("Image 1 = Top") and states where that role belongs on the body,
 * so an untagged or mistagged set produces a model wearing the bag on her head.
 * Giving it a full window rather than a cramped strip in the setup panel is what
 * makes checking six of them realistic.
 *
 * Roles arrive pre-filled from a vision pass with a confidence and a one-line
 * reason, so the common case is a glance and a confirm.
 *
 * Selection only — Continue hands back to the setup panel, where framing,
 * aspect, resolution and the rest of the shoot are set and the hero is actually
 * generated. Nothing here spends a credit.
 */
export default function EnsembleTagModal({
  mode,
  refs,
  onRefs,
  onClose,
}: {
  /** Which question this window is asking: which item, or which view. */
  mode: RefMode;
  refs: EnsembleRef[];
  onRefs: (next: EnsembleRef[]) => void;
  /** Continue just closes — framing, aspect and resolution live in the panel. */
  onClose: () => void;
}) {
  const copy = COPY[mode];
  const inputRef = useRef<HTMLInputElement>(null);
  const [detecting, setDetecting] = useState(false);
  const [note, setNote] = useState('');
  const [dragging, setDragging] = useState(false);

  const room = MAX_ENSEMBLE_REFS - refs.length;
  const detected = refs.some((r) => r.confidence !== undefined);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Images can also arrive by being dropped on the setup panel, which opens
  // this window with them already in the list but never classified. Catch those
  // on mount so both routes in behave the same. Runs once: anything added from
  // inside the window is detected by add() instead.
  const kicked = useRef(false);
  useEffect(() => {
    if (kicked.current) return;
    kicked.current = true;
    const untagged = refs.filter((r) => r.confidence === undefined);
    if (untagged.length) void detect(untagged, refs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Classify a set of refs and merge the answers back in by identity. */
  async function detect(targets: EnsembleRef[], all: EnsembleRef[]) {
    if (!targets.length) return;
    setDetecting(true);
    setNote('');
    onRefs(all.map((r) => (targets.includes(r) ? { ...r, detecting: true } : r)));

    let results: Detected[] | null = null;
    try {
      const fd = new FormData();
      for (const r of targets) fd.append('refs', r.file);
      fd.append('mode', mode);
      results = (await postMultipart<{ results: Detected[] }>('/api/ensemble/detect', fd)).results;
    } catch {
      setNote('Auto-tagging is unavailable — pick what each image is below.');
    } finally {
      // One merge point for both outcomes, so a failed call can never leave a
      // tile spinning forever — it just falls back to being tagged by hand.
      //
      // Matched on object identity rather than index: the user can remove a
      // tile while the request is in flight, which would shift every position.
      onRefs(
        all.map((r) => {
          const at = targets.indexOf(r);
          if (at < 0) return r;
          const hit = results?.[at];
          return hit
            ? {
                ...r,
                role: hit.role,
                unsure: !!hit.unsure,
                confidence: hit.confidence,
                reason: hit.reason,
                detecting: false,
              }
            : { ...r, detecting: false };
        }),
      );
      setDetecting(false);
    }
  }

  function add(files: FileList | File[] | null | undefined) {
    const picked = Array.from(files ?? []).filter((f) => f.type.startsWith('image/'));
    if (!picked.length) return;

    setNote('');
    if (picked.length > room) {
      setNote(`An ensemble takes at most ${MAX_ENSEMBLE_REFS} images — the rest were skipped.`);
    }
    const taken = picked.slice(0, room);
    if (!taken.length) return;

    const fresh = taken.map((f) => toRef(f, mode));
    const all = [...refs, ...fresh];
    onRefs(all);
    void detect(fresh, all);
    if (inputRef.current) inputRef.current.value = '';
  }

  function remove(i: number) {
    URL.revokeObjectURL(refs[i].url);
    onRefs(refs.filter((_, n) => n !== i));
    setNote('');
  }

  function setRole(i: number, role: RefRole) {
    // A hand-picked role is certain by definition, so the badge and the
    // "confirm this" flag both go.
    onRefs(
      refs.map((r, n) =>
        n === i ? { ...r, role, unsure: false, confidence: undefined, reason: undefined } : r,
      ),
    );
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[55] flex items-center justify-center bg-black/50 p-[30px]"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-fade-up flex max-h-full w-full max-w-[860px] flex-col overflow-hidden rounded-[18px] bg-surface shadow-pop"
      >
        {/* ── header ── */}
        <div className="flex items-start gap-3 px-7 pb-3 pt-6">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5">
              <h2 className="text-[20px] font-bold">Tag your images</h2>
              <span className="rounded-[7px] bg-accent-soft px-2 py-1 text-[11px] font-bold text-accent">
                {copy.badge}
              </span>
            </div>
            <p className="mt-2 text-[12.5px] leading-[1.6] text-muted">
              {copy.blurb} Add up to {MAX_ENSEMBLE_REFS} images — more images lowers fidelity on
              each, so keep it tight.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-full bg-surface2 text-[15px] text-muted hover:bg-line hover:text-ink"
          >
            ×
          </button>
        </div>

        {/* ── tiles ── */}
        <div className="min-h-0 flex-1 overflow-y-auto px-7 py-3">
          <div className="flex flex-wrap gap-3.5">
            {refs.map((r, i) => (
              <div
                key={r.url}
                className={`relative flex w-[196px] flex-col overflow-hidden rounded-[14px] border ${
                  r.detecting ? 'border-line' : r.unsure ? 'border-amber/60' : 'border-line'
                } bg-surface`}
              >
                {r.detecting && (
                  <span className="absolute left-2 top-2 z-[2] flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-[3px] text-[10px] font-bold text-white">
                    <span className="animate-spin-cs inline-block h-[9px] w-[9px] rounded-full border-[1.5px] border-white/30 border-t-white" />
                    reading
                  </span>
                )}
                {!r.detecting && r.confidence !== undefined && (
                  <span
                    className={`absolute left-2 top-2 z-[2] rounded-md px-1.5 py-[3px] text-[10px] font-bold text-white ${
                      r.unsure ? 'bg-amber' : 'bg-emerald-600'
                    }`}
                  >
                    {Math.round(r.confidence * 100)}%
                  </span>
                )}
                <button
                  onClick={() => remove(i)}
                  aria-label={`Remove image ${i + 1}`}
                  className="absolute right-2 top-2 z-[2] flex h-[26px] w-[26px] items-center justify-center rounded-full bg-black/55 text-[14px] text-white hover:bg-black"
                >
                  ×
                </button>

                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={r.url}
                  alt=""
                  className="h-[196px] w-full bg-surface2 object-contain"
                />

                <div className="border-t border-line p-2.5">
                  {r.detecting ? (
                    // No role is shown until one has actually been worked out —
                    // the stored 'garment' is a placeholder, and rendering it
                    // would put words in the classifier's mouth.
                    <>
                      <div className="skeleton h-[34px] w-full rounded-[9px]" />
                      <p className="mt-1.5 text-[10.5px] font-semibold text-muted">
                        Identifying this item…
                      </p>
                    </>
                  ) : (
                    <>
                      <Select
                        value={r.role}
                        onChange={(v) => setRole(i, v as RefRole)}
                        options={ROLES_FOR[mode].map((role) => [role, LABEL_FOR[mode][role]])}
                      />
                      {r.reason && (
                        <p className="mt-1.5 text-[10.5px] leading-[1.45] text-muted">{r.reason}</p>
                      )}
                      {r.unsure && (
                        <p className="mt-1 text-[10px] font-bold text-amber">please confirm</p>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}

            {room > 0 && (
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
                  add(e.dataTransfer.files);
                }}
                className={`flex h-[276px] w-[196px] cursor-pointer flex-col items-center justify-center rounded-[14px] border-[1.5px] border-dashed text-center transition ${
                  dragging
                    ? 'border-brand bg-brand-soft text-brand'
                    : 'border-line bg-surface2 text-muted hover:border-brand hover:text-brand'
                }`}
              >
                <span className="text-[26px] leading-none">＋</span>
                <span className="mt-2 text-[13px] font-bold">Add image</span>
                <span className="mt-0.5 text-[11px]">{copy.hint}</span>
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => add(e.target.files)}
                />
              </div>
            )}
          </div>

          <div className="mt-4 flex items-center gap-3 rounded-[12px] bg-accent-soft px-4 py-3">
            <span className="flex-1 text-[12.5px] font-bold text-accent">
              {detecting
                ? 'Working out what each image is…'
                : note
                  ? note
                  : detected
                    ? '✓ Roles auto-detected — confirm or correct any above.'
                    : 'Pick what each image is above.'}
            </span>
            <button
              onClick={() => detect(refs, refs)}
              disabled={detecting || !refs.length}
              className="flex-shrink-0 rounded-[9px] border border-accent/40 bg-surface px-3 py-2 text-[12px] font-bold text-accent hover:border-accent disabled:opacity-40"
            >
              ↻ Re-detect
            </button>
          </div>
        </div>

        {/* ── footer ── */}
        <div className="flex items-center gap-4 border-t border-line px-7 py-4">
          <span className="text-[12.5px] font-semibold text-muted">
            <b className="text-ink">{refs.length}</b> image{refs.length === 1 ? '' : 's'} tagged
          </span>

          <button
            onClick={onClose}
            disabled={!refs.length || refs.some((r) => r.detecting)}
            className="ml-auto flex-shrink-0 rounded-[11px] bg-accent px-6 py-3 text-[13.5px] font-bold text-white transition hover:-translate-y-px disabled:translate-y-0 disabled:opacity-50"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
