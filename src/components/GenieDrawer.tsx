'use client';

import { useEffect, useRef, useState } from 'react';
import { postMultipart, ApiError } from '@/lib/client/api';
import { FRAMINGS, BACKDROPS, ASPECTS, RESOLUTIONS } from '@/lib/client/constants';
import { GenieIcon } from './icons';
import type { PoseSettings } from '@/lib/client/types';

interface Spec {
  pose: string;
  framing: string;
  keep_scene: boolean;
  backdrop: string;
  lighting: string;
  mood: string;
  notes: string;
  /** Free-text scene from a reference image; overrides `backdrop` when set. */
  scene_detail: string;
}

interface Shot {
  pose: string;
  framing: string;
}

interface ShootSet {
  keep_scene: boolean;
  backdrop: string;
  lighting: string;
  mood: string;
  scene_detail: string;
  shots: Shot[];
}

interface Turn {
  mode: 'single' | 'series' | 'ask_count';
  reply: string;
  intent: string;
  ready: boolean;
  spec: Spec;
  set: ShootSet | null;
  suggested_counts: number[];
  suggestions: string[];
  charged: number;
  balance: number;
}

/** One entry in the transcript. Sets are editable, so they live on the bubble. */
interface Bubble {
  role: 'user' | 'genie';
  text: string;
  spec?: Spec;
  set?: ShootSet;
  counts?: number[];
  suggestions?: string[];
  /** Output settings for a set — Genie never chooses these, the user does. */
  aspect?: string;
  resolution?: string;
  editing?: boolean;
}

const label = (pairs: Array<[string, string]>, v: string) =>
  pairs.find(([val]) => val === v)?.[1] ?? v;

/** "clean studio seamless · soft bright commercial · clean" */
const sceneLine = (s: ShootSet) =>
  [label(BACKDROPS, s.backdrop), s.lighting, s.mood].filter(Boolean).join(' · ');

/**
 * The art-director panel that slides in from the right of the Add Pose card.
 *
 * Two shapes of answer come back. A SINGLE direction fills the card and lets the
 * user generate it themselves. A SHOOT SET is a whole catalogue — one shared
 * scene and N complementary poses — which generates in one go through the batch
 * endpoint, so every image in it was photographed in the same session.
 */
