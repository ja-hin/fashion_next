'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
  const router = useRouter();
  // Admins arrive from the users table as /models?user=U0007. The server
  // ignores this for non-admins, so it can't be used to peek at someone else.
  const userFilter = useSearchParams().get('user') ?? '';

  const [models, setModels] = useState<SavedModel[]>([]);
  const [q, setQ] = useState('');
  const [openMid, setOpenMid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [viewing, setViewing] = useState<{ uid: string; email: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const j = await getJson<{
        models: SavedModel[];
        is_admin?: boolean;
        filtered_user?: { uid: string; email: string } | null;
      }>(`/api/models?user=${encodeURIComponent(userFilter)}`);
      setModels(j.models ?? []);
      setIsAdmin(!!j.is_admin);
      setViewing(j.filtered_user ?? null);
    } catch {
      setModels([]);
    } finally {
      setLoading(false);
    }
  }, [userFilter]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  // Admins can also search by who made it; a regular user only has their own.
  const needle = q.toLowerCase();
  const list = models.filter(
    (m) =>
      !needle ||
      (m.name ?? '').toLowerCase().includes(needle) ||
      (m.owner_uid ?? '').toLowerCase().includes(needle) ||
      (m.owner_email ?? '').toLowerCase().includes(needle),
  );

  return (
    <div className="animate-fade-up">
      <div className="mb-[22px] flex flex-wrap items-center gap-3">
        <SearchBox
          value={q}
          onChange={setQ}
          placeholder={
            isAdmin ? 'Search models by name, user ID or email…' : 'Search models by name…'
          }
        />
      </div>

      {/* Admin only — a regular user never has a filter to be told about. */}
      {isAdmin && userFilter && (
        <div className="mb-[18px] flex flex-wrap items-center gap-2.5 rounded-card border border-accent-soft bg-accent-soft px-3.5 py-2.5 text-[12.5px]">
          {viewing ? (
            <>
              <span className="font-bold text-accent">{viewing.uid || '—'}</span>
              <span className="text-muted">{viewing.email}</span>
            </>
          ) : (
            <span className="font-semibold text-brand">
              No account matches &ldquo;{userFilter}&rdquo;.
            </span>
          )}
          <div className="flex-1" />
          <button
            onClick={() => router.push('/models')}
            className="rounded-lg bg-surface px-2.5 py-1.5 text-[11.5px] font-bold text-ink"
          >
            Show all users
          </button>
        </div>
      )}

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

                {/* Only admins receive owner data, so this can't leak. */}
                {m.owner_uid && (
                  <button
                    title={`Show only models created by ${m.owner_email}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/models?user=${encodeURIComponent(m.owner_uid!)}`);
                    }}
                    className="absolute right-2 top-2 z-[2] rounded-[5px] bg-black/70 px-[7px] py-[3px] text-[9px] font-bold text-white hover:bg-black"
                  >
                    {m.owner_uid}
                  </button>
                )}

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