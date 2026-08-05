'use client';

import { useState } from 'react';
import { del, ApiError } from '@/lib/client/api';
import { EmptyState, Skeleton } from './ui';
import ResultCard from './ResultCard';
import AddCard from './AddCard';
import BatchPanel from './BatchPanel';
import { PersonPlusIcon, DownloadIcon } from './icons';
import { useDialog } from './Dialog';
import type { ShootApi } from '@/lib/client/useShoot';
import type { LbItem, PoseSettings } from '@/lib/client/types';

interface Props {
  shoot: ShootApi;
  /** The shoot's category — decides which pose list the add/batch pickers show. */
  category: string;
  geniePrice: number;
  priceFor: (resolution: string) => number;
  onBalance: (b: number) => void;
  onZoom: (items: LbItem[], index: number) => void;
  onSaveAsModel: (pid: string) => void;
}

/** The Generate tab: results grid, add card and batch planner. */
export default function GenerateView({
  shoot,
  category,
  geniePrice,
  priceFor,
  onBalance,
  onZoom,
  onSaveAsModel,
}: Props) {
  const dialog = useDialog();
  const [batchMode, setBatchMode] = useState(false);

  const { pid, shootNo, cards, pendingCount, resumedBanner } = shoot;
  const hasResults = cards.length > 0 || pendingCount > 0;

  if (!hasResults) {
    return (
      <EmptyState icon="👗" title="Your shoot will appear here">
        Upload a garment and generate the front shot. Then build the rest — pose by pose, or in a
        batch.
      </EmptyState>
    );
  }

  const lbItems: LbItem[] = cards
    .filter((c) => c.img)
    .map((c) => ({
      url: c.img,
      dl: pid ? `/api/product/${pid}/file/${c.file}` : c.img,
      name: c.file,
      pose: c.pose,
    }));

  async function deleteImage(file: string) {
    if (
      !(await dialog.confirm(
        'Delete this image? It will be removed from the shoot, the gallery and the ZIP.',
        { title: 'Delete image' },
      ))
    )
      return;

    try {
      await del(`/api/product/${pid}/image/${encodeURIComponent(file)}`);
      shoot.removeCard(file);
    } catch (e) {
      await dialog.alert(
        e instanceof ApiError ? e.message : 'Could not delete this image.',
      );
    }
  }

  const retry = (pose: string, settings: PoseSettings) =>
    shoot.addOne(pose, settings, onBalance);

  return (
    <div className="animate-fade-up">
      <div className="mb-5 flex items-center gap-[14px]">
        <h2 className="text-[23px] font-bold tracking-[-0.01em]">Results</h2>
        {shootNo && (
          <span className="rounded-[20px] bg-surface2 px-2.5 py-1 text-xs font-semibold text-muted">
            Shoot {shootNo} · locked
          </span>
        )}
        <button
          onClick={() => pid && onSaveAsModel(pid)}
          disabled={!pid}
          className="ml-auto inline-flex items-center gap-2 rounded-[9px] border border-accent-soft bg-accent-soft px-[15px] py-[9px] text-[13px] font-bold text-accent transition hover:-translate-y-px hover:bg-accent hover:text-white disabled:opacity-50"
        >
          <PersonPlusIcon /> Save as model
        </button>
        <a
          href={pid ? `/api/product/${pid}/zip` : '#'}
          className="inline-flex items-center gap-[7px] rounded-[9px] bg-ink px-4 py-2.5 text-[13px] font-bold text-surface"
        >
          <DownloadIcon /> Download all
        </a>
      </div>

      {resumedBanner && (
        <div className="mb-4 flex items-center gap-2.5 rounded-[11px] border border-line border-l-[3px] border-l-brand bg-surface2 p-[11px_14px] text-[13px] shadow-card">
          <span className="flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-[7px] bg-brand-soft text-xs text-brand">
            ▶
          </span>
          <span>
            Resumed — <b>{resumedBanner.title}</b> · {resumedBanner.count} image
            {resumedBanner.count === 1 ? '' : 's'} restored · keep generating below
          </span>
          <button
            onClick={shoot.dismissBanner}
            aria-label="Dismiss"
            className="ml-auto text-muted hover:text-ink"
          >
            ×
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-start gap-4">
        {cards.map((c, i) => (
          <ResultCard
            key={`${c.file || 'err'}-${i}`}
            card={c}
            pid={pid}
            onZoom={() => {
              const idx = lbItems.findIndex((it) => it.url === c.img);
              onZoom(lbItems, idx < 0 ? 0 : idx);
            }}
            onRetry={() => retry(c.pose, c.settings)}
            onDelete={c.isHero || !c.file ? undefined : () => deleteImage(c.file)}
          />
        ))}

        {Array.from({ length: pendingCount }).map((_, i) => (
          <Skeleton key={`sk-${i}`} />
        ))}

        {pid && !batchMode && (
          <AddCard
            category={category}
            onAddOne={(pose, settings) => shoot.addOne(pose, settings, onBalance)}
            onStartBatch={() => setBatchMode(true)}
            onBalance={onBalance}
            geniePrice={geniePrice}
            costPerImage={priceFor('')}
          />
        )}
      </div>

      {pid && batchMode && (
        <BatchPanel
          category={category}
          onRun={(rows) => shoot.runBatch(rows, onBalance)}
          onClose={() => setBatchMode(false)}
          onBalance={onBalance}
          geniePrice={geniePrice}
          priceFor={priceFor}
        />
      )}
    </div>
  );
}