export default function GenieDrawer({
  open,
  onClose,
  pid,
  selection,
  geniePrice,
  priceFor,
  onBalance,
  onApply,
  onGenerate,
}: {
  open: boolean;
  onClose: () => void;
  /** Genie needs a shoot to read the locked model and garment from. */
  pid: string | null;
  /**
   * Poses already ticked on the card. Genie rewrites these one-for-one when
   * asked to improve them, so a 2-pose selection comes back as a 2-shot set.
   */
  selection: string[];
  geniePrice: number;
  /** Credits for one image at a resolution; '' means the shoot's own. */
  priceFor: (resolution: string) => number;
  onBalance: (b: number) => void;
  /** Fills the Add Pose card with a single direction, for the user to run. */
  onApply: (pose: string, settings: PoseSettings) => void;
  /** Generates rows immediately — a whole set, or one shot out of one. */
  onGenerate: (rows: Array<PoseSettings & { pose: string }>) => void;
}) {
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [draft, setDraft] = useState('');
  const [ref, setRef] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [spent, setSpent] = useState(0);

  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [bubbles, busy]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const patch = (i: number, p: Partial<Bubble>) =>
    setBubbles((prev) => prev.map((b, n) => (n === i ? { ...b, ...p } : b)));

  async function send(text: string) {
    const msg = text.trim();
    if ((!msg && !ref) || busy || !pid) return;

    const history = [...bubbles, { role: 'user' as const, text: msg || '(reference image)' }];
    setBubbles(history);
    setDraft('');
    setNote('');
    setBusy(true);

    try {
      const fd = new FormData();
      fd.append('pid', pid);
      fd.append('messages', JSON.stringify(history.map((b) => ({ role: b.role, text: b.text }))));
      if (selection.length) fd.append('poses', JSON.stringify(selection));
      if (ref) fd.append('image', ref);

      const j = await postMultipart<Turn>('/api/genie/director', fd);

      onBalance(j.balance);
      setSpent((n) => n + (j.charged ?? 0));
      setRef(null);
      if (fileRef.current) fileRef.current.value = '';

      setBubbles((prev) => [
        ...prev,
        {
          role: 'genie',
          text: j.reply,
          spec: j.mode === 'single' && j.ready ? j.spec : undefined,
          set: j.mode === 'series' && j.set ? j.set : undefined,
          counts: j.mode === 'ask_count' ? j.suggested_counts : undefined,
          suggestions: j.suggestions,
          // Default the set's output settings to the shoot's own.
          aspect: '',
          resolution: '',
        },
      ]);
    } catch (e) {
      setNote(
        e instanceof ApiError && e.status === 402
          ? 'Not enough credits for another Genie turn.'
          : 'Genie is unavailable right now.',
      );
      setBubbles((prev) => prev.slice(0, -1));
    } finally {
      setBusy(false);
    }
  }

  /** Turn a set (or one shot of it) into batch rows. */
  const rowsFor = (b: Bubble, shots: Shot[]) =>
    shots.map((sh) => ({
      pose: sh.pose,
      framing: sh.framing,
      // scene_detail is the full reference description and beats the dropdown
      // value — sceneClause() passes an unknown backdrop through as free text,
      // which is the only way the reference's specifics survive to the model.
      backdrop: b.set!.scene_detail || b.set!.backdrop,
      mood: b.set!.mood,
      lighting: b.set!.lighting,
      aspect: b.aspect ?? '',
      resolution: b.resolution ?? '',
    }));

  function applySingle(spec: Spec) {
    onApply(spec.pose, {
      framing: spec.framing,
      backdrop: spec.scene_detail || spec.backdrop,
      mood: spec.mood,
      lighting: spec.lighting,
    });
    onClose();
  }

  function runSet(b: Bubble, shots: Shot[]) {
    if (!shots.length) return;
    onGenerate(rowsFor(b, shots));
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex justify-end" role="dialog" aria-modal="true">
      <div className="flex-1 bg-black/45" onClick={onClose} />

      <aside className="animate-slide-in flex h-full w-full max-w-[440px] flex-col border-l border-line bg-surface shadow-pop">
        {/* ── header ── */}
        <div className="flex items-start gap-2.5 border-b border-line px-[18px] py-[14px]">
          <GenieIcon className="mt-[1px] h-7 w-7 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-[13.5px] font-bold">Genie · art director</div>
            <div className="text-[10.5px] leading-[1.5] text-muted">
              Your model and garment stay locked. Ask for one shot, or a whole catalogue.
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-lg text-[17px] font-bold text-muted hover:bg-surface2 hover:text-ink"
          >
            ×
          </button>
        </div>

        {/* ── conversation ── */}
        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-[18px] py-4">
          {/* What Genie is working from, shown for the whole conversation so it
              stays obvious which poses a returned set corresponds to. */}
          {!!selection.length && (
            <div className="rounded-[11px] border border-genie/30 bg-genie/[.06] p-3">
              <div className="mb-1.5 text-[9.5px] font-bold uppercase tracking-[0.03em] text-genie">
                Working from your {selection.length} selected pose
                {selection.length === 1 ? '' : 's'}
              </div>
              <ol className="space-y-1">
                {selection.map((p, i) => (
                  <li key={i} className="flex gap-1.5 text-[11px] leading-[1.5] text-muted">
                    <span className="font-bold text-genie">{i + 1}.</span>
                    <span className="min-w-0 flex-1">{p}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {!bubbles.length && (
            <div className="rounded-[11px] border border-line bg-surface2 p-3 text-[11.5px] leading-[1.6] text-muted">
              {selection.length
                ? `Ask Genie to elevate these — you'll get ${selection.length} rewritten pose${
                    selection.length === 1 ? '' : 's'
                  } back, one for each, ready to edit and generate.`
                : "Describe the shot you want, ask for a catalogue, or attach a photo whose look you'd like to match."}
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {(selection.length
                  ? [
                      selection.length === 1 ? 'Make this pose better' : 'Make these poses better',
                      'More editorial',
                      'Add movement and energy',
                    ]
                  : [
                      'Create a catalogue for me',
                      'Make this pose better',
                      'A golden-hour campaign feel',
                    ]
                ).map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-full border border-line bg-surface px-2.5 py-1 text-[10.5px] font-semibold text-ink hover:border-genie hover:text-genie"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {bubbles.map((b, i) =>
            b.role === 'user' ? (
              <div key={i} className="flex justify-end">
                <div className="max-w-[85%] rounded-[11px] rounded-br-[3px] bg-ink px-3 py-2 text-[12px] leading-[1.5] text-surface">
                  {b.text}
                </div>
              </div>
            ) : (
              <div key={i} className="space-y-2">
                <div className="max-w-[92%] rounded-[11px] rounded-bl-[3px] border border-line bg-genie/[.07] px-3 py-2 text-[12px] leading-[1.55]">
                  {b.text}
                </div>

                {/* ── how many shots? ── */}
                {!!b.counts?.length && (
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap gap-1.5">
                      {b.counts.map((n) => (
                        <button
                          key={n}
                          onClick={() => send(`${n} shots`)}
                          disabled={busy}
                          className="h-[40px] w-[46px] rounded-[10px] border border-line bg-surface text-[15px] font-bold hover:border-genie hover:text-genie disabled:opacity-50"
                        >
                          {n}
                        </button>
                      ))}
                      <button
                        onClick={() => document.getElementById('genie-draft')?.focus()}
                        className="h-[40px] rounded-[10px] border border-line bg-surface px-3 text-[12px] font-semibold text-muted hover:border-genie hover:text-genie"
                      >
                        Custom…
                      </button>
                    </div>
                    <div className="text-[10.5px] text-muted">
                      Tap a number, or just tell me (&ldquo;6 shots, one seated&rdquo;).
                    </div>
                  </div>
                )}

                {/* ── a single direction ── */}
                {b.spec && (
                  <div className="overflow-hidden rounded-[11px] border border-genie/40 bg-surface">
                    <div className="border-b border-line bg-surface2 px-3 py-[7px] text-[10px] font-bold uppercase tracking-[0.03em] text-genie">
                      ✦ Genie&apos;s direction
                    </div>
                    <div className="space-y-2 p-3">
                      <p className="text-[12.5px] leading-[1.55]">{b.spec.pose}</p>
                      {b.spec.scene_detail && <MatchedScene text={b.spec.scene_detail} />}
                      <div className="flex flex-wrap gap-1.5 text-[10px] font-semibold">
                        <span className="rounded-md bg-surface2 px-2 py-[3px] text-muted">
                          {label(FRAMINGS, b.spec.framing)}
                        </span>
                        {b.spec.keep_scene ? (
                          <span className="rounded-md bg-surface2 px-2 py-[3px] text-muted">
                            scene unchanged
                          </span>
                        ) : (
                          [label(BACKDROPS, b.spec.backdrop), b.spec.lighting, b.spec.mood]
                            .filter(Boolean)
                            .map((t) => (
                              <span key={t} className="rounded-md bg-surface2 px-2 py-[3px] text-muted">
                                {t}
                              </span>
                            ))
                        )}
                      </div>
                      <button
                        onClick={() => applySingle(b.spec!)}
                        className="w-full rounded-lg bg-brand px-3 py-2 text-xs font-bold text-white"
                      >
                        Use this direction
                      </button>
                    </div>
                  </div>
                )}

                {/* ── a whole shoot set ── */}
                {b.set && (
                  <SetCard
                    bubble={b}
                    onPatch={(p) => patch(i, p)}
                    priceFor={priceFor}
                    onRunAll={() => runSet(b, b.set!.shots)}
                    onRunOne={(sh) => runSet(b, [sh])}
                  />
                )}

                {!!b.suggestions?.length && (
                  <div className="flex flex-wrap gap-1.5">
                    {b.suggestions.map((s) => (
                      <button
                        key={s}
                        onClick={() => send(s)}
                        disabled={busy}
                        className="rounded-full border border-line bg-surface px-2.5 py-1 text-[10.5px] font-semibold text-muted hover:border-genie hover:text-genie disabled:opacity-50"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ),
          )}

          {busy && (
            <div className="flex items-center gap-2 text-[11.5px] font-semibold text-muted">
              <span className="animate-pulse-dot">✦</span> Genie is directing…
            </div>
          )}

          {note && <div className="text-[11px] font-semibold text-amber">{note}</div>}
        </div>

        {/* ── composer ── */}
        <div className="border-t border-line px-[18px] py-3">
          {ref && (
            <div className="mb-2 flex items-center gap-2 rounded-lg border border-line bg-surface2 px-2.5 py-1.5 text-[11px]">
              <span className="min-w-0 flex-1 truncate font-semibold">{ref.name}</span>
              <button
                onClick={() => {
                  setRef(null);
                  if (fileRef.current) fileRef.current.value = '';
                }}
                className="font-bold text-muted hover:text-brand"
              >
                remove
              </button>
            </div>
          )}

          <div className="flex items-end gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => setRef(e.target.files?.[0] ?? null)}
            />
            <button
              onClick={() => fileRef.current?.click()}
              title="Attach a reference image to match"
              className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-lg border border-line text-[15px] text-muted hover:border-genie hover:text-genie"
            >
              ⌷
            </button>

            <textarea
              id="genie-draft"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send(draft);
                }
              }}
              rows={1}
              placeholder="Describe the shot, or ask for a catalogue…"
              className="min-h-[38px] flex-1 resize-none rounded-lg border border-line bg-surface px-2.5 py-2 text-[12px] leading-[1.5] outline-none focus:border-genie"
            />

            <button
              onClick={() => send(draft)}
              disabled={busy || (!draft.trim() && !ref)}
              className="h-[38px] flex-shrink-0 rounded-lg bg-genie px-3 text-xs font-bold text-white disabled:opacity-40"
            >
              Send
            </button>
          </div>

          <div className="mt-1.5 text-[10px] font-semibold text-muted">
            {geniePrice > 0
              ? `${geniePrice} credit per message${spent ? ` · ${spent} spent here` : ''}`
              : 'Free'}
          </div>
        </div>
      </aside>
    </div>
  );
}

/**
 * The scene read off a reference photo. Shown in full rather than truncated —
 * it is what actually drives the generated image, so the user should be able to
 * check it before spending credits on it.
 */
function MatchedScene({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-genie/25 bg-genie/[.05] p-2">
      <div className="mb-1 flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.03em] text-genie">
        ⌾ Matched from your reference
      </div>
      <p className="text-[11px] leading-[1.55] text-muted">{text}</p>
    </div>
  );
}

/**
 * The catalogue card: shared scene, the numbered shot list, and the output
 * settings that Genie deliberately does not choose.
 */
function SetCard({
  bubble,
  onPatch,
  priceFor,
  onRunAll,
  onRunOne,
}: {
  bubble: Bubble;
  onPatch: (p: Partial<Bubble>) => void;
  priceFor: (resolution: string) => number;
  onRunAll: () => void;
  onRunOne: (shot: Shot) => void;
}) {
  const set = bubble.set!;
  const editing = !!bubble.editing;
  const total = set.shots.length * priceFor(bubble.resolution ?? '');

  const patchShot = (i: number, p: Partial<Shot>) =>
    onPatch({
      set: { ...set, shots: set.shots.map((s, n) => (n === i ? { ...s, ...p } : s)) },
    });

  const removeShot = (i: number) =>
    onPatch({ set: { ...set, shots: set.shots.filter((_, n) => n !== i) } });

  return (
    <div className="overflow-hidden rounded-[11px] border border-genie/40 bg-surface">
      <div className="flex items-center gap-2 border-b border-line bg-surface2 px-3 py-2">
        <span className="flex-1 text-[10px] font-bold uppercase tracking-[0.03em] text-genie">
          Shoot set
        </span>
        <span className="rounded-md bg-genie/15 px-2 py-[3px] text-[10px] font-bold text-genie">
          {set.shots.length} shot{set.shots.length === 1 ? '' : 's'} ·{' '}
          {set.keep_scene ? 'hero scene' : 'same scene'}
        </span>
      </div>

      <div className="border-b border-line px-3 py-2">
        <div className="mb-[3px] text-[9.5px] font-bold uppercase tracking-[0.03em] text-muted">
          Shared scene
        </div>
        {set.scene_detail ? (
          <MatchedScene text={set.scene_detail} />
        ) : (
          <div className="text-[11.5px] leading-[1.5]">
            {set.keep_scene ? "Unchanged — the shoot's own backdrop, lighting and mood." : sceneLine(set)}
          </div>
        )}
      </div>

      <ul>
        {set.shots.map((sh, i) => (
          <li key={i} className="flex items-start gap-2 border-b border-line px-3 py-2">
            <span className="mt-[2px] flex h-[20px] w-[20px] flex-shrink-0 items-center justify-center rounded-md bg-genie/12 text-[10px] font-bold text-genie">
              {i + 1}
            </span>

            {editing ? (
              <div className="min-w-0 flex-1 space-y-1.5">
                <textarea
                  value={sh.pose}
                  onChange={(e) => patchShot(i, { pose: e.target.value })}
                  rows={2}
                  className="w-full resize-none rounded-lg border border-line bg-surface px-2 py-1.5 text-[11.5px] leading-[1.5] outline-none focus:border-genie"
                />
                <div className="flex items-center gap-1.5">
                  <select
                    value={sh.framing}
                    onChange={(e) => patchShot(i, { framing: e.target.value })}
                    className="flex-1 rounded-md border border-line bg-surface px-1.5 py-1 text-[10.5px] font-semibold outline-none"
                  >
                    {FRAMINGS.map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => removeShot(i)}
                    disabled={set.shots.length <= 1}
                    title="Remove this shot"
                    className="rounded-md px-2 py-1 text-[10.5px] font-bold text-muted hover:text-brand disabled:opacity-30"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="min-w-0 flex-1 text-[11.5px] leading-[1.5]">{sh.pose}</p>
                <span className="mt-[1px] flex-shrink-0 rounded-md bg-surface2 px-[7px] py-[3px] text-[9.5px] font-semibold text-muted">
                  {label(FRAMINGS, sh.framing)}
                </span>
                <button
                  onClick={() => onRunOne(sh)}
                  title="Generate just this shot"
                  className="mt-[1px] flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-md border border-line text-[9px] hover:border-genie hover:text-genie"
                >
                  ▶
                </button>
              </>
            )}
          </li>
        ))}
      </ul>

      {/* Genie never sets these — output settings are the user's call. */}
      <div className="flex gap-2 border-b border-line px-3 py-2.5">
        <label className="flex-1">
          <span className="mb-[3px] block text-[9.5px] font-bold uppercase tracking-[0.03em] text-muted">
            Aspect ratio
          </span>
          <select
            value={bubble.aspect ?? ''}
            onChange={(e) => onPatch({ aspect: e.target.value })}
            className="w-full rounded-lg border border-line bg-surface px-2 py-[7px] text-[11.5px] font-semibold outline-none focus:border-genie"
          >
            <option value="">same as shoot</option>
            {ASPECTS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>

        <label className="flex-1">
          <span className="mb-[3px] block text-[9.5px] font-bold uppercase tracking-[0.03em] text-muted">
            Resolution
          </span>
          <select
            value={bubble.resolution ?? ''}
            onChange={(e) => onPatch({ resolution: e.target.value })}
            className="w-full rounded-lg border border-line bg-surface px-2 py-[7px] text-[11.5px] font-semibold outline-none focus:border-genie"
          >
            <option value="">same as shoot</option>
            {RESOLUTIONS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex gap-2 p-3">
        <button
          onClick={onRunAll}
          className="flex flex-1 items-center justify-center gap-2 rounded-[10px] bg-ink px-3 py-2.5 text-xs font-bold text-surface"
        >
          ▶ Generate all
          <span className="rounded-md bg-white/15 px-1.5 py-[2px] text-[10px]">{total} cr</span>
        </button>
        <button
          onClick={() => onPatch({ editing: !editing })}
          className="rounded-[10px] border border-line px-3 py-2.5 text-xs font-bold text-ink hover:border-genie hover:text-genie"
        >
          {editing ? 'Done' : '✎ Edit set'}
        </button>
      </div>
    </div>
  );
}
