'use client';

import { useState } from 'react';
import Link from 'next/link';
import { postForm, ApiError } from '@/lib/client/api';
import PasswordInput from './PasswordInput';

/**
 * Step 2: choose the new password.
 *
 * `valid` is decided on the server before this renders, so an expired or
 * already-used link shows the dead-link state instead of a form that can only
 * fail on submit.
 */
export default function ResetForm({ token, valid }: { token: string; valid: boolean }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const mismatch = confirm.length > 0 && password !== confirm;

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (busy || mismatch) return;
    setBusy(true);
    setErr('');
    try {
      await postForm('/auth/reset', { token, password, confirm });
      // The reset route signs them in, so go straight to the studio. Hard
      // navigation so the layout re-runs its server-side auth check.
      window.location.href = '/generate';
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : 'Something went wrong.');
      setBusy(false);
    }
  }

  if (!valid) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-8 shadow-pop">
        <h1 className="text-center text-[19px] font-bold">Link expired</h1>
        <p className="mb-6 mt-2.5 text-center text-[12.5px] leading-[1.6] text-muted">
          This reset link is no longer valid. Links work once and expire after an hour — request a
          fresh one and it&apos;ll land in your inbox.
        </p>
        <Link
          href="/forgot"
          className="block w-full rounded-[10px] bg-brand py-3 text-center text-sm font-bold text-white"
        >
          Request a new link
        </Link>
        <div className="mt-5 text-center text-[12.5px] text-muted">
          <Link href="/login" className="font-bold text-accent hover:underline">
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-line bg-surface p-8 shadow-pop">
      <h1 className="text-center text-[19px] font-bold">Choose a new password</h1>
      <p className="mb-6 mt-1.5 text-center text-[12.5px] leading-[1.6] text-muted">
        You&apos;ll be signed in straight away. Any other devices already signed in will be
        signed out.
      </p>

      <div className="mb-3">
        <label className="lbl" htmlFor="password">
          New password
        </label>
        <PasswordInput
          id="password"
          required
          autoFocus
          minLength={6}
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          placeholder="At least 6 characters"
        />
      </div>

      <div className="mb-5">
        <label className="lbl" htmlFor="confirm">
          Confirm password
        </label>
        <PasswordInput
          id="confirm"
          required
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
          placeholder="Type it again"
        />
        {mismatch && (
          <div className="mt-1.5 text-[11.5px] font-semibold text-brand">
            The two passwords don&apos;t match.
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={busy || mismatch}
        className="w-full rounded-[10px] bg-brand py-3 text-sm font-bold text-white transition hover:brightness-105 disabled:opacity-50"
      >
        {busy ? 'Saving…' : 'Set new password'}
      </button>

      {err && (
        <div
          role="alert"
          className="mt-3 rounded-[9px] bg-brand-soft px-3 py-2.5 text-center text-[12.5px] font-semibold text-brand"
        >
          {err}
        </div>
      )}
    </form>
  );
}