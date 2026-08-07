'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { getJson, postForm, fmt, ApiError } from '@/lib/client/api';
import { TableWrap, Th, Td } from './ui';
import {
  ShieldCheckIcon,
  PauseIcon,
  PlayIcon,
  TrashIcon,
  ImagesIcon,
  PersonIcon,
} from './icons';
import { useDialog } from './Dialog';
import AdminPacks from './AdminPacks';
import type { AdminUser, Me } from '@/lib/client/types';

const MODES = ['imagine', 'saved'] as const;
const RES = ['1K', '2K', '4K'] as const;

type PriceGrid = Record<string, Record<string, string>>;

/** Admin: user management, the credits pricing grid and Genie pricing. */
export default function AdminView({
  me,
  onMe,
  onBalance,
}: {
  me: Me;
  onMe: (patch: Partial<Me>) => void;
  onBalance: (b: number) => void;
}) {
  const dialog = useDialog();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [topups, setTopups] = useState<Record<string, string>>({});
  const [prices, setPrices] = useState<PriceGrid>({ imagine: {}, saved: {} });
  const [geniePrice, setGeniePrice] = useState(String(me.genie?.price ?? 0));
  const [flash, setFlash] = useState('');

  const loadUsers = useCallback(async () => {
    try {
      const j = await getJson<{ users: AdminUser[] }>('/api/admin/users');
      setUsers(j.users ?? []);
    } catch {
      setUsers([]);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Seed the grid inputs from the settings /api/me already returned.
  useEffect(() => {
    const grid: PriceGrid = { imagine: {}, saved: {} };
    for (const m of MODES) {
      for (const r of RES) {
        const v = me.prices?.[m]?.[r];
        grid[m][r] = v == null ? '' : String(v);
      }
    }
    setPrices(grid);
    setGeniePrice(String(me.genie?.price ?? 0));
  }, [me.prices, me.genie]);

  async function act(fn: () => Promise<unknown>, failMsg: string) {
    try {
      await fn();
      await loadUsers();
    } catch (e) {
      await dialog.alert(e instanceof ApiError ? e.message : failMsg);
    }
  }

  async function topUp(uid: string) {
    const amt = Number(topups[uid] ?? 50);
    if (!amt) return;
    await act(async () => {
      await postForm('/api/admin/topup', { user_id: uid, images: amt });
      // The admin may have topped up their own account — refresh the header.
      const fresh = await getJson<Me>('/api/me');
      if (fresh.authed && typeof fresh.balance === 'number') onBalance(fresh.balance);
    }, 'Could not top up.');
  }

  async function removeUser(uid: string, email: string) {
    const ok = await dialog.confirm(
      `Delete the account "${email}"? The user is removed permanently and can no longer log in. ` +
        `Their existing shoots/images stay on disk.`,
      { title: 'Delete user' },
    );
    if (!ok) return;
    await act(() => postForm('/api/admin/user/delete', { user_id: uid }), 'Could not delete.');
  }

  async function saveSettings() {
    const payload: { imagine: Record<string, number>; saved: Record<string, number> } = {
      imagine: {},
      saved: {},
    };
    for (const m of MODES) {
      for (const r of RES) {
        const v = prices[m]?.[r];
        if (v !== '' && v !== undefined) payload[m][r] = Number(v);
      }
    }
    try {
      await postForm('/api/admin/settings', {
        genie_price: Number(geniePrice),
        prices: JSON.stringify(payload),
      });
      onMe({
        prices: payload,
        genie: { ...(me.genie ?? { free: 0, max: 5 }), price: Number(geniePrice) },
      });
      setFlash('Saved.');
      setTimeout(() => setFlash(''), 2500);
    } catch (e) {
      await dialog.alert(e instanceof ApiError ? e.message : 'Could not save settings.');
    }
  }

  const iconBtn =
    'flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface2 text-muted hover:bg-line hover:text-ink';

  return (
    <div className="animate-fade-up">
      <div className="mb-4 rounded-card border border-line bg-surface p-[22px] shadow-card">
        <h3 className="mb-[5px] text-[15px] font-bold">Users</h3>
        <p className="mb-4 text-[12.5px] leading-[1.5] text-muted">
          Everyone who signed up. Top up a user&apos;s balance, or grant / revoke admin.
        </p>

        <TableWrap>
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <Th>User ID</Th>
                <Th>Name</Th>
                <Th>Email</Th>
                <Th>Role</Th>
                <Th>Balance</Th>
                <Th>Top up</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-surface2">
                  <Td mono>
                    <span className="font-bold">{u.uid || '—'}</span>
                  </Td>
                  <Td>{u.name || '—'}</Td>
                  <Td mono>{u.email}</Td>
                  <Td>
                    {u.is_admin ? (
                      <span className="rounded-[20px] bg-[rgba(31,122,77,.12)] px-[9px] py-[3px] text-[10.5px] font-bold text-green">
                        Admin
                      </span>
                    ) : (
                      'User'
                    )}
                    {!u.active && (
                      <span className="ml-1 rounded-[5px] bg-amber-soft px-1.5 py-0.5 text-[9px] font-bold text-amber">
                        Paused
                      </span>
                    )}
                  </Td>
                  <Td mono>{fmt(u.balance)}</Td>
                  <Td>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        value={topups[u.id] ?? '50'}
                        onChange={(e) =>
                          setTopups((p) => ({ ...p, [u.id]: e.target.value }))
                        }
                        className="w-[70px]"
                      />
                      <button
                        onClick={() => topUp(u.id)}
                        className="rounded-[9px] bg-ink px-2.5 py-[7px] text-[13px] font-bold text-surface"
                      >
                        Add
                      </button>
                    </div>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-1.5">
                      <Link
                        title={`See everything ${u.uid || u.email} has generated`}
                        href={`/gallery?user=${encodeURIComponent(u.uid || u.id)}`}
                        className={iconBtn}
                      >
                        <ImagesIcon />
                      </Link>
                      <Link
                        title={`See the models ${u.uid || u.email} has saved`}
                        href={`/models?user=${encodeURIComponent(u.uid || u.id)}`}
                        className={iconBtn}
                      >
                        <PersonIcon />
                      </Link>
                      <button
                        title={u.is_admin ? 'Revoke admin' : 'Make admin'}
                        onClick={() =>
                          act(
                            () =>
                              postForm('/api/admin/user/role', {
                                user_id: u.id,
                                is_admin: u.is_admin ? 0 : 1,
                              }),
                            'Could not update role.',
                          )
                        }
                        className={`${iconBtn} ${
                          u.is_admin ? 'border-transparent bg-accent-soft text-accent' : ''
                        }`}
                      >
                        <ShieldCheckIcon />
                      </button>
                      <button
                        title={u.active ? 'Pause login' : 'Resume login'}
                        onClick={() =>
                          act(
                            () =>
                              postForm('/api/admin/user/active', {
                                user_id: u.id,
                                active: u.active ? 0 : 1,
                              }),
                            'Could not update.',
                          )
                        }
                        className={iconBtn}
                      >
                        {u.active ? <PauseIcon /> : <PlayIcon className="h-4 w-4" />}
                      </button>
                      <button
                        title="Delete user"
                        onClick={() => removeUser(u.id, u.email)}
                        className={`${iconBtn} hover:border-transparent hover:bg-brand hover:text-white`}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </Td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-[14px] py-6 text-center text-muted">
                    No users yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </TableWrap>
      </div>

      <AdminPacks />

      <div className="flex max-w-[880px] flex-wrap gap-[18px]">
        <div className="min-w-[300px] flex-1 rounded-card border border-line bg-surface p-[22px] shadow-card">
          <h3 className="mb-[5px] text-[15px] font-bold">Credits &amp; pricing</h3>
          <p className="mb-4 text-[12.5px] leading-[1.5] text-muted">
            Credits deducted per generated image, by shoot type and resolution.
          </p>

          <table className="my-2 w-full border-collapse">
            <thead>
              <tr>
                <th />
                {RES.map((r) => (
                  <th key={r} className="px-1.5 py-1 text-[11px] font-bold text-muted">
                    {r}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MODES.map((m) => (
                <tr key={m}>
                  <td className="whitespace-nowrap py-[5px] pr-1.5 text-[13px] font-semibold">
                    {m === 'imagine' ? 'Imagine a model' : 'Saved model'}
                  </td>
                  {RES.map((r) => (
                    <td key={r} className="px-1.5 py-[5px] text-center">
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        value={prices[m]?.[r] ?? ''}
                        onChange={(e) =>
                          setPrices((p) => ({ ...p, [m]: { ...p[m], [r]: e.target.value } }))
                        }
                        className="w-16 text-center"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          <button
            onClick={saveSettings}
            className="mt-3.5 rounded-[9px] bg-ink px-[18px] py-2.5 text-[13px] font-bold text-surface"
          >
            Save pricing
          </button>
          {flash && <div className="mt-2.5 text-[12.5px] font-semibold text-green">{flash}</div>}
        </div>

        <div className="min-w-[300px] flex-1 rounded-card border border-line bg-surface p-[22px] shadow-card">
          <h3 className="mb-[5px] text-[15px] font-bold">Prompt Genie</h3>
          <p className="mb-4 text-[12.5px] leading-[1.5] text-muted">
            Credits charged each time Genie improves a prompt.
          </p>

          <label className="lbl">Genie cost (cr per improvement)</label>
          <input
            type="number"
            step="0.5"
            min="0"
            value={geniePrice}
            onChange={(e) => setGeniePrice(e.target.value)}
          />

          <button
            onClick={saveSettings}
            className="mt-3.5 rounded-[9px] bg-ink px-[18px] py-2.5 text-[13px] font-bold text-surface"
          >
            Save Genie settings
          </button>
          {flash && <div className="mt-2.5 text-[12.5px] font-semibold text-green">{flash}</div>}
        </div>
      </div>
    </div>
  );
}