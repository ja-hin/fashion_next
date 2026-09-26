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
import AdminLeads from './AdminLeads';
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
  const [specialPrices, setSpecialPrices] = useState<PriceGrid>({ imagine: {}, saved: {} });
  const [geniePrice, setGeniePrice] = useState(String(me.genie?.price ?? 0));
  const [videoPrice, setVideoPrice] = useState(String(me.video_price ?? 0));
  const [extractPrice, setExtractPrice] = useState(String(me.extract_price ?? 0));
  /* Flat, keyed "imagine.hero" / "extract" , one input, one key. Rebuilt into
     the nested shape on save, which keeps every onChange a one-liner. */
  const [engines, setEngines] = useState<Record<string, string>>({});
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
    const special: PriceGrid = { imagine: {}, saved: {} };
    for (const m of MODES) {
      for (const r of RES) {
        const v = me.prices?.[m]?.[r];
        grid[m][r] = v == null ? '' : String(v);
        // Falls back to the ordinary rate so the Special grid opens showing
        // what is actually being charged, not a row of blanks.
        const sv = me.special_prices?.[m]?.[r] ?? v;
        special[m][r] = sv == null ? '' : String(sv);
      }
    }
    setPrices(grid);
    setSpecialPrices(special);
    const e = me.engines;
    setEngines({
      'imagine.hero': e?.imagine?.hero ?? '',
      'imagine.pose': e?.imagine?.pose ?? '',
      'saved.hero': e?.saved?.hero ?? '',
      'saved.pose': e?.saved?.pose ?? '',
      'special_imagine.hero': e?.special_imagine?.hero ?? '',
      'special_imagine.pose': e?.special_imagine?.pose ?? '',
      'special_saved.hero': e?.special_saved?.hero ?? '',
      'special_saved.pose': e?.special_saved?.pose ?? '',
      extract: e?.extract ?? '',
    });
    setGeniePrice(String(me.genie?.price ?? 0));
    setVideoPrice(String(me.video_price ?? 0));
    setExtractPrice(String(me.extract_price ?? 0));
  }, [me.prices, me.special_prices, me.genie, me.video_price, me.extract_price, me.engines]);

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
      // The admin may have topped up their own account , refresh the header.
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
    /* Blank cells are left OUT of the payload entirely , the route reads a
       missing cell as "leave it alone". Sending '' would be a number the
       server has to guess at. */
    const numbers = (grid: PriceGrid) => {
      const out: { imagine: Record<string, number>; saved: Record<string, number> } = {
        imagine: {},
        saved: {},
      };
      for (const m of MODES) {
        for (const r of RES) {
          const v = grid[m]?.[r];
          if (v !== '' && v !== undefined) out[m][r] = Number(v);
        }
      }
      return out;
    };

    const payload = numbers(prices);
    const specialPayload = numbers(specialPrices);

    const pair = (k: string) => ({
      hero: engines[`${k}.hero`] ?? '',
      pose: engines[`${k}.pose`] ?? '',
    });
    const enginePayload = {
      imagine: pair('imagine'),
      saved: pair('saved'),
      special_imagine: pair('special_imagine'),
      special_saved: pair('special_saved'),
      extract: engines.extract ?? '',
    };
    try {
      await postForm('/api/admin/settings', {
        genie_price: Number(geniePrice),
        video_price: videoPrice,
        extract_price: extractPrice,
        prices: JSON.stringify(payload),
        special_prices: JSON.stringify(specialPayload),
        engines: JSON.stringify(enginePayload),
      });
      onMe({
        prices: payload,
        special_prices: specialPayload,
        engines: enginePayload,
        genie: { ...(me.genie ?? { free: 0, max: 5 }), price: Number(geniePrice) },
        video_price: Number(videoPrice),
        extract_price: Number(extractPrice),
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
                    <span className="font-bold">{u.uid || ','}</span>
                  </Td>
                  <Td>{u.name || ','}</Td>
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

      <AdminLeads />

      <AdminPacks />

      {/* Engines before pricing: which model runs a job decides what it costs
          us and how good it is, so it is the first thing an owner tunes. */}
      <div className="mb-[18px] max-w-[880px] rounded-card border border-line bg-surface p-[22px] shadow-card">
        <h3 className="mb-[5px] text-[15px] font-bold">AI engines</h3>
        <p className="mb-4 text-[12.5px] leading-[1.5] text-muted">
          Which model runs each job. The hero is the frame that locks the model, lighting
          and background , the poses after it are generated from that hero, which is why
          they can run on a lighter engine. Leave a box empty to use the default shown in
          it, so an empty form changes nothing. Ids are typed rather than picked from a
          list because Google renames these; a wrong id fails the generation and shows up
          in Logs.
        </p>

        <table className="my-2 w-full border-collapse">
          <thead>
            <tr>
              <th />
              <th className="px-1.5 py-1 text-left text-[11px] font-bold text-muted">
                Hero frame
              </th>
              <th className="px-1.5 py-1 text-left text-[11px] font-bold text-muted">
                Extra poses
              </th>
            </tr>
          </thead>
          <tbody>
            {(
              [
                ['imagine', 'Generate , Imagine a model', 'hero'],
                ['saved', 'Generate , Saved model', 'hero'],
                ['special_imagine', 'Special Category , Imagine', 'hero'],
                // This one falls back to the pro engine, not the ordinary hero
                // engine , both flash engines refuse it. See gen.ts heroDefault.
                ['special_saved', 'Special Category , Saved model', 'pro'],
              ] as const
            ).map(([key, label, heroFallback]) => (
              <tr key={key}>
                <td className="whitespace-nowrap py-[5px] pr-2.5 text-[12.5px] font-semibold">
                  {label}
                </td>
                {(['hero', 'pose'] as const).map((slot) => (
                  <td key={slot} className="px-1.5 py-[5px]">
                    <input
                      type="text"
                      list="engine-ids"
                      spellCheck={false}
                      placeholder={
                        slot === 'hero'
                          ? ((heroFallback === 'pro'
                              ? me.engine_defaults?.fashn_ready
                                ? me.engine_defaults?.fashn
                                : me.engine_defaults?.pro
                              : me.engine_defaults?.hero) ?? 'server default')
                          : (me.engine_defaults?.base ?? 'server default')
                      }
                      value={engines[`${key}.${slot}`] ?? ''}
                      onChange={(ev) =>
                        setEngines((g) => ({ ...g, [`${key}.${slot}`]: ev.target.value }))
                      }
                      className="w-full min-w-[190px]"
                    />
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <td className="whitespace-nowrap py-[5px] pr-2.5 text-[12.5px] font-semibold">
                Garment extraction
              </td>
              {/* One call, no hero/pose split , spans both columns rather than
                  leaving an empty box that looks like something to fill in. */}
              <td className="px-1.5 py-[5px]" colSpan={2}>
                <input
                  type="text"
                  list="engine-ids"
                  spellCheck={false}
                  placeholder={me.engine_defaults?.base ?? 'server default'}
                  value={engines.extract ?? ''}
                  onChange={(ev) => setEngines((g) => ({ ...g, extract: ev.target.value }))}
                  className="w-full"
                />
              </td>
            </tr>
          </tbody>
        </table>

        {/* Suggestions, not a whitelist , the field still takes anything. */}
        <datalist id="engine-ids">
          {[
            me.engine_defaults?.base,
            me.engine_defaults?.hero,
            me.engine_defaults?.pro,
            me.engine_defaults?.fashn_ready ? me.engine_defaults?.fashn : undefined,
          ]
            .filter((v): v is string => !!v)
            .map((v) => (
              <option key={v} value={v} />
            ))}
        </datalist>

        {/* The one non-Gemini value these boxes take. Said here rather than
            left to be discovered, because "fashn" looks like a typo next to a
            row of model ids. */}
        <p className="mt-3 rounded-card border border-line bg-surface2 px-3 py-2 text-[11.5px] leading-[1.5] text-muted">
          <b className="text-ink">Type <code>fashn</code></b> in any box to send that job to
          FASHN instead of Gemini , a fashion-specific API that takes the saved model&apos;s
          face as a real input, which is why it is the only path that keeps a saved model
          recognisable on intimate apparel.{' '}
          {me.engine_defaults?.fashn_ready ? (
            <>
              A key is configured, so <b className="text-ink">Special Category , Saved
              model</b> already uses it when its box is left empty.
            </>
          ) : (
            <>
              No <code>FASHN_API_KEY</code> is set, so this does nothing yet , add one to
              the server environment first.
            </>
          )}
        </p>

        <p className="mt-3 text-[11.5px] leading-[1.45] text-muted">
          The lite engines only render 1K. A shoot set to 2K or 4K normally upgrades itself
          to the heavier one , naming an engine here turns that off, so pick one that can
          produce the sizes you sell. Today&apos;s defaults do this split already: the hero
          on <span className="font-semibold">{me.engine_defaults?.hero ?? ','}</span>, poses
          on <span className="font-semibold">{me.engine_defaults?.base ?? ','}</span>.
        </p>

        <button
          onClick={saveSettings}
          className="mt-3.5 rounded-[9px] bg-ink px-[18px] py-2.5 text-[13px] font-bold text-surface"
        >
          Save engines
        </button>
        {flash && <div className="mt-2.5 text-[12.5px] font-semibold text-green">{flash}</div>}
      </div>

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

        <div className="min-w-[300px] flex-1 rounded-card border border-line bg-surface p-[22px] shadow-card">
          <h3 className="mb-[5px] text-[15px] font-bold">Video</h3>
          <p className="mb-4 text-[12.5px] leading-[1.5] text-muted">
            Credits charged for one 10-second video. Shown on the Generate button and charged
            only if the clip comes back.
          </p>

          <label className="lbl">Video cost (cr per clip)</label>
          <input
            type="number"
            step="1"
            min="0"
            value={videoPrice}
            onChange={(e) => setVideoPrice(e.target.value)}
          />

          <button
            onClick={saveSettings}
            className="mt-3.5 rounded-[9px] bg-ink px-[18px] py-2.5 text-[13px] font-bold text-surface"
          >
            Save video settings
          </button>
          {flash && <div className="mt-2.5 text-[12.5px] font-semibold text-green">{flash}</div>}
        </div>

        {/* One card, because these are one question , what the Special Category
            desk costs. Splitting the per-image rate from the extraction rate
            meant an admin pricing that desk had to find two boxes in two
            places and remember both were involved. */}
        <div className="min-w-[300px] flex-1 rounded-card border border-line bg-surface p-[22px] shadow-card">
          <h3 className="mb-[5px] flex items-center gap-2 text-[15px] font-bold">
            Special Category
            <span className="rounded-full border border-brand/40 px-1.5 py-[1px] text-[8px] font-bold uppercase tracking-[0.06em] text-brand">
              beta
            </span>
          </h3>
          <p className="mb-4 text-[12.5px] leading-[1.5] text-muted">
            Pricing for the Special Category desk , intimate apparel and anything else
            detection routes off the ordinary shoot path. These rates replace the ones
            above for those shoots only.
          </p>

          <label className="lbl">Credits per image</label>
          <table className="mb-3 mt-1 w-full border-collapse">
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
                        value={specialPrices[m]?.[r] ?? ''}
                        onChange={(e) =>
                          setSpecialPrices((p) => ({ ...p, [m]: { ...p[m], [r]: e.target.value } }))
                        }
                        className="w-16 text-center"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {/* Worth saying, or the row reads as a rate that is quietly in use. */}
          <p className="mb-4 text-[11.5px] leading-[1.45] text-muted">
            Saved models are disabled on that desk for now, so the second row is set up
            ready rather than in use.
          </p>

          <label className="lbl">Garment extraction (cr per photo)</label>
          <input
            type="number"
            step="1"
            min="0"
            value={extractPrice}
            onChange={(e) => setExtractPrice(e.target.value)}
          />
          <p className="mt-1.5 text-[11.5px] leading-[1.45] text-muted">
            Charged when a customer asks us to pull the garment out of a photo of someone
            wearing it. Per photo, not per garment , every piece in one photo comes back in
            a single packshot from one generation. Charged only for photos that come back.
          </p>

          <button
            onClick={saveSettings}
            className="mt-3.5 rounded-[9px] bg-ink px-[18px] py-2.5 text-[13px] font-bold text-surface"
          >
            Save Special Category
          </button>
          {flash && <div className="mt-2.5 text-[12.5px] font-semibold text-green">{flash}</div>}
        </div>
      </div>
    </div>
  );
}