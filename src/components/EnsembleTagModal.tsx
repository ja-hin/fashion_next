'use client';

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { postMultipart } from '@/lib/client/api';
import { Select } from './ui';
import { RegenIcon, AlertIcon } from './icons';
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
  /** A special category , handed to the Special Category panel, not shot here. */
  restricted?: boolean;
  /** Names the item when `restricted`, so the handover can say what it saw. */
  restricted_reason?: string;
  /** Someone is wearing or holding the item , /special asks what to do about it. */
  has_person?: boolean;
  /** Flat or on a ghost mannequin, nobody in frame. */
  is_flat_lay?: boolean;
  /** The specific item in 1-3 words , used to name it back to the user. */
  garment_type?: string;
}

/** Object URLs are created here, so they are revoked here. */
const toRef = (file: File, mode: RefMode): EnsembleRef => ({
  file,
  role: asRole(null, mode),
  url: URL.createObjectURL(file),
  detecting: true,
  unsure: true,
});

/** Wording per mode , the two windows ask genuinely different questions. */
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
    '',
    hint: 'front, back, a detail…',
  },
};

/**
 * "Tag your images" , the window that opens as soon as ensemble images are
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
 * Selection only , Continue hands back to the setup panel, where framing,
 * aspect, resolution and the rest of the shoot are set and the hero is actually
 * generated. Nothing here spends a credit.
 */
