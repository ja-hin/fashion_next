'use client';

import { useEffect, useRef, useState } from 'react';
import { UploadIcon, ShirtIcon, PersonIcon } from './icons';
import type { EnsembleRef } from '@/lib/client/ensemble-types';

interface Answer {
  /**
   * 'none' is the customer overruling the classifier , there is no person in
   * the photo and it should be used as it stands. Without it a false positive
   * is a dead end: the window will not close, and both other answers would
   * change a photo that was fine.
   */
  plan: 'own' | 'extract' | 'none';
  /** The garment-only image, when the customer supplied one. */
  file?: File;
  /** Its object URL, made once here rather than per render. */
  preview?: string;
}

/**
 * "There is a person in this photo" , asked on the Special Category desk.
 *
 * Detection returns `has_person` for every image (see ATTRIBUTES_RULE in
 * api/ensemble/detect). A photo of someone WEARING the item is not the same
 * input as a photo OF the item, so rather than quietly shooting it as if it
 * were, the desk stops and puts the choice to the customer:
 *
 *   own     , they already have a garment-only image and swap it in here.
 *   extract , we pull the garment out of their photo for them.
 *
 * Asked per image on purpose. A set can easily be one clean packshot and one
 * shot off a model, and answering for the whole set would force a wrong answer
 * on one of them. "Extract all" is there for when the answer really is uniform.
 *
 * The window cannot be dismissed with an unanswered image. Closing it would
 * leave the desk holding a reference nobody has decided about, which is the
 * state this exists to prevent.
 */
