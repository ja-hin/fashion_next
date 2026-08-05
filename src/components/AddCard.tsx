'use client';

import { useMemo, useState } from 'react';
import { Select } from './ui';
import GenieBox from './GenieBox';
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
  onAddOne,
  onStartBatch,
  onBalance,
  geniePrice,
  costPerImage,
}: {
  /** Drives which pose list is offered — menswear and womenswear differ. */
  category: string;
  onAddOne: (pose: string, settings: PoseSettings) => void;
  onStartBatch: () => void;
  onBalance: (b: number) => void;
  geniePrice: number;
  costPerImage: number;
}) {
  const [mode, setMode] = useState<Mode>('tile');
  const [prompt, setPrompt] = useState('');
  const [s, setS] = useState<PoseSettings>({});

  const poses = useMemo(() => posesFor(category), [category]);
  const poseOpts = useMemo<Array<[string, string]>>(
    () => [
      ['', '— choose a pose —'],
      ...poses.map(([label], i) => [String(i), label] as [string, string]),
    ],
    [poses],
  );

  const set = (patch: PoseSettings) => setS((prev) => ({ ...prev, ...patch }));

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
              <div>Add one</div>
              <div className="mt-0.5 text-[10.5px] font-normal text-muted">
                single pose, with options
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
    <div className="w-[256px] self-start rounded-card border-[1.5px] border-dashed border-line bg-surface">
      <div className="p-4">
        <div className="mb-3 flex items-center">
          <b className="text-[13px]">Add one pose</b>
          <button
            onClick={() => setMode('tile')}
            aria-label="Close"
            className="ml-auto flex h-[26px] w-[26px] items-center justify-center rounded-[7px] bg-surface2 text-sm text-muted"
          >
            ×
          </button>
        </div>

        <label className="lbl">Pose</label>
        <Select
          value=""
          onChange={(v) => v !== '' && setPrompt(poses[Number(v)][1])}
          options={poseOpts}
          className="mb-[9px]"
        />

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
              options={sameOpt(BACKDROPS)}
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

        <label className="lbl">Prompt · editable</label>
        <div className="relative">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Pick a pose to fill this, or write your own…"
          />
          <GenieBox
            text={prompt}
            onUse={setPrompt}
            onBalance={onBalance}
            geniePrice={geniePrice}
          />
        </div>

        <button
          onClick={() => {
            onAddOne(prompt.trim() || 'standing front', s);
            // Reset so the next add starts clean, matching the old behaviour.
            setPrompt('');
            setS({});
            setMode('tile');
          }}
          className="mt-[11px] flex w-full items-center justify-center gap-2 rounded-[11px] bg-ink p-[13px] text-[14.5px] font-bold text-surface"
        >
          Generate image · {costPerImage} credit{costPerImage === 1 ? '' : 's'}
        </button>
      </div>
    </div>
  );
}