export default function EnsembleTagModal({
  mode,
  refs,
  onRefs,
  onClose,
  onSpecial,
  extractPrice = 0,
}: {
  /** Which question this window is asking: which item, or which view. */
  mode: RefMode;
  refs: EnsembleRef[];
  /**
   * Takes an updater as well as a value: every write in here lays a patch over
   * the refs as they are NOW. See detect() for why that matters , this window
   * stays open over a running extraction on the Special desk.
   */
  onRefs: Dispatch<SetStateAction<EnsembleRef[]>>;
  /** Continue just closes , framing, aspect and resolution live in the panel. */
  onClose: () => void;
  /**
   * The classifier read one or more uploads as a special category.
   *
   * Handing them up rather than dealing with them here: this window's job ends
   * at "what is each image", and a special-category upload leaves the shoot
   * path entirely , the page moves them out of the ensemble and navigates to
   * the Special Category panel.
   *
   * Optional, and omitted by /special on purpose. That panel IS where flagged
   * images live, so routing them again would hand them to the screen they are
   * already on , the window just tags them like any other.
   */
  onSpecial?: (flagged: EnsembleRef[]) => void;
  /**
   * Credits per photo extracted , `extract_price` from app settings.
   *
   * Passed by the Special desk only; /generate never extracts, so it leaves
   * this at 0 and nothing about money is shown.
   */
  extractPrice?: number;
}) {
  const copy = COPY[mode];
  const inputRef = useRef<HTMLInputElement>(null);
  const [detecting, setDetecting] = useState(false);
  const [note, setNote] = useState('');
  const [dragging, setDragging] = useState(false);
  /* Non-null once detection has flagged something: the window stops being a
     tagging window and becomes the handover notice. */
  const [handoff, setHandoff] = useState<EnsembleRef[] | null>(null);

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
    if (untagged.length) void detect(untagged);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Classify a set of refs and merge the answers back in.
   *
   * Merged through an UPDATER keyed by object URL, never by writing back the
   * array this call started with. On the Special desk this window stays open
   * while an extraction runs underneath it, and extraction replaces a ref's
   * file and url when it lands , a snapshot written back here would undo that
   * and hand the shoot the person-photo it had just paid to remove.
   *
   * URL rather than index for the older reason too: the customer can remove a
   * tile mid-request, which shifts every position after it.
   */
  async function detect(targets: EnsembleRef[]) {
    if (!targets.length) return;
    setDetecting(true);
    setNote('');
    const aimed = new Set(targets.map((r) => r.url));
    onRefs((cur) => cur.map((r) => (aimed.has(r.url) ? { ...r, detecting: true } : r)));

    let results: Detected[] | null = null;
    try {
      const fd = new FormData();
      for (const r of targets) fd.append('refs', r.file);
      fd.append('mode', mode);
      results = (await postMultipart<{ results: Detected[] }>('/api/ensemble/detect', fd)).results;
    } catch {
      setNote('Auto-tagging is unavailable , pick what each image is below.');
    } finally {
      // One merge point for both outcomes, so a failed call can never leave a
      // tile spinning forever , it just falls back to being tagged by hand.
      //
      // Built as url -> patch so the write below can be an updater: what this
      // call decided, laid over whatever the ref looks like by the time it
      // lands, rather than over what it looked like when the call went out.
      const patches = new Map<string, Partial<EnsembleRef>>();
      targets.forEach((r, at) => {
        const hit = results?.[at];
        patches.set(
          r.url,
          hit
            ? {
              role: hit.role,
              unsure: !!hit.unsure,
              confidence: hit.confidence,
              reason: hit.reason,
              restricted: !!hit.restricted,
              restricted_reason: hit.restricted_reason ?? '',
              // The detect route has always returned these; they were being
              // dropped here. /special needs has_person to know whether to ask
              // about extraction at all.
              has_person: hit.has_person,
              is_flat_lay: hit.is_flat_lay,
              garment_type: hit.garment_type ?? '',
              detecting: false,
            }
            : { detecting: false },
        );
      });

      onRefs((cur) =>
        cur.map((r) => {
          const patch = patches.get(r.url);
          if (!patch) return r;
          return {
            ...r,
            ...patch,
            /* A fresh verdict re-opens the question on an image the customer
               swapped in AS garment-only: if there is still a person in it,
               'own' was not actually answered. 'extract' is left alone , that
               choice is about this photo and re-detecting it changes nothing.
               Needs the ref as it is NOW, so it is applied here rather than
               baked into the patch above. */
            garment_plan:
              patch.has_person && r.garment_plan === 'own' ? undefined : r.garment_plan,
          };
        }),
      );
      setDetecting(false);

      /* A special category anywhere in the set takes over the window. Checked
         on `next` rather than on `refs`, which is still last render's value at
         this point , reading it here would miss a flag set by this very call.

         Only the images that were actually flagged go up. The rest stay in the
         ensemble and are still a perfectly ordinary shoot. */
      const flagged = targets
        .map((r) => ({ ...r, ...patches.get(r.url) }))
        .filter((r) => r.restricted);
      if (onSpecial && flagged.length) setHandoff(flagged);
    }
  }

  function add(files: FileList | File[] | null | undefined) {
    const picked = Array.from(files ?? []).filter((f) => f.type.startsWith('image/'));
    if (!picked.length) return;

    setNote('');
    if (picked.length > room) {
      setNote(`An ensemble takes at most ${MAX_ENSEMBLE_REFS} images , the rest were skipped.`);
    }
    const taken = picked.slice(0, room);
    if (!taken.length) return;

    const fresh = taken.map((f) => toRef(f, mode));
    onRefs([...refs, ...fresh]);
    void detect(fresh);
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


  /*
   * The handover , asked, not announced.
   *
   * A full takeover of the window rather than a banner inside it: the images
   * may be leaving this screen, so carrying on tagging them underneath would be
   * a lie. No click-away, because moving someone's uploads to another panel is
   * not something to trigger by missing a target.
   *
   * It used to move you itself after a couple of seconds. That is the wrong
   * shape for this: a redirect that happens whether or not you agreed is not a
   * notice, it is a decision taken on your behalf, and the one thing you cannot
   * do about it is nothing. Both answers are now buttons, and neither is
   * default.
   */
  if (handoff) {
    const staying = refs.length - handoff.length;
    const named = handoff
      .map((r) => r.restricted_reason?.trim())
      .filter((x): x is string => !!x);

    return (
      <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/50 p-[30px]">
        <div className="animate-fade-up w-full max-w-[540px] rounded-[18px] bg-surface p-8 text-center shadow-pop">
          <div className="mx-auto mb-4 flex h-[54px] w-[54px] items-center justify-center rounded-full bg-brand-soft">
            <AlertIcon className="h-[26px] w-[26px] text-brand" />
          </div>

          <h2 className="text-[20px] font-bold">This is a special category</h2>

          <p className="mx-auto mt-2.5 max-w-[420px] text-[13px] leading-[1.65] text-muted">
            {handoff.length === 1 ? 'This item' : `These ${handoff.length} items`}
            {named.length ? ` , ${named.join(', ')} , ` : ' '}
            {handoff.length === 1 ? 'is' : 'are'} not part of an ordinary on-model
            shoot. The Special Category panel handles{' '}
            {handoff.length === 1 ? 'it' : 'them'}, with its own setup and its own
            shoot. Move {handoff.length === 1 ? 'it' : 'them'} there?
          </p>

          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {handoff.map((r) => (
              <span key={r.url} className="w-[74px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={r.url}
                  alt=""
                  className="h-[74px] w-[74px] rounded-[10px] border border-brand/40 bg-surface2 object-cover"
                />
                {r.restricted_reason && (
                  <span className="mt-1 block truncate text-[9px] font-semibold text-muted">
                    {r.restricted_reason}
                  </span>
                )}
              </span>
            ))}
          </div>

          {staying > 0 && (
            <p className="mt-5 text-[11.5px] font-semibold text-muted">
              Your other {staying} {staying === 1 ? 'image stays' : 'images stay'} in this shoot.
            </p>
          )}

          <div className="mt-6 flex gap-2.5">
            {/*
              "Not now" REMOVES , it does not dismiss.
              There is no third outcome here. A special-category item either
              goes to the panel built for it or it leaves the upload set: the
              one thing it must not do is stay in an ordinary on-model shoot,
              which is the shoot the image model refuses. Leaving it in place
              would just move the refusal to the Generate button, after a credit
              had been spent finding out.
            */}
            <button
              onClick={() => {
                const dropped = new Set(handoff);
                for (const r of handoff) URL.revokeObjectURL(r.url);
                const kept = refs.filter((r) => !dropped.has(r));
                onRefs(kept);
                setHandoff(null);
                // Everything was flagged, so there is nothing left to tag and
                // no reason to sit on an empty window.
                if (!kept.length) onClose();
              }}
              className="flex-1 rounded-[11px] border border-line p-[12px] text-[13.5px] font-bold text-ink transition hover:border-ink"
            >
              Not now
            </button>
            <button
              onClick={() => onSpecial?.(handoff)}
              className="flex-1 rounded-[11px] bg-brand p-[12px] text-[13.5px] font-bold text-white transition hover:brightness-110"
            >
              Move to Special Category
            </button>
          </div>

          {/* Said plainly, because "Not now" on its own sounds like a snooze and
              this one throws the upload away. */}
          <p className="mt-3 text-[11px] leading-[1.5] text-muted">
            Not now removes {handoff.length === 1 ? 'this image' : 'these images'} from
            the shoot , you can upload {handoff.length === 1 ? 'it' : 'them'} again any
            time.
          </p>
        </div>
      </div>
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
              {copy.blurb} Add up to {MAX_ENSEMBLE_REFS} images , more images lowers fidelity on
              each, so keep it tight.
            </p>
          </div>
          {/* Re-detect sits up here with Close rather than down beside the
              status line: it acts on the whole window, the same as closing it,
              and down there it was competing with Continue for the eye. Icon
              only , the banner below already says what state detection is in,
              so the button does not have to repeat it. The name is kept as a
              tooltip and as the accessible label. */}
          <button
            onClick={() => detect(refs)}
            disabled={detecting || !refs.length}
            title="Re-detect what each image is"
            aria-label="Re-detect what each image is"
            className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-full bg-surface2 text-muted transition hover:bg-line hover:text-accent disabled:opacity-40"
          >
            <RegenIcon className={`h-[15px] w-[15px] ${detecting ? 'animate-spin-cs' : ''}`} />
          </button>
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
                  r.extracting
                    ? 'border-accent/60'
                    : r.unsure && !r.detecting
                      ? 'border-amber/60'
                      : 'border-line'
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
                {/* Hidden mid-extraction: a close button over a spinner reads
                    as "cancel", and there is nothing here to cancel. */}
                {!r.extracting && (
                  <button
                    onClick={() => remove(i)}
                    aria-label={`Remove image ${i + 1}`}
                    className="absolute right-2 top-2 z-[2] flex h-[26px] w-[26px] items-center justify-center rounded-full bg-black/55 text-[14px] text-white hover:bg-black"
                  >
                    ×
                  </button>
                )}

                {/* A shimmer IN PLACE OF the photo, not a veil over it. What is
                    being worked on is the picture itself, and the one underneath
                    is about to be thrown away , leaving it showing through reads
                    as "still loading this one", which is the opposite of what
                    happens next. */}
                {r.extracting ? (
                  <div className="skeleton flex h-[196px] w-full flex-col items-center justify-center gap-2">
                    <span className="animate-spin-cs inline-block h-6 w-6 rounded-full border-2 border-surface/70 border-t-accent" />
                    <span className="text-[11px] font-bold text-accent">
                      Extracting the garment…
                    </span>
                    <span className="px-4 text-center text-[10px] leading-[1.4] text-muted">
                      This takes a few seconds
                    </span>
                    {extractPrice > 0 && (
                      <span className="rounded-full bg-surface px-2 py-[2px] text-[10px] font-bold text-ink">
                        {extractPrice} credits
                      </span>
                    )}
                  </div>
                ) : (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={r.url}
                      alt=""
                      className="h-[196px] w-full bg-surface2 object-contain"
                    />
                  </>
                )}

                <div className="border-t border-line p-2.5">
                  {r.detecting || r.extracting ? (
                    // No role is shown until one has actually been worked out ,
                    // the stored 'garment' is a placeholder, and rendering it
                    // would put words in the classifier's mouth.
                    <>
                      <div className="skeleton h-[34px] w-full rounded-[9px]" />
                      <p className="mt-1.5 text-[10.5px] font-semibold text-muted">
                        {r.extracting
                          ? 'Taking the garment out of your photo…'
                          : 'Identifying this item…'}
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

          {/* The status only , Re-detect moved to the header. */}
          <div className="mt-4 rounded-[12px] bg-accent-soft px-4 py-3">
            <span className="text-[12.5px] font-bold text-accent">
              {refs.some((r) => r.extracting)
                ? `Taking the garment out of your photo , a few seconds per image${
                    extractPrice > 0 ? `, ${extractPrice} credits each` : ''
                  }.`
                : detecting
                ? 'Working out what each image is…'
                : note
                  ? note
                  : detected
                    ? '✓ Roles auto-detected , confirm or correct any above.'
                    : 'Pick what each image is above.'}
            </span>
          </div>
        </div>

        {/* ── footer ── */}
        <div className="flex items-center gap-4 border-t border-line px-7 py-4">
          <span className="text-[12.5px] font-semibold text-muted">
            <b className="text-ink">{refs.length}</b> image{refs.length === 1 ? '' : 's'} tagged
          </span>

          <button
            onClick={onClose}
            // Continuing mid-extraction would carry the person-photo into the
            // shoot , the reference it is about to be replaced by is the point.
            disabled={!refs.length || refs.some((r) => r.detecting || r.extracting)}
            className="ml-auto flex-shrink-0 rounded-[11px] bg-accent px-6 py-3 text-[13.5px] font-bold text-white transition hover:-translate-y-px disabled:translate-y-0 disabled:opacity-50"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
