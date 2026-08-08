'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { getJson, patchForm, postForm, fmt, ApiError, fmtLogDate } from '@/lib/client/api';
import { EMPTY_PROFILE, INDIAN_STATES, type Profile } from '@/lib/profile';
import { useStudio } from '@/lib/client/StudioContext';

/** The read-only half of the payload — account facts, not editable fields. */
interface Account {
  uid: string;
  email: string;
  created: string;
  balance: number;
  admin: boolean;
}

type ProfileResponse = Profile & Account;

/**
 * Account profile: your details, your billing details, your password.
 *
 * Everything is loaded from /api/profile rather than reused from the `me`
 * payload — `me` carries only what the studio chrome needs, and a form seeded
 * from a partial copy would silently blank the fields it didn't know about on
 * the first save.
 */
export default function ProfileView() {
  const studio = useStudio();

  const [account, setAccount] = useState<Account | null>(null);
  const [saved, setSaved] = useState<Profile & { email: string }>({
    ...EMPTY_PROFILE,
    email: '',
  });
  const [form, setForm] = useState<Profile & { email: string }>({
    ...EMPTY_PROFILE,
    email: '',
  });

  const [password, setPassword] = useState(''); // only for an email change
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    getJson<ProfileResponse>('/api/profile')
      .then((p) => {
        const { uid, email, created, balance, admin, ...rest } = p;
        setAccount({ uid, email, created, balance, admin });
        setSaved({ ...rest, email });
        setForm({ ...rest, email });
      })
      .catch(() => setLoadError('Could not load your profile.'));
  }, []);

  const emailChanged = form.email.trim().toLowerCase() !== saved.email;
  const dirty = useMemo(
    () => (Object.keys(form) as Array<keyof typeof form>).some((k) => form[k] !== saved[k]),
    [form, saved],
  );

  const set = (k: keyof typeof form) => (v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setError('');
    setFlash('');
  };

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!dirty || busy) return;

    setBusy(true);
    setError('');
    setFlash('');
    try {
      const fresh = await patchForm<ProfileResponse>('/api/profile', {
        ...form,
        password,
      });
      const { uid, email, created, balance, admin, ...rest } = fresh;
      setAccount({ uid, email, created, balance, admin });
      setSaved({ ...rest, email });
      setForm({ ...rest, email });
      setPassword('');
      setFlash('Profile saved.');
      // The top bar shows the name and email, so it has to hear about this.
      await studio.refreshMe();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save your profile.');
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setForm(saved);
    setPassword('');
    setError('');
    setFlash('');
  }

  if (loadError) {
    return <div className="text-[13px] font-semibold text-brand">{loadError}</div>;
  }
  if (!account) {
    return <div className="text-[13px] text-muted">Loading…</div>;
  }

  return (
    <div className="animate-fade-up max-w-[820px]">
      <Identity account={account} name={saved.name} />

      <form onSubmit={save}>
        <Card
          title="Your details"
          note="Shown in the studio and used to reach you about your account."
        >
          <div className="grid gap-x-4 sm:grid-cols-2">
            <Input label="Full name" value={form.name} onChange={set('name')} required />
            <Input
              label="Email"
              type="email"
              value={form.email}
              onChange={set('email')}
              hint="You sign in with this address."
              required
            />
            <Input
              label="Phone"
              value={form.phone}
              onChange={set('phone')}
              placeholder="+91 98765 43210"
            />
            <Input
              label="Company"
              value={form.company}
              onChange={set('company')}
              placeholder="Brand or studio name"
            />
          </div>

          {/*
            Only asked for when the sign-in address is actually being moved —
            a password box sitting on a profile page you opened to fix a typo
            in your phone number reads as a security prompt out of nowhere.
          */}
          {emailChanged && (
            <div className="mt-1 rounded-card border border-amber/40 bg-amber-soft p-3.5">
              <Input
                label="Current password"
                type="password"
                value={password}
                onChange={(v) => {
                  setPassword(v);
                  setError('');
                }}
                hint="Required to change the email address you sign in with."
                autoComplete="current-password"
              />
            </div>
          )}
        </Card>

        <Card
          title="Billing details"
          note="Printed on your tax invoices. Your state decides whether GST is charged as IGST or CGST + SGST."
        >
          <div className="grid gap-x-4 sm:grid-cols-2">
            <Input
              label="GSTIN"
              value={form.gstin}
              onChange={(v) => set('gstin')(v.toUpperCase())}
              placeholder="27AAACS1234A1Z5"
              hint="Optional — for a GST input credit on your invoices."
            />
            <Select
              label="State"
              value={form.state}
              onChange={set('state')}
              options={INDIAN_STATES as readonly string[]}
            />
          </div>

          <div className="mb-[13px]">
            <label className="lbl" htmlFor="pf-address">
              Billing address
            </label>
            <textarea
              id="pf-address"
              rows={2}
              value={form.address}
              onChange={(e) => set('address')(e.target.value)}
              placeholder="Street, area, landmark"
            />
          </div>

          <div className="grid gap-x-4 sm:grid-cols-2">
            <Input label="City" value={form.city} onChange={set('city')} />
            <Input
              label="PIN code"
              value={form.pincode}
              onChange={set('pincode')}
              placeholder="400001"
              inputMode="numeric"
            />
          </div>
        </Card>

        {error && (
          <div className="mb-3 rounded-card border border-brand/30 bg-brand-soft px-3.5 py-2.5 text-[12.5px] font-semibold text-brand">
            {error}
          </div>
        )}
        {flash && (
          <div className="mb-3 rounded-card border border-green/30 bg-green-soft px-3.5 py-2.5 text-[12.5px] font-semibold text-green">
            {flash}
          </div>
        )}

        <div className="mb-7 flex items-center gap-2.5">
          <button
            type="submit"
            disabled={!dirty || busy}
            className="rounded-[10px] bg-brand px-[18px] py-[10px] text-[13px] font-bold text-white transition-opacity disabled:opacity-40"
          >
            {busy ? 'Saving…' : 'Save changes'}
          </button>
          <button
            type="button"
            onClick={reset}
            disabled={!dirty || busy}
            className="rounded-[10px] bg-surface2 px-[18px] py-[10px] text-[13px] font-bold text-ink transition-colors hover:bg-line disabled:opacity-40"
          >
            Cancel
          </button>
          {dirty && !busy && (
            <span className="text-[11.5px] text-muted">You have unsaved changes.</span>
          )}
        </div>
      </form>

      <PasswordCard />
    </div>
  );
}

