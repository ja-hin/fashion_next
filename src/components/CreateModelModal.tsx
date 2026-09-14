'use client';

import { useState } from 'react';
import { postMultipart, del, imgSrc, ApiError } from '@/lib/client/api';
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
 * Casting, in the three stages the Python studio proved out.
 *
 *   1  describe   picks + a free sentence
 *   2  choose     four candidates, one brief , casting is a choice, and one
 *                 roll of the dice is not a choice
 *   3  nudge      edits the chosen face while holding its identity, as many
 *                 passes as it takes, then name it and keep it
 *
 * Nothing reaches My Models until stage three is accepted. The draft that
 * holds the candidates is a real model document with `draft: true`, so every
 * frame already has a URL and the whole thing is one delete if abandoned.
 */
export default function CreateModelModal({
  price,
  onClose,
  onCreated,
  onBalance,
  onZoom,
}: {
  /** Credits per image. Four candidates cost four; each nudge pass costs one. */
  price: number;
  onClose: () => void;
  onCreated: (m: SavedModel) => void;
  onBalance: (b: number) => void;
  onZoom: (items: LbItem[], index: number) => void;
}) {
  const [picks, setPicks] = useState<CastPicks>(CAST_DEFAULTS);
  const [style, setStyle] = useState('indian');
  const [free, setFree] = useState('');

  const [draft, setDraft] = useState<SavedModel | null>(null);
  /** Which frame the customer is working on. */
  const [chosen, setChosen] = useState('');
  const [queue, setQueue] = useState<string[]>([]);
  const [ownNudge, setOwnNudge] = useState('');
  const [name, setName] = useState('');

  const [busy, setBusy] = useState<'' | 'casting' | 'refining' | 'saving' | 'discarding'>('');
  const [err, setErr] = useState('');

  const working = busy !== '';
  const castCost = price * 4;

  const pick = (k: keyof CastPicks, v: string) =>
    setPicks((p) => ({ ...p, [k]: p[k] === v ? '' : v }));

  const lbItems: LbItem[] = (draft?.refs ?? []).map((r) => ({
    url: r.url,
    dl: r.url,
    name: `cast_${r.pose.replace(/\s+/g, '_')}`,
    pose: r.pose,
  }));

  async function cast() {
    setBusy('casting');
    setErr('');
    try {
      const fd = new FormData();
      fd.append('count', '4');
      fd.append('style', style);
      fd.append('text', free);
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
    } finally {
      setBusy('');
    }
  }

  async function applyNudges() {
    if (!draft || !chosen) return;
    if (!queue.length) {
      setErr('Queue a nudge first.');
      return;
    }
    setBusy('refining');
    setErr('');
    try {
      const fd = new FormData();
      fd.append('from', chosen);
      fd.append('nudges', JSON.stringify(queue));
      const j = await postMultipart<{ model: SavedModel; file: string; balance: number }>(
        `/api/models/${draft.id}/refine`,
        fd,
      );
      onBalance(j.balance);
      setDraft(j.model);
      // Land on the result , it is the thing you just asked for, and the next
      // nudge should build on it rather than on what you started with.
      setChosen(j.file);
      setQueue([]);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Refine failed.');
    } finally {
      setBusy('');
    }
  }

  async function keep() {
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
      const j = await postMultipart<{ model: SavedModel }>(
        `/api/models/${draft.id}/confirm`,
        fd,
      );
      onCreated(j.model);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Could not save.');
      setBusy('');
    }
  }

  async function discard(thenClose: boolean) {
    if (!draft) {
      onClose();
      return;
    }
    setBusy('discarding');
    try {
      await del(`/api/models/${draft.id}`);
    } catch {
      /* Gone already, or the network blinked. Either way it is not in the
         roster, so there is nothing left for the customer to act on. */
    }
    setDraft(null);
    setChosen('');
    setQueue([]);
    setName('');
    setBusy('');
    if (thenClose) onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-full w-[720px] overflow-y-auto rounded-card border border-line bg-surface p-6 shadow-card">
        {/* ── stage 1: describe ── */}
        {!draft ? (
          <>
            <h2 className="text-[17px] font-bold">Cast a model</h2>
            <p className="mt-1 text-[12.5px] leading-[1.5] text-muted">
              Describe who you want. You&apos;ll get four to choose from, then you can nudge the one
              you like until it&apos;s right.
            </p>

            <Row label="Gender">
              {(['woman', 'man'] as const).map((g) => (
                <Chip key={g} on={picks.gender === g} onClick={() => setPicks({ ...CAST_DEFAULTS, gender: g })}>
                  {g === 'woman' ? 'Woman' : 'Man'}
                </Chip>
              ))}
            </Row>

            <Row label="Ethnicity">
              {ETHNICITIES.map(([v, l]) => (
                <Chip key={v} on={style === v} onClick={() => setStyle(v)}>
                  {l}
                </Chip>
              ))}
            </Row>

            <Row label="Age" hint="optional">
              <input
                value={picks.age}
                onChange={(e) => setPicks({ ...picks, age: e.target.value.replace(/\D/g, '').slice(0, 2) })}
                placeholder="28"
                inputMode="numeric"
                className="w-[74px] rounded-[20px] border border-line bg-surface2 px-3 py-1.5 text-center text-[12px] font-semibold text-ink"
              />
              <span className="self-center text-[11.5px] text-muted">years</span>
            </Row>

            {/* Rebuilt when gender changes , "man-bun" and "tied back" are not
                the same list, and offering both to everyone reads as a
                machine's list rather than a casting call. */}
            {castGroups(picks.gender).map((g) => (
              <Row key={g.key} label={g.label} hint="optional">
                {g.options.map((o) => (
                  <Chip key={o.id} on={picks[g.key] === o.id} onClick={() => pick(g.key, o.id)}>
                    {o.swatch && (
                      <span
                        aria-hidden="true"
                        className="inline-block h-3.5 w-3.5 rounded-full ring-1 ring-black/15"
                        style={{ background: o.swatch }}
                      />
                    )}
                    {o.label}
                  </Chip>
                ))}
              </Row>
            ))}

            <label className="mt-4 block">
              <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-muted">
                Anything else
              </span>
              <textarea
                value={free}
                onChange={(e) => setFree(e.target.value)}
                maxLength={400}
                rows={2}
                placeholder="e.g. freckles, strong brows, looks like she runs a boutique"
                className="mt-1 w-full resize-y rounded-lg border border-line bg-bg px-3 py-2 text-[13px] leading-[1.5] text-ink"
              />
            </label>

            {err && <div className="mt-3 text-[12px] font-semibold text-brand">{err}</div>}

            <div className="mt-5 flex items-center gap-2">
              <button onClick={onClose} disabled={working} className={btnGhost}>
                Cancel
              </button>
              <button onClick={cast} disabled={working} className={`ml-auto ${btnPrimary}`}>
                {busy === 'casting' ? 'Casting…' : `Cast 4 candidates · ${castCost} credits`}
              </button>
            </div>
            {busy === 'casting' && (
              <p className="mt-2 text-[11.5px] text-muted">
                Four images, about a minute and a half. Leave this open.
              </p>
            )}
          </>
        ) : (
          /* ── stages 2 + 3: choose, then nudge ── */
          <>
            <h2 className="text-[17px] font-bold">Pick one, then nudge it</h2>
            <p className="mt-1 text-[12.5px] leading-[1.5] text-muted">
              Click to select, click again to zoom. Each nudge <b>edits</b> the same face, so the
              identity holds , it doesn&apos;t start over.
            </p>

            <div className="mt-4 grid grid-cols-4 gap-2">
              {draft.refs.map((r, i) => {
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

            <div className="mt-2 text-[11.5px] text-muted">{castSummary(picks)}</div>

            {/* nudges */}
            <div className="mt-4 rounded-card border border-line bg-surface2 p-3.5">
              <div className="text-[12px] font-bold">Nudges</div>
              <p className="mt-0.5 text-[11px] leading-[1.5] text-muted">
                Tap to queue, or type your own, then apply. Fine detail belongs here , against a
                face you can see.
              </p>

              <div className="mt-2.5 flex flex-wrap gap-1.5">
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

              <div className="mt-2.5 flex gap-2">
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
                  className="rounded-lg border border-line px-3 text-[16px] font-bold text-ink"
                  title="Add this nudge"
                >
                  +
                </button>
              </div>

              {queue.length > 0 && (
                <div className="mt-2.5 text-[11.5px] text-muted">
                  <b className="text-ink">Queued:</b> {queue.join('; ')}
                </div>
              )}

              <button
                onClick={applyNudges}
                disabled={working || !queue.length}
                className={`mt-3 w-full justify-center ${btnPrimary}`}
              >
                {busy === 'refining'
                  ? 'Applying…'
                  : `Apply ${queue.length || ''} nudge${queue.length === 1 ? '' : 's'} · ${price} credit${price === 1 ? '' : 's'}`}
              </button>
            </div>

            <label className="mt-4 block">
              <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-muted">
                Name this model
              </span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                placeholder="e.g. Aisha"
                className="mt-1 w-full rounded-lg border border-line bg-bg px-3 py-2 text-[13px] text-ink"
              />
            </label>

            {err && <div className="mt-3 text-[12px] font-semibold text-brand">{err}</div>}

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <button onClick={() => discard(true)} disabled={working} className={btnGhost}>
                Discard
              </button>
              <button onClick={() => discard(false)} disabled={working} className={btnGhost}>
                ↻ Start over
              </button>
              <button onClick={keep} disabled={working || !chosen} className={`ml-auto ${btnPrimary}`}>
                {busy === 'saving' ? 'Saving…' : 'Keep this model'}
              </button>
            </div>
            <p className="mt-2 text-[11px] text-muted">
              Only the selected frame is kept. The rest are deleted , a model with three faces you
              rejected would give every shoot the wrong one to anchor to.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

const btnPrimary =
  'flex items-center rounded-[9px] bg-brand px-5 py-2.5 text-[12.5px] font-bold text-white disabled:opacity-60';
const btnGhost =
  'rounded-[9px] border border-line px-4 py-2.5 text-[12.5px] font-bold text-ink disabled:opacity-50';

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-4">
      <div className="mb-1.5 flex items-baseline gap-1.5">
        <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-muted">
          {label}
        </span>
        {hint && <span className="text-[10px] text-muted opacity-70">{hint}</span>}
      </div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
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
      className={`flex items-center gap-1.5 rounded-[20px] border px-3 py-1.5 text-[12px] font-semibold transition ${
        on ? 'border-ink bg-ink text-surface' : 'border-line bg-surface2 text-ink hover:border-ink'
      }`}
    >
      {children}
    </button>
  );
}
