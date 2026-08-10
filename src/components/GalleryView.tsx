'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getJson, postForm, del, ApiError, imgSrc } from '@/lib/client/api';
import { EmptyState, SearchBox } from './ui';
import { TrashIcon, DownloadIcon } from './icons';
import { useDialog } from './Dialog';
import FolderModal from './FolderModal';
import type { GalleryGroup, LbItem } from '@/lib/client/types';

interface Props {
  onContinueShoot: (pid: string) => void;
  onSaveAsModel: (pid: string) => void;
  onZoom: (items: LbItem[], index: number) => void;
}

/** Every shoot with at least one image, grouped by date. */
export default function GalleryView({ onContinueShoot, onSaveAsModel, onZoom }: Props) {
  const dialog = useDialog();
  const router = useRouter();
  // Admins arrive here from the users table as /gallery?user=U0007. The server
  // ignores this for non-admins, so it can't be used to peek at someone else.
  const userFilter = useSearchParams().get('user') ?? '';

  const [q, setQ] = useState('');
  const [groups, setGroups] = useState<GalleryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [openPid, setOpenPid] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [viewing, setViewing] = useState<{ uid: string; email: string } | null>(null);

  const load = useCallback(async (query: string, user: string) => {
    try {
      const j = await getJson<{
        groups: GalleryGroup[];
        is_admin?: boolean;
        filtered_user?: { uid: string; email: string } | null;
      }>(
        `/api/gallery?q=${encodeURIComponent(query)}&user=${encodeURIComponent(user)}`,
      );
      setGroups(j.groups ?? []);
      setIsAdmin(!!j.is_admin);
      setViewing(j.filtered_user ?? null);
    } catch {
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced so typing in the search box doesn't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => load(q, userFilter), 200);
    return () => clearTimeout(t);
  }, [q, userFilter, load]);

  async function rename(pid: string, current: string) {
    const name = await dialog.prompt(
      'Rename this shoot (used as the download file name):',
      current,
      { title: 'Rename shoot' },
    );
    if (name === null) return;
    await postForm(`/api/product/${pid}/rename`, { name });
    load(q, userFilter);
  }

  async function remove(pid: string, title: string) {
    const ok = await dialog.confirm(
      `Delete the shoot "${title}"? All of its images will be permanently removed from the gallery, ` +
        `disk and ZIP. This cannot be undone.`,
      { title: 'Delete shoot' },
    );
    if (!ok) return;
    try {
      await del(`/api/product/${pid}`);
      load(q, userFilter);
    } catch (e) {
      await dialog.alert(
        e instanceof ApiError ? e.message : 'Could not delete this shoot. Please try again.',
        'Delete failed',
      );
    }
  }

  const isEmpty = !loading && groups.length === 0;

  return (
    <div className="animate-fade-up">
      <div className="mb-[22px] flex flex-wrap items-center gap-3">
        <SearchBox
          value={q}
          onChange={setQ}
          placeholder={
            isAdmin
              ? 'Search by name, no., category, pose, user ID or email…'
              : 'Search shoots by name, no., category, pose…'
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
            onClick={() => router.push('/gallery')}
            className="rounded-lg bg-surface px-2.5 py-1.5 text-[11.5px] font-bold text-ink"
          >
            Show all users
          </button>
        </div>
      )}

      {isEmpty && (
        <EmptyState icon="🖼" title={userFilter ? 'Nothing from this user' : 'No shoots yet'}>
          {userFilter
            ? 'This account has not generated any shoots yet.'
            : 'Your generated shoots will be collected here as folders.'}
        </EmptyState>
      )}

      {groups.map((g) => (
        <div key={g.date}>
          <div className="mb-[14px] mt-[22px] flex items-center gap-3 text-[15px] font-bold after:h-px after:flex-1 after:bg-line after:content-['']">
            {g.date}
          </div>

          <div className="flex flex-wrap gap-[18px]">
            {g.items.map((it) => (
              <div
                key={it.pid}
                className="w-[230px] overflow-hidden rounded-card border border-line bg-surface shadow-card transition hover:-translate-y-[3px] hover:shadow-pop"
              >
                <div
                  className="relative aspect-[4/3] cursor-pointer bg-surface2"
                  onClick={() => setOpenPid(it.pid)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imgSrc(it.thumb, 'thumb')} alt="" className="h-full w-full object-cover" />
                  <div className="absolute bottom-2 right-2 rounded-md bg-black/70 px-2 py-[3px] text-[10px] font-bold text-white">
                    {it.count} image{it.count === 1 ? '' : 's'}
                  </div>

                  {/* Only admins receive owner data, so this can't leak. */}
                  {it.owner_uid && (
                    <button
                      title={`Show only ${it.owner_email}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/gallery?user=${encodeURIComponent(it.owner_uid!)}`);
                      }}
                      className="absolute left-2 top-2 rounded-md bg-black/70 px-2 py-[3px] text-[10px] font-bold text-white hover:bg-black"
                    >
                      {it.owner_uid}
                    </button>
                  )}
                  <button
                    title="Delete shoot"
                    onClick={(e) => {
                      e.stopPropagation();
                      remove(it.pid, it.title);
                    }}
                    className="absolute right-2 top-2 z-[2] flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-black/70 text-white hover:bg-brand"
                  >
                    <TrashIcon />
                  </button>
                </div>

                <div className="p-3">
                  <div className="flex items-center gap-1.5 text-[13px] font-bold">
                    <span className="truncate">{it.title}</span>
                    <button
                      title="Rename"
                      onClick={() => rename(it.pid, it.title)}
                      className="text-xs text-muted hover:text-brand"
                    >
                      ✎
                    </button>
                  </div>
                  {/* Skip the shoot number when it's already the title — an
                      unnamed shoot would otherwise read "S0292 / S0292 · …". */}
                  <div className="mt-0.5 text-[11px] capitalize text-muted">
                    {[it.title === it.shoot ? null : it.shoot, it.category, it.model]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                  <div className="mt-2.5 flex gap-2">
                    <button
                      onClick={() => setOpenPid(it.pid)}
                      className="flex-1 rounded-lg bg-ink p-[7px] text-[11.5px] font-bold text-surface"
                    >
                      Open
                    </button>
                    <a
                      title="Download ZIP"
                      href={`/api/product/${it.pid}/zip`}
                      className="flex w-10 items-center justify-center rounded-lg border border-line bg-surface2 text-ink"
                    >
                      <DownloadIcon />
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {openPid && (
        <FolderModal
          pid={openPid}
          onClose={() => setOpenPid(null)}
          onZoom={onZoom}
          onContinue={(pid) => {
            setOpenPid(null);
            onContinueShoot(pid);
          }}
          onSaveAsModel={(pid) => {
            setOpenPid(null);
            onSaveAsModel(pid);
          }}
          onChanged={() => load(q, userFilter)}
        />
      )}
    </div>
  );
}