/** The account facts you can look at but not type into. */
function Identity({ account, name }: { account: Account; name: string }) {
  return (
    <div className="mb-[18px] flex flex-wrap items-center gap-4 rounded-card border border-line bg-surface p-[18px] shadow-card">
      <div className="flex h-[52px] w-[52px] flex-shrink-0 items-center justify-center rounded-full bg-brand-soft text-[19px] font-bold text-brand">
        {(name || account.email).trim().charAt(0).toUpperCase()}
      </div>

      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h2 className="truncate text-[17px] font-bold">{name || account.email}</h2>
          {account.admin && (
            <span className="rounded-[5px] bg-surface2 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.05em] text-accent">
              Admin
            </span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11.5px] text-muted">
          <span className="rounded-[5px] bg-surface2 px-1.5 py-0.5 font-mono text-[10px] font-bold text-accent">
            {account.uid || '—'}
          </span>
          <span className="truncate">{account.email}</span>
          {account.created && <span>· Member since {fmtLogDate(account.created).slice(0, 10)}</span>}
        </div>
      </div>

      <div className="flex-1" />

      <div className="text-right">
        <div className="lbl mb-0.5">Balance</div>
        <div className="text-[19px] font-bold tabular-nums text-brand">
          {fmt(account.balance)}
          <span className="ml-1 text-[11px] font-semibold text-muted">credits</span>
        </div>
        <Link href="/recharge" className="text-[11.5px] font-bold text-accent hover:underline">
          + Add credits
        </Link>
      </div>
    </div>
  );
}

/** Change your password. Kept out of the profile form — it saves separately. */
function PasswordCard() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');

  const filled = current && next && confirm;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!filled || busy) return;

    setError('');
    setFlash('');
    if (next !== confirm) {
      setError('The two new passwords do not match.');
      return;
    }

    setBusy(true);
    try {
      await postForm('/api/profile/password', { current, password: next });
      setCurrent('');
      setNext('');
      setConfirm('');
      setFlash('Password changed. Any other device signed into this account has been logged out.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not change your password.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <Card
        title="Password"
        note="Changing it signs out every other device that is still logged in."
      >
        <div className="grid gap-x-4 sm:grid-cols-3">
          <Input
            label="Current password"
            type="password"
            value={current}
            onChange={setCurrent}
            autoComplete="current-password"
          />
          <Input
            label="New password"
            type="password"
            value={next}
            onChange={setNext}
            hint="At least 6 characters."
            autoComplete="new-password"
          />
          <Input
            label="Confirm new password"
            type="password"
            value={confirm}
            onChange={setConfirm}
            autoComplete="new-password"
          />
        </div>

        {error && <p className="mb-2 text-[12.5px] font-semibold text-brand">{error}</p>}
        {flash && <p className="mb-2 text-[12.5px] font-semibold text-green">{flash}</p>}

        <button
          type="submit"
          disabled={!filled || busy}
          className="rounded-[10px] bg-surface2 px-[18px] py-[10px] text-[13px] font-bold text-ink transition-colors hover:bg-line disabled:opacity-40"
        >
          {busy ? 'Changing…' : 'Change password'}
        </button>
      </Card>
    </form>
  );
}

// ── small presentational bits, local to this page ───────────────────

function Card({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-[18px] rounded-card border border-line bg-surface p-[18px] shadow-card">
      <h3 className="text-[15px] font-bold">{title}</h3>
      {note && <p className="mb-[15px] mt-1 text-[12px] leading-[1.55] text-muted">{note}</p>}
      {!note && <div className="mb-[15px]" />}
      {children}
    </section>
  );
}

function Input({
  label,
  value,
  onChange,
  type = 'text',
  hint,
  placeholder,
  required,
  inputMode,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  hint?: string;
  placeholder?: string;
  required?: boolean;
  inputMode?: 'numeric' | 'text';
  autoComplete?: string;
}) {
  const id = `pf-${label.toLowerCase().replace(/[^a-z]+/g, '-')}`;
  return (
    <div className="mb-[13px]">
      <label className="lbl" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        required={required}
        placeholder={placeholder}
        inputMode={inputMode}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint && <p className="mt-[5px] text-[11px] text-muted">{hint}</p>}
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
}) {
  const id = `pf-${label.toLowerCase()}`;
  return (
    <div className="mb-[13px]">
      <label className="lbl" htmlFor={id}>
        {label}
      </label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Not set</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}