export default function PersonChoiceModal({
  refs,
  price,
  onResolve,
}: {
  /** Only the images with a person in them , the caller filters. */
  refs: EnsembleRef[];
  /**
   * Credits per photo extracted , `extract_price` from app settings.
   *
   * Shown on the button rather than only in the total, because this is the one
   * answer in the window that costs anything and the other two are free.
   */
  price: number;
  /**
   * The answers, keyed by the ref's object URL (stable, and unique per upload).
   * `file` and `preview` are present only for 'own' , the garment-only image to
   * swap in, and the object URL already made for it so the caller need not make
   * a second one.
   */
  onResolve: (answers: Map<string, Answer>) => void;
}) {
  const [answers, setAnswers] = useState<Map<string, Answer>>(new Map());
  /** Which row's file picker is open , one input, retargeted. */
  const pending = useRef<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // No Escape handler, deliberately: see the note on the component.
  useEffect(() => {
    const stop = (e: KeyboardEvent) => {
      if (e.key === 'Escape') e.stopPropagation();
    };
    document.addEventListener('keydown', stop, true);
    return () => document.removeEventListener('keydown', stop, true);
  }, []);

  const set = (url: string, v: Answer) =>
    setAnswers((m) => {
      // Switching a row's answer strands whatever preview it held.
      const old = m.get(url)?.preview;
      if (old && old !== v.preview) URL.revokeObjectURL(old);
      return new Map(m).set(url, v);
    });

  function pickFor(url: string) {
    pending.current = url;
    inputRef.current?.click();
  }

  function took(files: FileList | null) {
    const f = Array.from(files ?? []).find((x) => x.type.startsWith('image/'));
    const url = pending.current;
    pending.current = null;
    if (inputRef.current) inputRef.current.value = '';
    if (f && url) set(url, { plan: 'own', file: f, preview: URL.createObjectURL(f) });
  }

  const answered = refs.every((r) => answers.has(r.url));
  /* Only 'extract' costs anything , supplying your own image and correcting a
     false positive are both free. */
  const billable = [...answers.values()].filter((a) => a.plan === 'extract').length;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-[30px]">
      <div className="animate-fade-up flex max-h-full w-full max-w-[680px] flex-col overflow-hidden rounded-[18px] bg-surface shadow-pop">
        {/* ── header ── */}
        <div className="px-7 pb-3 pt-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-full bg-amber-soft">
              <PersonIcon className="h-[18px] w-[18px] text-amber" />
            </span>
            <h2 className="text-[19px] font-bold">
              {refs.length === 1
                ? 'There is a person in this photo'
                : `There are people in ${refs.length} of these photos`}
            </h2>
          </div>
          <p className="mt-2.5 text-[12.5px] leading-[1.6] text-muted">
            A photo of someone wearing the item is not the same thing as a photo of the
            item. Either swap in a garment-only image, or let us take the garment out of
            the photo for you.
          </p>
        </div>

        {/* ── one row per photo ── */}
        <div className="min-h-0 flex-1 overflow-y-auto px-7 py-2">
          {refs.map((r) => {
            const a = answers.get(r.url);
            return (
              <div
                key={r.url}
                className={`mb-2.5 flex items-center gap-3.5 rounded-[14px] border p-3 ${
                  a ? 'border-accent-soft bg-accent-soft' : 'border-line bg-surface2'
                }`}
              >
                {/* The swapped-in image replaces the thumbnail at once, so the
                    row shows what will actually be used, not what was rejected. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={a?.preview ?? r.url}
                  alt=""
                  className="h-[72px] w-[72px] flex-shrink-0 rounded-[10px] bg-surface object-cover"
                />

                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-bold">
                    {r.garment_type?.trim() || r.reason || 'This item'}
                  </div>

                  {a ? (
                    <div className="mt-1 text-[11.5px] font-semibold text-accent">
                      {a.plan === 'extract'
                        ? '✓ We will extract the garment from this photo'
                        : a.plan === 'none'
                          ? '✓ Using this photo as it is'
                          : `✓ Using your image , ${a.file?.name ?? 'garment only'}`}
                    </div>
                  ) : (
                    <div className="mt-1 text-[11.5px] text-muted">
                      Someone is wearing or holding it.
                    </div>
                  )}

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => pickFor(r.url)}
                      className={`flex items-center gap-1.5 rounded-[8px] border px-2.5 py-[6px] text-[11.5px] font-bold transition ${
                        a?.plan === 'own'
                          ? 'border-accent bg-surface text-accent'
                          : 'border-line bg-surface text-ink hover:border-accent hover:text-accent'
                      }`}
                    >
                      <UploadIcon className="h-3.5 w-3.5" />
                      {a?.plan === 'own' ? 'Choose a different image' : 'I have a garment-only image'}
                    </button>
                    <button
                      type="button"
                      onClick={() => set(r.url, { plan: 'extract' })}
                      className={`flex items-center gap-1.5 rounded-[8px] border px-2.5 py-[6px] text-[11.5px] font-bold transition ${
                        a?.plan === 'extract'
                          ? 'border-accent bg-surface text-accent'
                          : 'border-line bg-surface text-ink hover:border-accent hover:text-accent'
                      }`}
                    >
                      <ShirtIcon className="h-3.5 w-3.5" />
                      Extract the garment for me
                      {price > 0 && (
                        <span className="font-semibold opacity-70">· {price} cr</span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => set(r.url, { plan: 'none' })}
                      className={`rounded-[8px] px-2 py-[6px] text-[11.5px] font-semibold transition ${
                        a?.plan === 'none'
                          ? 'text-accent underline underline-offset-2'
                          : 'text-muted hover:text-ink'
                      }`}
                    >
                      No person , use as is
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => took(e.target.files)}
          />
        </div>

        {/* ── footer ── */}
        <div className="flex items-center gap-3 border-t border-line px-7 py-4">
          {refs.length > 1 && (
            <button
              type="button"
              onClick={() =>
                setAnswers((m) => {
                  const next = new Map(m);
                  // Only fills the blanks , a row already answered with an
                  // uploaded image is not overwritten by a bulk action.
                  for (const r of refs) if (!next.has(r.url)) next.set(r.url, { plan: 'extract' });
                  return next;
                })
              }
              className="text-[12px] font-bold text-accent underline-offset-2 hover:underline"
            >
              Extract all for me
            </button>
          )}

          {price > 0 && billable > 0 && (
            <span className="text-[12px] font-semibold text-muted">
              {billable} × {price} cr ={' '}
              <b className="text-ink">{billable * price} credits</b>
            </span>
          )}

          <button
            onClick={() => onResolve(answers)}
            disabled={!answered}
            title={answered ? undefined : 'Choose what to do with each photo first'}
            className="ml-auto flex-shrink-0 rounded-[11px] bg-accent px-6 py-3 text-[13.5px] font-bold text-white transition hover:-translate-y-px disabled:translate-y-0 disabled:opacity-50"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
