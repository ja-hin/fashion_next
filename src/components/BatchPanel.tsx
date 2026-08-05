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

const sameOpt = (opts: Array<[string, string] | string>): Array<[string, string]> => [
  ['', 'same'],
  ...opts.map((o) => (Array.isArray(o) ? o : ([o, o] as [string, string]))),
];

interface Row extends PoseSettings {
  key: number;
  prompt: string;
}

let nextKey = 1;
const blankRow = (): Row => ({ key: nextKey++, prompt: '' });

/**
 * Queue several poses and generate them in one run. The server processes them
 * sequentially, and results stream back into the grid as each lands.
 */
export default function BatchPanel({
  category,
  onRun,
  onClose,
  onBalance,
  geniePrice,
  priceFor,
}: {
  /** Drives which pose list is offered — menswear and womenswear differ. */
  category: string;
  onRun: (rows: Array<PoseSettings & { pose: string }>) => void;
  onClose: () => void;
  onBalance: (b: number) => void;
  geniePrice: number;
  /** Credits for one image at the given resolution ('' = the shoot's default). */
  priceFor: (resolution: string) => number;
}) {
  const [rows, setRows] = useState<Row[]>(() => [blankRow(), blankRow()]);

  const poses = useMemo(() => posesFor(category), [category]);
  const poseOpts = useMemo<Array<[string, string]>>(
    () => [
      ['', '— choose a pose —'],
      ...poses.map(([label], i) => [String(i), label] as [string, string]),
    ],
    [poses],
  );

  const patch = (key: number, p: Partial<Row>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...p } : r)));

  const total = rows.reduce((sum, r) => sum + priceFor(r.resolution ?? ''), 0);

  function run() {
    const payload = rows
      .map((r) => ({
        pose: r.prompt.trim() || 'standing front',
        framing: r.framing ?? '',
        backdrop: r.backdrop ?? '',
        mood: r.mood ?? '',
        lighting: r.lighting ?? '',
        aspect: r.aspect ?? '',
        resolution: r.resolution ?? '',
      }))
      .filter((r) => r.pose);

    if (!payload.length) return;
    onRun(payload);
    // Reset to a fresh pair of rows, matching the old auto-reset behaviour.
    setRows([blankRow(), blankRow()]);
  }

  return (
    <div className="mt-[22px] overflow-hidden rounded-card border border-line bg-surface shadow-card">
      <div className="flex items-center gap-3 border-b border-line p-[14px_16px]">
        <h3 className="text-[15px] font-bold">Plan a batch</h3>
        <span className="text-[11px] text-muted">
          {rows.length} image{rows.length !== 1 ? 's' : ''} · {total} cr
        </span>
        <div className="flex-1" />
        <button
          onClick={onClose}
          className="rounded-lg bg-surface2 px-3 py-[7px] text-xs font-semibold text-ink"
        >
          ← Back to single add
        </button>
      </div>

      <div className="overflow-x-auto">
        {rows.map((r, i) => (
          <div key={r.key} className="flex items-start gap-[9px] border-b border-line p-[12px_16px]">
            <span className="mt-6 flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-md bg-surface2 text-[11px] font-bold text-muted">
              {i + 1}
            </span>

            <div className="w-24 flex-shrink-0">
              <label className="lbl">Pose</label>
              <Select
                value=""
                onChange={(v) => v !== '' && patch(r.key, { prompt: poses[Number(v)][1] })}
                options={poseOpts}
              />
            </div>

            <div className="w-24 flex-shrink-0">
              <label className="lbl">Framing</label>
              <Select
                value={r.framing ?? ''}
                onChange={(v) => patch(r.key, { framing: v })}
                options={sameOpt(FRAMINGS)}
              />
            </div>

            <div className="w-24 flex-shrink-0">
              <label className="lbl">Backdrop</label>
              <Select
                value={r.backdrop ?? ''}
                onChange={(v) => patch(r.key, { backdrop: v })}
                options={sameOpt(BACKDROPS)}
              />
            </div>

            <div className="w-24 flex-shrink-0">
              <label className="lbl">Mood</label>
              <Select
                value={r.mood ?? ''}
                onChange={(v) => patch(r.key, { mood: v })}
                options={sameOpt(MOODS)}
              />
            </div>

            <div className="w-24 flex-shrink-0">
              <label className="lbl">Lighting</label>
              <Select
                value={r.lighting ?? ''}
                onChange={(v) => patch(r.key, { lighting: v })}
                options={sameOpt(LIGHTINGS)}
              />
            </div>

            <div className="w-24 flex-shrink-0">
              <label className="lbl">Aspect</label>
              <Select
                value={r.aspect ?? ''}
                onChange={(v) => patch(r.key, { aspect: v })}
                options={sameOpt(ASPECTS)}
              />
            </div>

            <div className="w-24 flex-shrink-0">
              <label className="lbl">Resolution</label>
              <Select
                value={r.resolution ?? ''}
                onChange={(v) => patch(r.key, { resolution: v })}
                options={sameOpt(RESOLUTIONS.map(([v]) => v))}
              />
            </div>

            <div className="relative min-w-[180px] flex-1">
              <label className="lbl">Prompt · editable</label>
              <textarea
                value={r.prompt}
                onChange={(e) => patch(r.key, { prompt: e.target.value })}
                className="min-h-[42px]"
              />
              <GenieBox
                text={r.prompt}
                onUse={(improved) => patch(r.key, { prompt: improved })}
                onBalance={onBalance}
                geniePrice={geniePrice}
                compact
              />
            </div>

            <button
              onClick={() => setRows((prev) => prev.filter((x) => x.key !== r.key))}
              aria-label={`Remove row ${i + 1}`}
              className="mt-[22px] p-1.5 text-sm text-muted hover:text-brand"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2.5 p-[14px_16px]">
        <button
          onClick={() => setRows((prev) => [...prev, blankRow()])}
          className="rounded-lg bg-surface2 px-[14px] py-[9px] text-[12.5px] font-semibold text-ink"
        >
          + Add row
        </button>
        <div className="flex-1" />
        <button
          onClick={run}
          disabled={!rows.length}
          className="rounded-[11px] bg-brand px-5 py-[11px] text-[14.5px] font-bold text-white disabled:opacity-50"
        >
          Generate all
        </button>
      </div>
    </div>
  );
}