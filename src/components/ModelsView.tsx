'use client';

import { useCallback, useEffect, useState } from 'react';
import { getJson, bust, ethLabel, titleCase } from '@/lib/client/api';
import { EmptyState, SearchBox } from './ui';
import ModelFolderModal from './ModelFolderModal';
import type { SavedModel, LbItem } from '@/lib/client/types';

/** The "My Models" tab — the roster of reusable people. */
export default function ModelsView({
  onZoom,
  onBalance,
  refreshKey,
}: {
  onZoom: (items: LbItem[], index: number) => void;
  onBalance: (b: number) => void;
  /** Bumped by the parent after a model is saved, to force a reload. */
  refreshKey: number;
}) {
  const [models, setModels] = useState<SavedModel[]>([]);
  const [q, setQ] = useState('');
  const [openMid, setOpenMid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const j = await getJson<{ models: SavedModel[] }>('/api/models');
      setModels(j.models ?? []);
    } catch {
      setModels([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const list = models.filter(
    (m) => !q || (m.name ?? '').toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="animate-fade-up">
      <div className="mb-[22px] flex flex-wrap items-center gap-3">
        <SearchBox value={q} onChange={setQ} placeholder="Search models by name…" />
      </div>

      {!loading && models.length === 0 && (
        <EmptyState icon="👤" title="No saved models yet">
          Open a shoot and use “Save as model” to add one. Saved models live here.
        </EmptyState>
      )}

      <div className="flex flex-wrap gap-[18px]">
        {list.map((m) => {
          const tags = [
            ethLabel(m.tags?.ethnicity),
            titleCase(m.tags?.gender ?? ''),
            titleCase(m.tags?.vibe ?? ''),
          ]
            .filter((t) => t && t !== '—')
            .join(' · ');

          return (
            <div
              key={m.id}
              onClick={() => setOpenMid(m.id)}
              className="w-[230px] cursor-pointer overflow-hidden rounded-card border border-line bg-surface shadow-card transition hover:-translate-y-[3px] hover:shadow-pop"
            >
              <div className="relative aspect-[4/3] bg-surface2">
                <span className="absolute left-2 top-2 z-[2] rounded-[5px] bg-black/70 px-[7px] py-[3px] text-[9px] font-bold text-white">
                  {m.source === 'studio' ? 'Studio' : 'From shoot'}
                </span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={bust(m.thumb)} alt="" className="h-full w-full object-cover" />
                <span className="absolute bottom-2 right-2 rounded-md bg-accent/90 px-2 py-[3px] text-[9.5px] font-bold text-white">
                  {m.ref_count} ref{m.ref_count === 1 ? '' : 's'}
                </span>
              </div>
              <div className="p-3">
                <div className="truncate text-[13px] font-bold">{m.name}</div>
                <div className="mt-0.5 text-[11px] text-muted">{tags}</div>
              </div>
            </div>
          );
        })}
      </div>

      {openMid && (
        <ModelFolderModal
          mid={openMid}
          onClose={() => setOpenMid(null)}
          onZoom={onZoom}
          onBalance={onBalance}
          onChanged={load}
        />
      )}
    </div>
  );
}