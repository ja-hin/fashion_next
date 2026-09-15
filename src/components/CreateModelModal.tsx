'use client';

import { useState } from 'react';
import { postForm, postMultipart, del, imgSrc, ApiError } from '@/lib/client/api';
import { ETHNICITIES } from '@/lib/client/constants';
import {
  castGroups,
  castSummary,
  CAST_DEFAULTS,
  CAST_NUDGES,
  type CastPicks,
} from '@/lib/model-traits';
import type { SavedModel, LbItem } from '@/lib/client/types';

/**
 * Model Studio , the four-step casting flow, ported from the Python tester.
 *
 *   1 Describe   plain words are the main input; the pickers are there for
 *                what is easier tapped than typed
 *   2 Pick       two or four candidates , you are better at "yes, that one"
 *                than at describing a face cold
 *   3 Refine     each nudge EDITS the same face, so the identity holds
 *   4 Save       name it, check the tags, it joins My Models
 *
 * The order matters and is the tester's, not mine: a free-text box first and
 * the option grid collapsed behind "Add details , optional". Leading with the
 * grid turns casting into form-filling, and the sentence you would have
 * written carries more than seven dropdowns do.
 *
 * Nothing joins the roster until step 4. The draft holding the candidates is a
 * real model document with `draft: true`, so every frame already has a URL and
 * abandoning the whole thing is one delete.
 */

const EXAMPLES: Array<[string, string]> = [
  [
    'Editorial woman, deep skin',
    'Woman, late 20s, warm deep Indian skin, long wavy black hair, athletic build, editorial mood.',
  ],
  [
    'Commercial man, wheatish',
    'Man, early 30s, medium wheatish skin, short textured black hair, lean build, relaxed commercial look.',
  ],
  [
    'Mature high-fashion woman',
    'Woman, early 40s, fair skin, shoulder-length brown hair with grey, slim, premium high-fashion mood.',
  ],
];

const STEPS = ['Describe', 'Pick', 'Refine', 'Save'];
const RESOLUTIONS = ['1K', '2K', '4K'] as const;

