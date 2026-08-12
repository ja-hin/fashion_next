'use client';

import { useMemo, useRef, useState } from 'react';
import { Select } from './ui';
import GenieDrawer from './GenieDrawer';
import PosePreview from './PosePreview';
import { GenieIcon } from './icons';
import {
  posesFor,
  FRAMINGS,
  ASPECTS,
  RESOLUTIONS,
  BACKDROPS,
  MOODS,
  LIGHTINGS,
} from '@/lib/client/constants';
import type { PoseSettings } from '@/lib/client/types';

/** "same" = inherit the shoot's locked setting for this field. */
const sameOpt = (opts: Array<[string, string] | string>): Array<[string, string]> => [
  ['', 'same'],
  ...opts.map((o) => (Array.isArray(o) ? o : ([o, o] as [string, string]))),
];

type Mode = 'tile' | 'choose' | 'one';

/**
 * The trailing card in the results grid: add one more pose, or open the batch
 * planner. Collapses back to a tile after each generation starts.
 */
export default function AddCard({
  category,
  pid,
  onAddOne,
  onAddMany,
  onStartBatch,
  onBalance,
  geniePrice,
  priceFor,
}: {
  /** Drives which pose list is offered — menswear and womenswear differ. */
  category: string;
  /** Genie reads the locked model and garment from the shoot; null hides it. */
  pid: string | null;
  onAddOne: (pose: string, settings: PoseSettings) => void;
  /** Several poses at once — one image each, all sharing these settings. */
  onAddMany: (rows: Array<PoseSettings & { pose: string }>) => void;
  onStartBatch: () => void;
  onBalance: (b: number) => void;
  geniePrice: number;
  /** Credits for one image at a resolution; '' means the shoot's own. */
  priceFor: (resolution: string) => number;
}) {
  const [mode, setMode] = useState<Mode>('tile');
  const [prompt, setPrompt] = useState('');
  const [s, setS] = useState<PoseSettings>({});
  const [genie, setGenie] = useState(false);
  /** Pose indices, kept in the order they were ticked — that's the render order. */
  const [selected, setSelected] = useState<number[]>([]);

  const poses = useMemo(() => posesFor(category), [category]);

  const set = (patch: PoseSettings) => setS((prev) => ({ ...prev, ...patch }));

  // Two or more poses means the prompt box no longer maps to a single image, so
  // each pose uses its own library text instead.
  const multi = selected.length > 1;
  const count = Math.max(1, selected.length);

  /** The hovered pose's reference image, and which side it has room to open on. */
  const [peek, setPeek] = useState<{ label: string; side: 'left' | 'right' } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  function showPeek(label: string) {
    // Opens to the right unless the card is close enough to the window edge
    // that the popover would push the page sideways.
    const rect = panelRef.current?.getBoundingClientRect();
    const room = rect ? window.innerWidth - rect.right : 0;
    setPeek({ label, side: room > 200 ? 'right' : 'left' });
  }
  // Priced off the panel's own resolution override, not the shoot's — picking
  // 4K here and being quoted the 1K rate would understate the bill, and the
  // multi-select multiplies that error by the number of poses ticked.
  const total = count * priceFor(s.resolution ?? '');

  function togglePose(i: number) {
    const next = selected.includes(i) ? selected.filter((n) => n !== i) : [...selected, i];
    setSelected(next);

    // Landing on exactly one pose fills the editable prompt with its text, the
    // way picking from the old dropdown did. Unticking back to none clears it
    // again — but only while it is still the untouched library wording, so
    // anything typed or run through the Genie survives.
    if (next.length === 1) setPrompt(poses[next[0]][1]);
    else if (next.length === 0 && selected.length === 1 && prompt === poses[selected[0]][1]) {
      setPrompt('');
    }
  }

  function generate() {
    if (multi) {
      onAddMany(selected.map((i) => ({ ...s, pose: poses[i][1] })));
    } else {
      onAddOne(prompt.trim() || 'standing front', s);
    }
    // Reset so the next add starts clean, matching the old behaviour.
    setPrompt('');
    setS({});
    setSelected([]);
    setMode('tile');
  }

  if (mode === 'tile') {
    return (
      <div className="group w-[212px] self-start rounded-card border-[1.5px] border-dashed border-line bg-surface transition hover:border-brand">
        <button
          onClick={() => setMode('choose')}
          className="flex min-h-[300px] w-full flex-col items-center justify-center gap-2 rounded-card font-bold text-muted group-hover:text-brand"
        >
          <span className="text-3xl leading-none">＋</span>
          Add more poses
        </button>
      </div>
    );
  }

  if (mode === 'choose') {
    return (
      <div className="w-[212px] self-start rounded-card border-[1.5px] border-dashed border-line bg-surface">
        <div className="flex min-h-[300px] flex-col gap-2.5 px-4 py-5">
          <div className="mb-1 text-sm font-bold">Add more poses</div>
          <div className="mb-2 text-[11.5px] leading-[1.5] text-muted">
            Same locked model — pick how you want to add.
          </div>
          <button
            onClick={() => setMode('one')}
            className="flex items-center gap-2.5 rounded-[11px] border border-line bg-surface p-[13px] text-left text-[13px] font-semibold hover:border-brand hover:bg-brand-soft hover:text-brand"
          >
            <span className="text-base">＋</span>
            <div>
              <div>Add poses</div>
              <div className="mt-0.5 text-[10.5px] font-normal text-muted">
                pick one or many, with options
              </div>
            </div>
          </button>
          <button
            onClick={onStartBatch}
            className="flex items-center gap-2.5 rounded-[11px] border border-line bg-surface p-[13px] text-left text-[13px] font-semibold hover:border-brand hover:bg-brand-soft hover:text-brand"
          >
            <span className="text-base">≣</span>
            <div>
              <div>Plan a batch</div>
              <div className="mt-0.5 text-[10.5px] font-normal text-muted">queue many at once</div>
            </div>
          </button>
          <button
            onClick={() => setMode('tile')}
            className="mt-auto self-start text-xs font-semibold text-muted hover:text-ink"
          >
            cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    // `relative` anchors the hover preview. It is rendered here rather than
    // inside the scrolling pose list because an overflow-y-auto box clips its
    // children on BOTH axes — a popover sitting inside it would be cut off.
    <div
      ref={panelRef}
      className="relative w-[256px] self-start rounded-card border-[1.5px] border-dashed border-line bg-surface"
    >
      {peek && (
        <PosePreview key={peek.label} category={category} label={peek.label} side={peek.side} />
      )}
      <div className="p-4">
        <div className="mb-3 flex items-center">
          <b className="text-[13px]">{multi ? `Add ${selected.length} poses` : 'Add a pose'}</b>
          <button
            onClick={() => setMode('tile')}
            aria-label="Close"
            className="ml-auto flex h-[26px] w-[26px] items-center justify-center rounded-[7px] bg-surface2 text-sm text-muted"
          >
            ×
          </button>
        </div>

        <div className="flex items-baseline">
          <label className="lbl">Pose</label>
          {selected.length > 0 && (
            <button
              onClick={() => {
                setSelected([]);
                setPrompt('');
              }}
              className="mb-1.5 ml-auto text-[10.5px] font-bold text-muted hover:text-ink"
            >
              clear {selected.length}
            </button>
          )}
        </div>
        {/*
          A list of checkboxes rather than a dropdown: ticking several is the
          whole point, and a multi-select <select> hides the count behind a
          scroll on every browser that renders it differently.
        */}
        <div className="mb-[9px] max-h-[168px] overflow-y-auto rounded-[9px] border border-line bg-field p-1">
          {poses.map(([label], i) => {
            const on = selected.includes(i);
            return (
              <label
                key={label}
                onMouseEnter={() => showPeek(label)}
                onMouseLeave={() => setPeek((p) => (p?.label === label ? null : p))}
                className={`flex cursor-pointer items-center gap-2 rounded-[7px] px-2 py-[5px] text-[12px] leading-tight hover:bg-surface2 ${
                  on ? 'font-bold text-ink' : 'text-muted'
                }`}
              >
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => togglePose(i)}
                  // Keyboard users get the same peek as the mouse.
                  onFocus={() => showPeek(label)}
                  onBlur={() => setPeek((p) => (p?.label === label ? null : p))}
                  // The base stylesheet stretches every input to full width —
                  // a checkbox has to opt back out of it.
                  className="h-[14px] w-[14px] flex-shrink-0 accent-brand p-0"
                />
                {label}
              </label>
            );
          })}
        </div>

        <div className="mb-[9px] flex gap-2.5">
          <div className="flex-1">
            <label className="lbl">Framing</label>
            <Select
              value={s.framing ?? ''}
              onChange={(v) => set({ framing: v })}
              options={sameOpt(FRAMINGS)}
            />
          </div>
          <div className="flex-1">
            <label className="lbl">Aspect</label>
            <Select
              value={s.aspect ?? ''}
              onChange={(v) => set({ aspect: v })}
              options={sameOpt(ASPECTS)}
            />
          </div>
          <div className="flex-1">
            <label className="lbl">Res</label>
            <Select
              value={s.resolution ?? ''}
              onChange={(v) => set({ resolution: v })}
              options={sameOpt(RESOLUTIONS.map(([v]) => v))}
            />
          </div>
        </div>

        <div className="mb-[9px] flex gap-2.5">
          <div className="flex-1">
            <label className="lbl">Backdrop</label>
            <Select
              value={s.backdrop ?? ''}
              onChange={(v) => set({ backdrop: v })}
              // Genie can hand back a full scene description read off a
              // reference photo, which is deliberately not one of the presets.
              // Offer it as its own option so the select can show what is set.
              options={
                s.backdrop && !BACKDROPS.some(([v]) => v === s.backdrop)
                  ? [...sameOpt(BACKDROPS), [s.backdrop, '✦ matched from reference'] as [string, string]]
                  : sameOpt(BACKDROPS)
              }
            />
          </div>
          <div className="flex-1">
            <label className="lbl">Mood</label>
            <Select
              value={s.mood ?? ''}
              onChange={(v) => set({ mood: v })}
              options={sameOpt(MOODS)}
            />
          </div>
        </div>

        <div className="mb-[13px]">
          <label className="lbl">Lighting</label>
          <Select
            value={s.lighting ?? ''}
            onChange={(v) => set({ lighting: v })}
            options={sameOpt(LIGHTINGS)}
          />
        </div>

        {multi ? (
          <div className="rounded-[9px] border border-line bg-surface2 p-2.5 text-[11px] leading-[1.5] text-muted">
            <b className="text-ink">{selected.length} poses selected</b> — each becomes its own
            image, generated one after another with the options above. Tick a single pose to edit
            its prompt.
            {/* There is no single prompt box to hang the Genie off in this mode,
                but a multi-select is exactly what the art director is best at:
                it rewrites all of them at once and hands back an editable set. */}
            <button
              type="button"
              onClick={() => setGenie(true)}
              disabled={!pid}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-genie/40 bg-surface px-2.5 py-[7px] text-[11px] font-bold text-genie hover:bg-genie/[.06] disabled:opacity-40"
            >
              <GenieIcon className="h-[15px] w-[15px]" />
              Refine all {selected.length} with Genie
            </button>
          </div>
        ) : (
          <>
            <label className="lbl">Prompt · editable</label>
            <div className="relative">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Pick a pose to fill this, or write your own…"
              />
              {/* Always the art director, whether the box is empty or already
                  holds a pose. The inline rewrite that used to live here put its
                  answer in a panel under the card; the drawer can do the same
                  refinement and also take a reference image or build a set. */}
              <button
                type="button"
                onClick={() => setGenie(true)}
                disabled={!pid}
                title="Genie — refine this pose, describe a new shot, or match a reference photo"
                className="group absolute bottom-[7px] right-[7px] flex h-[30px] w-[30px] items-center justify-center rounded-lg transition hover:scale-110 disabled:opacity-40"
              >
                <GenieIcon className="h-7 w-7" />
                <span className="pointer-events-none absolute bottom-[38px] right-0 z-[9] w-[184px] rounded-lg bg-ink px-2.5 py-2 text-[11px] leading-[1.45] text-surface opacity-0 transition group-hover:opacity-100">
                  <b className="text-[#c9a8ff]">✦ Ask Genie</b> —{' '}
                  {prompt.trim() ? 'refine this pose' : 'describe the shot'}, or attach a photo to
                  match. {geniePrice > 0 ? `${geniePrice} credit each.` : 'Free.'}
                </span>
              </button>
            </div>
          </>
        )}

        <button
          onClick={generate}
          className="mt-[11px] flex w-full items-center justify-center gap-2 rounded-[11px] bg-ink p-[13px] text-[14.5px] font-bold text-surface"
        >
          Generate {count === 1 ? 'image' : `${count} images`} · {total} credit
          {total === 1 ? '' : 's'}
        </button>
      </div>

      <GenieDrawer
        open={genie}
        onClose={() => setGenie(false)}
        pid={pid}
        // Several ticked poses go in as the list to rewrite; a single one is
        // whatever is in the prompt box, which may have been edited by hand.
        selection={
          multi
            ? selected.map((i) => poses[i][1])
            : prompt.trim()
              ? [prompt.trim()]
              : []
        }
        geniePrice={geniePrice}
        priceFor={priceFor}
        onBalance={onBalance}
        onApply={(pose, settings) => {
          setPrompt(pose);
          // Genie leaves a field '' when it means "leave this alone", which is
          // the card's own "same" value — so this merge is safe to apply whole.
          set(settings);
          // A direction is for one shot; ticked library poses would override it.
          setSelected([]);
        }}
        // A set runs straight through the batch endpoint — it already generates
        // one image per row, sequentially, which is what the card does for
        // several ticked poses.
        onGenerate={(rows) => {
          onAddMany(rows);
          setPrompt('');
          setS({});
          setSelected([]);
          setMode('tile');
        }}
      />
    </div>
  );
}