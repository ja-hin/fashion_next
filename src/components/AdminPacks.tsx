'use client';

import { useEffect, useState } from 'react';
import { getJson, postForm, ApiError } from '@/lib/client/api';
import { useDialog } from './Dialog';
import { TrashIcon } from './icons';
import {
  rupees,
  packCredits,
  savingsPct,
  type BillingConfig,
  type Pack,
} from '@/lib/pricing';

/** Editing happens on strings so a half-typed number doesn't snap to 0. */
interface Row {
  key: number;
  id: string;
  name: string;
  credits: string;
  bonus: string;
  /** Rupees in the input; converted to paise on save. */
  rupees: string;
  blurb: string;
  active: boolean;
  popular: boolean;
}

let nextKey = 1;
const toRow = (p: Pack): Row => ({
  key: nextKey++,
  id: p.id,
  name: p.name,
  credits: String(p.credits),
  bonus: String(p.bonus),
  rupees: String(p.paise / 100),
  blurb: p.blurb,
  active: p.active,
  popular: p.popular,
});

const blankRow = (): Row => ({
  key: nextKey++,
  id: '',
  name: '',
  credits: '100',
  bonus: '0',
  rupees: '500',
  blurb: '',
  active: true,
  popular: false,
});

/** Admin: the top-up packs and rates customers see on Recharge and /pricing. */
export default function AdminPacks() {
  const dialog = useDialog();
  const [cfg, setCfg] = useState<BillingConfig | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [perCredit, setPerCredit] = useState('5');
  const [gstPct, setGstPct] = useState('18');
  const [customOn, setCustomOn] = useState(true);
  const [min, setMin] = useState('20');
  const [max, setMax] = useState('10000');
  const [flash, setFlash] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getJson<BillingConfig>('/api/admin/billing')
      .then((c) => {
        setCfg(c);
        setRows(c.packs.map(toRow));
        setPerCredit(String(c.paise_per_credit / 100));
        setGstPct(String(Math.round(c.gst_rate * 100)));
        setCustomOn(c.custom_enabled);
        setMin(String(c.custom_min_credits));
        setMax(String(c.custom_max_credits));
      })
      .catch(() => setCfg(null));
  }, []);

  const patch = (key: number, p: Partial<Row>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...p } : r)));

  /** Only one pack may carry the ribbon, so selecting one clears the rest. */
  const setPopular = (key: number) =>
    setRows((prev) => prev.map((r) => ({ ...r, popular: r.key === key })));

  async function save() {
    if (busy) return;

    const packs = rows.map((r) => ({
      id: r.id,
      name: r.name.trim(),
      credits: Number(r.credits),
      bonus: Number(r.bonus || 0),
      paise: Math.round(Number(r.rupees) * 100),
      blurb: r.blurb.trim(),
      active: r.active,
      popular: r.popular,
    }));

    const broken = packs.find((p) => !p.name || !(p.credits > 0) || !(p.paise > 0));
    if (broken) {
      await dialog.alert(
        `"${broken.name || 'Unnamed pack'}" needs a name, at least 1 credit and a price above zero.`,
      );
      return;
    }
    if (Number(min) > Number(max)) {
      await dialog.alert('Minimum credits cannot be greater than the maximum.');
      return;
    }

    setBusy(true);
    try {
      const j = await postForm<{ billing: BillingConfig }>('/api/admin/billing', {
        packs: JSON.stringify(packs),
        paise_per_credit: Math.round(Number(perCredit) * 100),
        gst_percent: Number(gstPct),
        custom_enabled: customOn ? 1 : 0,
        custom_min_credits: Number(min),
        custom_max_credits: Number(max),
      });
      // Re-seed from the server's sanitised copy so the editor shows exactly
      // what customers will now be charged, not what was typed.
      setCfg(j.billing);
      setRows(j.billing.packs.map(toRow));
      setFlash('Saved — live on the pricing page and Recharge.');
      setTimeout(() => setFlash(''), 3000);
    } catch (e) {
      await dialog.alert(e instanceof ApiError ? e.message : 'Could not save pricing.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(key: number, name: string) {
    const ok = await dialog.confirm(
      `Remove the "${name || 'unnamed'}" pack? Past purchases and their invoices are unaffected.`,
      { title: 'Remove pack' },
    );
    if (ok) setRows((prev) => prev.filter((r) => r.key !== key));
  }

  if (!cfg) {
    return (
      <div className="rounded-card border border-line bg-surface p-[22px] shadow-card">
        <h3 className="text-[15px] font-bold">Top-up packs</h3>
        <p className="mt-2 text-[12.5px] text-muted">Loading…</p>
      </div>
    );
  }

  const rate = Math.round(Number(perCredit) * 100) || 1;

  return (
    <div className="mb-4 rounded-card border border-line bg-surface p-[22px] shadow-card">
      <h3 className="mb-[5px] text-[15px] font-bold">Top-up packs &amp; pricing</h3>
      <p className="mb-4 text-[12.5px] leading-[1.5] text-muted">
        What customers see on the public pricing page and the Recharge screen. Prices are
        GST-inclusive — the amount here is exactly what gets charged.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[12.5px]">
          <thead>
            <tr className="text-[10.5px] uppercase tracking-[0.06em] text-muted">
              <th className="p-[8px_10px] text-left font-bold">Name</th>
              <th className="p-[8px_10px] text-right font-bold">Credits</th>
              <th className="p-[8px_10px] text-right font-bold">Bonus</th>
              <th className="p-[8px_10px] text-right font-bold">Price ₹</th>
              <th className="p-[8px_10px] text-left font-bold">Tagline</th>
              <th className="p-[8px_10px] text-right font-bold">Gets</th>
              <th className="p-[8px_10px] text-center font-bold">Live</th>
              <th className="p-[8px_10px] text-center font-bold">Popular</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const paise = Math.round(Number(r.rupees) * 100);
              const total = Number(r.credits || 0) + Number(r.bonus || 0);
              const save = savingsPct(
                {
                  id: r.id,
                  name: r.name,
                  credits: Number(r.credits || 0),
                  bonus: Number(r.bonus || 0),
                  paise,
                  blurb: '',
                  active: true,
                  popular: false,
                },
                { ...cfg, paise_per_credit: rate },
              );
              return (
                <tr key={r.key} className="border-t border-line align-middle">
                  <td className="p-[7px_10px]">
                    <input
                      value={r.name}
                      placeholder="Studio"
                      onChange={(e) => patch(r.key, { name: e.target.value })}
                      className="w-[110px]"
                    />
                  </td>
                  <td className="p-[7px_10px]">
                    <input
                      type="number"
                      min={1}
                      value={r.credits}
                      onChange={(e) => patch(r.key, { credits: e.target.value })}
                      className="w-[80px] text-right"
                    />
                  </td>
                  <td className="p-[7px_10px]">
                    <input
                      type="number"
                      min={0}
                      value={r.bonus}
                      onChange={(e) => patch(r.key, { bonus: e.target.value })}
                      className="w-[72px] text-right"
                    />
                  </td>
                  <td className="p-[7px_10px]">
                    <input
                      type="number"
                      min={1}
                      step="1"
                      value={r.rupees}
                      onChange={(e) => patch(r.key, { rupees: e.target.value })}
                      className="w-[90px] text-right"
                    />
                  </td>
                  <td className="p-[7px_10px]">
                    <input
                      value={r.blurb}
                      placeholder="+10% bonus credits"
                      onChange={(e) => patch(r.key, { blurb: e.target.value })}
                      className="w-[150px]"
                    />
                  </td>
                  <td className="whitespace-nowrap p-[7px_10px] text-right">
                    <b>{total}</b> cr
                    <div className="text-[10px] text-muted">
                      {total > 0 ? rupees(Math.round(paise / total)) : '—'}/cr
                      {save > 0 && <span className="ml-1 text-green">save {save}%</span>}
                    </div>
                  </td>
                  <td className="p-[7px_10px] text-center">
                    <input
                      type="checkbox"
                      checked={r.active}
                      onChange={(e) => patch(r.key, { active: e.target.checked })}
                      aria-label={`${r.name} live`}
                    />
                  </td>
                  <td className="p-[7px_10px] text-center">
                    <input
                      type="radio"
                      name="popular-pack"
                      checked={r.popular}
                      onChange={() => setPopular(r.key)}
                      aria-label={`${r.name} popular`}
                    />
                  </td>
                  <td className="p-[7px_10px] text-right">
                    <button
                      onClick={() => remove(r.key, r.name)}
                      aria-label={`Remove ${r.name}`}
                      className="p-1.5 text-muted hover:text-brand"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-[10px] py-5 text-center text-muted">
                  No packs. Customers will only see the custom amount option.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <button
        onClick={() => setRows((p) => [...p, blankRow()])}
        className="mt-2.5 rounded-lg bg-surface2 px-[14px] py-[9px] text-[12.5px] font-semibold text-ink hover:bg-line"
      >
        + Add pack
      </button>

      <div className="mt-5 border-t border-line pt-4">
        <h4 className="mb-3 text-[13px] font-bold">Custom amount &amp; rates</h4>
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="lbl">Rate (₹ per credit)</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={perCredit}
              onChange={(e) => setPerCredit(e.target.value)}
              className="w-[110px]"
            />
            <div className="mt-1 text-[10.5px] text-muted">Used for custom top-ups</div>
          </div>
          <div>
            <label className="lbl">GST %</label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={gstPct}
              onChange={(e) => setGstPct(e.target.value)}
              className="w-[90px]"
            />
            <div className="mt-1 text-[10.5px] text-muted">0 = no tax lines</div>
          </div>
          <div>
            <label className="lbl">Min credits</label>
            <input
              type="number"
              min="1"
              value={min}
              onChange={(e) => setMin(e.target.value)}
              className="w-[90px]"
            />
          </div>
          <div>
            <label className="lbl">Max credits</label>
            <input
              type="number"
              min="1"
              value={max}
              onChange={(e) => setMax(e.target.value)}
              className="w-[100px]"
            />
          </div>
          <div>
            <label className="lbl">Custom amounts</label>
            <label className="flex items-center gap-2 pt-2 text-[12.5px] font-semibold">
              <input
                type="checkbox"
                checked={customOn}
                onChange={(e) => setCustomOn(e.target.checked)}
              />
              Allow
            </label>
          </div>
        </div>
      </div>

      <button
        onClick={save}
        disabled={busy}
        className="mt-4 rounded-[9px] bg-ink px-[18px] py-2.5 text-[13px] font-bold text-surface disabled:opacity-50"
      >
        {busy ? 'Saving…' : 'Save pricing'}
      </button>
      {flash && <div className="mt-2.5 text-[12.5px] font-semibold text-green">{flash}</div>}
    </div>
  );
}