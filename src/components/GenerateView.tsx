'use client';

import { useState } from 'react';
import { del, ApiError } from '@/lib/client/api';
import { EmptyState, Skeleton } from './ui';
import ResultCard from './ResultCard';
import AddCard from './AddCard';
import GenieCard from './GenieCard';
import GenieDrawer from './GenieDrawer';
import BatchPanel from './BatchPanel';
import VideoModal from './VideoModal';
import { PersonPlusIcon, DownloadIcon, PlayIcon } from './icons';
import { useDialog } from './Dialog';
import type { ShootApi } from '@/lib/client/useShoot';
import type { LbItem, PoseSettings } from '@/lib/client/types';

interface Props {
  shoot: ShootApi;
  /** The shoot's category — decides which pose list the add/batch pickers show. */
  category: string;
  geniePrice: number;
  /** Credits for one 10-second video, from settings. */
  videoPrice: number;
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
  videoPrice,
  priceFor,
  onBalance,
  onZoom,
  onSaveAsModel,
}: Props) {
  const dialog = useDialog();
  const [batchMode, setBatchMode] = useState(false);
  const [genieOpen, setGenieOpen] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);

  const { pid, shootNo, cards, videos, pendingCount, resumedBanner } = shoot;
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
        {/* Before "Save as model" because it acts on the frames already on
            screen, where that one acts on the person inside them. */}
        <button
          onClick={() => setVideoOpen(true)}
          disabled={!pid || !cards.some((c) => c.img)}
          title="Turn these frames into a 10-second video"
          className="ml-auto inline-flex items-center gap-2 rounded-[9px] border border-line px-[15px] py-[9px] text-[13px] font-bold text-ink transition hover:-translate-y-px hover:border-ink disabled:opacity-50"
        >
          <PlayIcon /> Generate video
        </button>
        <button
          onClick={() => pid && onSaveAsModel(pid)}
          disabled={!pid}
          className="inline-flex items-center gap-2 rounded-[9px] border border-accent-soft bg-accent-soft px-[15px] py-[9px] text-[13px] font-bold text-accent transition hover:-translate-y-px hover:bg-accent hover:text-white disabled:opacity-50"
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

        {/* Clips sit in the same grid as the stills they were built from — a
            video of this shoot belongs with this shoot, not on a page of its
            own. Poster is the first frame it locked onto, so the card reads as
            part of the set before anything plays. */}
        {videos.map((v) => (
          <div
            key={v.file}
            className="w-[212px] overflow-hidden rounded-card border border-line bg-surface shadow-card transition hover:-translate-y-[3px] hover:shadow-pop"
          >
            {/* The same 212×4:5 footprint as a still, not the clip's own ratio.
                Sized by its ratio a 9:16 card runs half again as tall as its
                neighbours and a 16:9 card half as short, and the grid stops
                reading as one set. `object-contain` letterboxes into the shared
                box, so neither orientation is cropped to achieve it. */}
            <div className="relative aspect-[4/5] bg-black">
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video
                src={v.url}
                controls
                loop
                playsInline
                preload="metadata"
                className="absolute inset-0 h-full w-full object-contain"
              />
              <span className="pointer-events-none absolute left-2 top-2 rounded-[5px] bg-black/70 px-[7px] py-[3px] text-[9px] font-bold text-white">
                {v.aspect} · 10s
              </span>
            </div>
            {/* Deliberately the same footer as ResultCard, down to the padding
                and the bare icon. A boxed download button is ~12px taller than
                an inline one, which is enough on its own to leave these cards
                standing proud of the stills beside them. */}
            <div className="flex items-center justify-between gap-1.5 px-[11px] py-[9px]">
              <span className="truncate text-xs font-semibold" title={v.preset}>
                {v.preset}
              </span>
              <span className="flex flex-shrink-0 items-center gap-2 text-muted">
                <a
                  title="Download"
                  href={pid ? `/api/product/${pid}/file/${v.file}` : v.url}
                  download
                  className="hover:text-brand"
                >
                  <DownloadIcon />
                </a>
              </span>
            </div>
          </div>
        ))}

        {Array.from({ length: pendingCount }).map((_, i) => (
          <Skeleton key={`sk-${i}`} />
        ))}

        {pid && !batchMode && (
          <AddCard
            category={category}
            pid={shoot.pid}
            onAddOne={(pose, settings) => shoot.addOne(pose, settings, onBalance)}
            // Several ticked poses run through the batch endpoint — it already
            // generates one image per row, sequentially, which is what keeps
            // Gemini's rate limiter happy.
            onAddMany={(rows) => shoot.runBatch(rows, onBalance)}
            onStartBatch={() => setBatchMode(true)}
            onBalance={onBalance}
            geniePrice={geniePrice}
            priceFor={priceFor}
          />
        )}

        {pid && !batchMode && (
          <GenieCard open={genieOpen} onClick={() => setGenieOpen(true)} />
        )}
      </div>

      {/* The grid-level Genie has no pose card to fill, so everything it hands
          back generates straight away — a single direction through addOne, a
          catalogue through the batch. */}
      <GenieDrawer
        open={genieOpen}
        onClose={() => setGenieOpen(false)}
        pid={shoot.pid}
        selection={[]}
        geniePrice={geniePrice}
        priceFor={priceFor}
        onBalance={onBalance}
        onApply={(pose, settings) => shoot.addOne(pose, settings, onBalance)}
        onGenerate={(rows) => shoot.runBatch(rows, onBalance)}
      />

      {videoOpen && pid && (
        <VideoModal
          pid={pid}
          frames={cards
            .filter((c) => c.img && c.file)
            .map((c) => ({ file: c.file, url: c.img, label: c.pose }))}
          price={videoPrice}
          onClose={() => setVideoOpen(false)}
          onBalance={onBalance}
          onCreated={shoot.addVideo}
        />
      )}

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