export default function CreateModelModal({
  prices,
  onClose,
  onCreated,
  onBalance,
  onZoom,
}: {
  /** Credits per imagined image, keyed by resolution. */
  prices: Record<string, number>;
  onClose: () => void;
  onCreated: (m: SavedModel) => void;
  onBalance: (b: number) => void;
  onZoom: (items: LbItem[], index: number) => void;
}) {
  const [step, setStep] = useState(0);

  // step 1
  const [desc, setDesc] = useState('');
  const [openDetails, setOpenDetails] = useState(false);
  const [picks, setPicks] = useState<CastPicks>(CAST_DEFAULTS);
  const [style, setStyle] = useState('indian');
  const [res, setRes] = useState<(typeof RESOLUTIONS)[number]>('1K');
  const [look, setLook] = useState<File | null>(null);
  const [lookUrl, setLookUrl] = useState('');
  const [count, setCount] = useState(4);

  // steps 2-4
  const [draft, setDraft] = useState<SavedModel | null>(null);
  const [chosen, setChosen] = useState('');
  const [queue, setQueue] = useState<string[]>([]);
  const [ownNudge, setOwnNudge] = useState('');
  const [name, setName] = useState('');

  const [busy, setBusy] = useState<'' | 'casting' | 'refining' | 'saving' | 'genie'>('');
  const [err, setErr] = useState('');

  const working = busy !== '';
  // The same grid the server bills from, so the estimate is the real number
  // rather than a 1K figure that quietly understates a 4K run.
  const perImage = Number(prices[res] ?? prices['1K'] ?? 1);
  const runCost = perImage * count;
  const chosenRef = draft?.refs.find((r) => r.file === chosen) ?? draft?.refs[0];

  const pick = (k: keyof CastPicks, v: string) =>
    setPicks((p) => ({ ...p, [k]: p[k] === v ? '' : v }));

  const lbItems: LbItem[] = (draft?.refs ?? []).map((r) => ({
    url: r.url,
    dl: r.url,
    name: `cast_${r.pose.replace(/\s+/g, '_')}`,
    pose: r.pose,
  }));

  /**
   * Genie, in casting mode , turn a half-sentence into a full brief.
   *
   * It rewrites the box in place rather than offering a suggestion to accept:
   * at this stage there is nothing to lose by overwriting, and the text is
   * still yours to edit afterwards.
   */
  async function genie() {
    const t = desc.trim();
    if (!t || working) return;
    setBusy('genie');
    setErr('');
    try {
      const j = await postForm<{ improved: string; balance: number }>('/api/genie', {
        prompt: t,
        mode: 'cast',
      });
      onBalance(j.balance);
      setDesc(j.improved);
    } catch (e) {
      setErr(
        e instanceof ApiError && e.status === 402
          ? 'Not enough balance for Genie.'
          : 'Genie is unavailable right now.',
      );
    } finally {
      setBusy('');
    }
  }

  async function cast() {
    if (!desc.trim() && !castSummary(picks)) {
      setErr('Describe the model, or set a few details.');
      return;
    }
    setBusy('casting');
    setErr('');
    setStep(1);
    try {
      const fd = new FormData();
      fd.append('count', String(count));
      fd.append('res', res);
      fd.append('style', style);
      fd.append('text', desc);
      if (look) fd.append('look', look);
      for (const [k, v] of Object.entries(picks)) fd.append(k, v);

      const j = await postMultipart<{ model: SavedModel; balance: number }>(
        '/api/models/create',
        fd,
      );
      onBalance(j.balance);
      setDraft(j.model);
      setChosen(j.model.refs[0]?.file ?? '');
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Could not cast.');
      setStep(0);
    } finally {
      setBusy('');
    }
  }

  /** Same brief, new draft. The old one goes, so nothing is left half-paid-for. */
  async function reroll() {
    if (draft) {
      try {
        await del(`/api/models/${draft.id}`);
      } catch {
        /* nothing to act on either way */
      }
      setDraft(null);
    }
    await cast();
  }

  async function applyNudges() {
    if (!draft || !chosen || !queue.length) return;
    setBusy('refining');
    setErr('');
    try {
      const fd = new FormData();
      fd.append('from', chosen);
      fd.append('res', res);
      fd.append('nudges', JSON.stringify(queue));
      const j = await postMultipart<{ model: SavedModel; file: string; balance: number }>(
        `/api/models/${draft.id}/refine`,
        fd,
      );
      onBalance(j.balance);
      setDraft(j.model);
      // Land on the result: the next nudge should build on what you just asked
      // for, not on what you started with.
      setChosen(j.file);
      setQueue([]);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Refine failed.');
    } finally {
      setBusy('');
    }
  }

  async function save() {
    if (!draft) return;
    if (!name.trim()) {
      setErr('Give this model a name.');
      return;
    }
    setBusy('saving');
    setErr('');
    try {
      const fd = new FormData();
      fd.append('name', name.trim());
      fd.append('keep', chosen);
      const j = await postMultipart<{ model: SavedModel }>(`/api/models/${draft.id}/confirm`, fd);
      onCreated(j.model);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Could not save.');
      setBusy('');
    }
  }

  async function discard() {
    if (draft) {
      try {
        await del(`/api/models/${draft.id}`);
      } catch {
        /* nothing to act on either way */
      }
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-full w-full max-w-[980px] flex-col overflow-hidden rounded-card border border-line bg-surface shadow-card">
        {/* ── head + stepper ── */}
        <div className="flex items-start gap-3 border-b border-line px-4 pb-4 pt-5 sm:px-7 sm:pt-6">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-accent">
              Model Studio
            </div>
            <h2 className="mt-1 text-[20px] font-bold">New model</h2>

            {/* Steps are readable as progress and clickable BACKWARDS only ,
                forward would skip work that has not happened yet. */}
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {STEPS.map((label, i) => (
                <span key={label} className="flex items-center gap-1.5">
                  {i > 0 && <span className="text-[12px] text-muted">›</span>}
                  <button
                    type="button"
                    disabled={i > step || working}
                    onClick={() => setStep(i)}
                    className={`flex items-center gap-1.5 rounded-[20px] px-2.5 py-1 text-[11.5px] font-bold transition ${
                      i === step
                        ? 'bg-ink text-surface'
                        : i < step
                          ? 'text-ink hover:bg-surface2'
                          : 'text-muted'
                    }`}
                  >
                    <span
                      className={`flex h-[17px] w-[17px] items-center justify-center rounded-full text-[9.5px] ${
                        i === step ? 'bg-surface/25' : 'bg-surface2'
                      }`}
                    >
                      {i + 1}
                    </span>
                    {label}
                  </button>
                </span>
              ))}
            </div>
          </div>
          <button
            onClick={discard}
            aria-label="Close"
            className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-full bg-surface2 text-[15px] text-muted hover:bg-line hover:text-ink"
          >
            ×
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-7">
          {/* ── 1 · describe ── */}
          {step === 0 && (
            <>
              <h3 className="text-[15px] font-bold">Describe your model</h3>
              <p className="mt-1 text-[12.5px] leading-[1.55] text-muted">
                Plain words are enough , that&apos;s the main input. The details below are only for
                what is easier picked than typed.
              </p>

              <textarea
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                maxLength={400}
                rows={3}
                placeholder="e.g. A woman in her late 20s, warm medium-deep Indian skin, long wavy black hair, athletic build, calm editorial mood."
                className="mt-3 w-full resize-y rounded-[12px] border border-line bg-bg px-3.5 py-3 text-[13.5px] leading-[1.55] text-ink"
              />

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={genie}
                  disabled={working || !desc.trim()}
                  className="inline-flex items-center gap-1.5 rounded-[9px] border border-accent-soft bg-accent-soft px-3 py-1.5 text-[11.5px] font-bold text-accent transition hover:bg-accent hover:text-white disabled:opacity-50"
                >
                  ✦ {busy === 'genie' ? 'Writing…' : 'Genie , write it for me'}
                </button>
                <span className="text-[11px] text-muted">
                  A few words are enough , Genie fills in the rest.
                </span>
              </div>

              <div className="mt-4 text-[10px] font-bold uppercase tracking-[0.06em] text-muted">
                Try one
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {EXAMPLES.map(([label, text]) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setDesc(text)}
                    className="rounded-[20px] border border-dashed border-line bg-surface2 px-3 py-1.5 text-[11.5px] font-semibold text-muted hover:border-ink hover:text-ink"
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Collapsed by default , see the note at the top of the file. */}
              <div className="mt-5 rounded-card border border-line">
                <button
                  type="button"
                  onClick={() => setOpenDetails((v) => !v)}
                  className="flex w-full items-center gap-2 px-4 py-3 text-left"
                >
                  <span className="text-[13px] font-bold">Add details</span>
                  <span className="rounded-[20px] bg-surface2 px-2 py-[2px] text-[10px] font-bold text-muted">
                    optional
                  </span>
                  <span className="ml-auto text-[12px] text-muted">
                    {openDetails ? '▴' : '▾'}
                  </span>
                </button>

                {openDetails && (
                  <div className="grid gap-x-6 gap-y-4 border-t border-line px-4 py-4 sm:grid-cols-2">
                    <Field label="Gender">
                      <Seg
                        options={[
                          ['woman', 'Woman'],
                          ['man', 'Man'],
                        ]}
                        value={picks.gender}
                        onChange={(v) =>
                          setPicks({
                            ...picks,
                            gender: v as 'woman' | 'man',
                            body: '',
                            hairstyle: '',
                            haircolour: '',
                          })
                        }
                      />
                    </Field>

                    <Field label="Ethnicity">
                      <Seg options={ETHNICITIES} value={style} onChange={setStyle} />
                    </Field>

                    <Field label="Age" note="in years">
                      <input
                        value={picks.age}
                        onChange={(e) =>
                          setPicks({ ...picks, age: e.target.value.replace(/\D/g, '').slice(0, 2) })
                        }
                        placeholder="28"
                        inputMode="numeric"
                        className="w-[78px] rounded-[8px] border border-line bg-bg px-3 py-1.5 text-center text-[12.5px] font-semibold text-ink"
                      />
                    </Field>

                    {castGroups(picks.gender).map((g) => (
                      <Field
                        key={g.key}
                        label={g.label}
                        note={
                          ['body', 'hairstyle', 'haircolour'].includes(g.key)
                            ? `for a ${picks.gender}`
                            : undefined
                        }
                      >
                        {g.key === 'skin' ? (
                          /* Swatches, not words. "Wheatish" and "medium" mean
                             different things to different people, and it is the
                             thing most worth getting exactly right. */
                          <div className="flex flex-wrap gap-1.5">
                            {g.options.map((o) => (
                              <button
                                key={o.id}
                                type="button"
                                title={o.label}
                                aria-label={o.label}
                                aria-pressed={picks.skin === o.id}
                                onClick={() => pick('skin', o.id)}
                                style={{ background: o.swatch }}
                                className={`h-7 w-7 rounded-full ring-offset-2 ring-offset-surface transition ${
                                  picks.skin === o.id
                                    ? 'ring-2 ring-ink'
                                    : 'ring-1 ring-black/15 hover:ring-ink/50'
                                }`}
                              />
                            ))}
                          </div>
                        ) : (
                          <Seg
                            options={g.options.map((o) => [o.id, o.label] as [string, string])}
                            value={picks[g.key]}
                            onChange={(v) => pick(g.key, v)}
                          />
                        )}
                      </Field>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-4">
                <div className="text-[10px] font-bold uppercase tracking-[0.06em] text-muted">
                  Look reference · optional
                </div>
                <div className="mt-1.5 flex items-center gap-3">
                  <label className="flex cursor-pointer items-center gap-2 rounded-[10px] border border-dashed border-line bg-surface2 px-3.5 py-2.5 text-[12px] font-semibold text-muted hover:border-ink hover:text-ink">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0] ?? null;
                        // Revoke first , a second pick otherwise leaks the
                        // previous object URL for the life of the page.
                        if (lookUrl) URL.revokeObjectURL(lookUrl);
                        setLook(f);
                        setLookUrl(f ? URL.createObjectURL(f) : '');
                      }}
                    />
                    {look ? 'Change image' : 'Add a reference image'}
                  </label>

                  {lookUrl && (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={lookUrl}
                        alt="Look reference"
                        className="h-14 w-14 rounded-lg border border-line object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          URL.revokeObjectURL(lookUrl);
                          setLook(null);
                          setLookUrl('');
                        }}
                        className="text-[11.5px] font-semibold text-muted underline hover:text-ink"
                      >
                        Remove
                      </button>
                    </>
                  )}
                </div>

                {/* Said plainly, and enforced in the prompt , the reference goes
                    in the style slot, never the identity slot. */}
                <div className="mt-2 flex gap-2 rounded-[9px] bg-surface2 px-3 py-2.5 text-[11px] leading-[1.45] text-muted">
                  <span>⚠</span>
                  <span>
                    One <b>overall vibe</b> reference , not for cloning a real person&apos;s
                    features. Uploading a real, identifiable face can be blocked and isn&apos;t
                    allowed under the usage policy.
                  </span>
                </div>
              </div>
            </>
          )}

          {/* ── 2 · pick ── */}
          {step === 1 && (
            <>
              <h3 className="text-[15px] font-bold">Pick the closest one</h3>
              <p className="mt-1 text-[12.5px] leading-[1.55] text-muted">
                You&apos;re better at &ldquo;yes, that one&rdquo; than at describing a face cold.
                Pick the nearest , you&apos;ll fine-tune it next. Click a selected card to zoom.
              </p>

              <div className={`mt-4 grid grid-cols-2 gap-3 ${count === 2 ? '' : 'sm:grid-cols-4'}`}>
                {busy === 'casting'
                  ? /* Skeletons rather than a spinner: the grid keeps its shape,
                       so the step does not jump when the images land. */
                    Array.from({ length: count }).map((_, i) => (
                      <div key={i} className="animate-pulse">
                        <div className="aspect-[4/5] w-full rounded-lg bg-surface2" />
                        <div className="mt-1.5 h-3 w-2/3 rounded bg-surface2" />
                      </div>
                    ))
                  : (draft?.refs ?? []).map((r, i) => {
                      const on = r.file === chosen;
                      return (
                        <button
                          key={r.file}
                          type="button"
                          onClick={() => (on ? onZoom(lbItems, i) : setChosen(r.file))}
                          title={on ? 'Zoom' : 'Select'}
                          className={`overflow-hidden rounded-lg border-2 text-left transition ${
                            on ? 'border-brand' : 'border-transparent hover:border-line'
                          }`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={imgSrc(r.url, 'web')}
                            alt={r.pose}
                            className="aspect-[4/5] w-full bg-surface2 object-cover object-top"
                          />
                          <span className="block truncate px-1.5 py-1 text-center text-[10px] font-semibold capitalize text-muted">
                            {r.pose}
                          </span>
                        </button>
                      );
                    })}
              </div>

              {busy === 'casting' && (
                <p className="mt-3 text-[12px] font-semibold text-accent">
                  Casting {count} at {res}… about {count * 20} seconds. Leave this open.
                </p>
              )}
            </>
          )}

          {/* ── 3 · refine ── */}
          {step === 2 && chosenRef && (
            <>
              <h3 className="text-[15px] font-bold">Refine until it&apos;s right</h3>
              <p className="mt-1 text-[12.5px] leading-[1.55] text-muted">
                Each nudge <b>edits</b> the same face, so the identity holds , it doesn&apos;t start
                over.
              </p>

              <div className="mt-4 grid gap-5 sm:grid-cols-[300px_1fr]">
                {/* Capped when stacked , a full-width 4:5 portrait on a phone
                    pushes the nudges off the screen entirely. */}
                <div className="mx-auto w-full max-w-[240px] sm:max-w-none">
                  <button
                    type="button"
                    onClick={() =>
                      onZoom(lbItems, draft?.refs.findIndex((r) => r.file === chosen) ?? 0)
                    }
                    className="block w-full overflow-hidden rounded-card border border-line"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imgSrc(chosenRef.url, 'web')}
                      alt={chosenRef.pose}
                      className="aspect-[4/5] w-full bg-surface2 object-cover object-top"
                    />
                  </button>
                  <div className="mt-1.5 text-center text-[10.5px] font-semibold capitalize text-muted">
                    {chosenRef.pose}
                  </div>

                  {/* Every pass is kept, so a nudge that made it worse can be
                      abandoned by stepping back to an earlier frame. */}
                  {(draft?.refs.length ?? 0) > 1 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {draft?.refs.map((r) => (
                        <button
                          key={r.file}
                          type="button"
                          onClick={() => setChosen(r.file)}
                          title={r.pose}
                          className={`h-12 w-10 overflow-hidden rounded border-2 ${
                            r.file === chosen ? 'border-brand' : 'border-transparent'
                          }`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={imgSrc(r.url, 'thumb')}
                            alt={r.pose}
                            className="h-full w-full object-cover object-top"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-card border border-line bg-surface2 p-4">
                  <h4 className="text-[13px] font-bold">Nudge it</h4>
                  <p className="mt-0.5 text-[11.5px] leading-[1.5] text-muted">
                    Tap to queue, or type your own, then apply. Fine detail belongs here , against a
                    face you can see.
                  </p>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {CAST_NUDGES.map((n) => (
                      <Chip
                        key={n}
                        on={queue.includes(n)}
                        onClick={() =>
                          setQueue((q) => (q.includes(n) ? q.filter((x) => x !== n) : [...q, n]))
                        }
                      >
                        {n}
                      </Chip>
                    ))}
                  </div>

                  <div className="mt-3 flex gap-2">
                    <input
                      value={ownNudge}
                      onChange={(e) => setOwnNudge(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key !== 'Enter' || !ownNudge.trim()) return;
                        e.preventDefault();
                        setQueue((q) => [...q, ownNudge.trim()]);
                        setOwnNudge('');
                      }}
                      maxLength={120}
                      placeholder="Or type a nudge , e.g. sharper cheekbones, side part"
                      className="flex-1 rounded-lg border border-line bg-bg px-3 py-2 text-[12.5px] text-ink"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!ownNudge.trim()) return;
                        setQueue((q) => [...q, ownNudge.trim()]);
                        setOwnNudge('');
                      }}
                      title="Add this nudge"
                      className="rounded-lg border border-line px-3 text-[16px] font-bold text-ink"
                    >
                      +
                    </button>
                  </div>

                  <div className="mt-3 text-[10px] font-bold uppercase tracking-[0.06em] text-muted">
                    Queued nudges
                  </div>
                  <div className="mt-1 text-[12px] leading-[1.5]">
                    {queue.length ? (
                      <span className="text-ink">{queue.join('; ')}</span>
                    ) : (
                      <span className="text-muted">None yet , tap one above.</span>
                    )}
                  </div>

                  <button
                    onClick={applyNudges}
                    disabled={working || !queue.length}
                    className="mt-3 w-full rounded-[9px] bg-brand px-5 py-2.5 text-[12.5px] font-bold text-white disabled:opacity-50"
                  >
                    {busy === 'refining'
                      ? 'Applying…'
                      : `Apply nudges · ${perImage} credit${perImage === 1 ? '' : 's'}`}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* ── 4 · save ── */}
          {step === 3 && chosenRef && (
            <>
              <h3 className="text-[15px] font-bold">Save to My Models</h3>
              <p className="mt-1 text-[12.5px] leading-[1.55] text-muted">
                Name it and check the tags. It joins My Models, ready to reuse in any shoot.
              </p>

              <div className="mt-4 grid gap-5 sm:grid-cols-[260px_1fr]">
                <div className="mx-auto w-full max-w-[240px] sm:max-w-none">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imgSrc(chosenRef.url, 'web')}
                    alt="Final model"
                    className="aspect-[4/5] w-full rounded-card border border-line bg-surface2 object-cover object-top"
                  />
                  <div className="mt-1.5 text-center text-[10.5px] font-semibold text-muted">
                    Final model
                  </div>
                </div>

                <div>
                  <label className="block">
                    <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-muted">
                      Name
                    </span>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      maxLength={80}
                      placeholder="e.g. Meera , editorial"
                      className="mt-1 w-full rounded-lg border border-line bg-bg px-3 py-2 text-[13px] text-ink"
                    />
                  </label>

                  <div className="mt-4 text-[10px] font-bold uppercase tracking-[0.06em] text-muted">
                    Tags
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {[ETHNICITIES.find(([v]) => v === style)?.[1], ...castSummary(picks).split(' · ')]
                      .filter(Boolean)
                      .map((t, i) => (
                        <span
                          key={`${t}-${i}`}
                          className="rounded-[20px] bg-surface2 px-2.5 py-1 text-[11.5px] font-semibold text-muted"
                        >
                          {t}
                        </span>
                      ))}
                  </div>

                  <div className="mt-4 rounded-card border border-accent-soft bg-accent-soft p-3 text-[11.5px] leading-[1.5] text-accent">
                    <b>Next, optional:</b> generate a <b>character sheet</b> from the model&apos;s
                    folder to lock it from more angles , that is what makes it hold up as an
                    identity anchor across shoots.
                  </div>
                </div>
              </div>
            </>
          )}

          {err && <div className="mt-4 text-[12px] font-semibold text-brand">{err}</div>}
        </div>

        {/* ── footer bar ── */}
        <div className="flex flex-wrap items-center gap-3 border-t border-line px-4 py-4 sm:gap-4 sm:px-7">
          {step === 0 && (
            <>
              <Field label="Resolution" note="try 1K first" inline>
                <Seg
                  options={RESOLUTIONS.map((r) => [r, r] as [string, string])}
                  value={res}
                  onChange={(v) => setRes(v as (typeof RESOLUTIONS)[number])}
                />
              </Field>
              <Field label="Candidates" inline>
                <Seg
                  options={[
                    ['2', '2'],
                    ['4', '4'],
                  ]}
                  value={String(count)}
                  onChange={(v) => setCount(Number(v))}
                />
              </Field>
              <div className="ml-auto text-right text-[11px] text-muted">
                Est. this run
                <br />
                <b className="text-[13px] text-ink">
                  {runCost} credit{runCost === 1 ? '' : 's'}
                </b>
              </div>
              <button onClick={cast} disabled={working} className={btnPrimary}>
                Cast models →
              </button>
            </>
          )}

          {step === 1 && (
            <>
              <button onClick={() => setStep(0)} disabled={working} className={btnGhost}>
                ← Back
              </button>
              <button onClick={reroll} disabled={working} className={btnGhost}>
                ↻ Re-roll · {runCost}
              </button>
              <button
                onClick={() => setStep(2)}
                disabled={working || !chosen}
                className={`ml-auto ${btnPrimary}`}
              >
                Refine this one →
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <button onClick={() => setStep(1)} disabled={working} className={btnGhost}>
                ← Back to options
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={working}
                className={`ml-auto ${btnPrimary}`}
              >
                Looks right → Save model
              </button>
            </>
          )}

          {step === 3 && (
            <>
              <button onClick={() => setStep(2)} disabled={working} className={btnGhost}>
                ← Back to refine
              </button>
              <button onClick={discard} disabled={working} className={btnGhost}>
                Discard
              </button>
              <button onClick={save} disabled={working} className={`ml-auto ${btnPrimary}`}>
                {busy === 'saving' ? 'Saving…' : 'Save to My Models'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const btnPrimary =
  'rounded-[9px] bg-brand px-5 py-2.5 text-[12.5px] font-bold text-white disabled:opacity-50';
const btnGhost =
  'rounded-[9px] border border-line px-4 py-2.5 text-[12.5px] font-bold text-ink disabled:opacity-50';

function Field({
  label,
  note,
  inline,
  children,
}: {
  label: string;
  note?: string;
  inline?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={inline ? '' : 'min-w-0'}>
      <div className="mb-1.5 flex items-baseline gap-1.5">
        <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-muted">
          {label}
        </span>
        {note && <span className="text-[10px] text-muted opacity-70">· {note}</span>}
      </div>
      {children}
    </div>
  );
}

/** A segmented control , one row, one choice, everything visible. */
function Seg({
  options,
  value,
  onChange,
}: {
  options: Array<[string, string]> | ReadonlyArray<readonly [string, string]>;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 rounded-[10px] bg-surface2 p-1">
      {options.map(([v, l]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          aria-pressed={value === v}
          className={`rounded-[7px] px-2.5 py-1.5 text-[11.5px] font-semibold transition ${
            value === v ? 'bg-surface text-ink shadow-card' : 'text-muted hover:text-ink'
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`rounded-[20px] border px-2.5 py-1 text-[11.5px] font-semibold transition ${
        on ? 'border-ink bg-ink text-surface' : 'border-line bg-surface text-ink hover:border-ink'
      }`}
    >
      {children}
    </button>
  );
}
