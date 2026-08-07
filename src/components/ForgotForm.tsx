'use client';

import { useState } from 'react';
import Link from 'next/link';
import { postForm, ApiError } from '@/lib/client/api';

/** Step 1 of the reset: ask for the email, send the link. */
export default function ForgotForm() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [mailOff, setMailOff] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (busy) return;
    setBusy(true);
    setErr('');
    try {
      const j = await postForm<{ mail_configured?: boolean }>('/auth/forgot', { email });
      setMailOff(j.mail_configured === false);
      setSent(true);
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-8 shadow-pop">
      <h1 className="text-center text-[19px] font-bold">Reset your password</h1>

      {sent ? (
        <>
          {/*
            Worded so it says nothing about whether the address is registered —
            the API responds identically either way, and a message like "no such
            account" here would undo that.
          */}
          <p className="mb-5 mt-2.5 text-center text-[12.5px] leading-[1.6] text-muted">
            If an account exists for <b className="text-ink">{email}</b>, we&apos;ve sent a reset
            link to that address. It works once and expires in an hour.
          </p>
          <p className="mb-5 text-center text-[11.5px] text-muted">
            Nothing arrived? Check spam, or try again in a few minutes.
          </p>

          {mailOff && (
            <div className="mb-4 rounded-[9px] bg-amber-soft px-3 py-2.5 text-[11.5px] font-semibold text-amber">
              Email isn&apos;t configured on this server yet, so no message was actually sent. Set
              MAIL_DRIVER and the SMTP settings to enable delivery.
            </div>
          )}

          <Link
            href="/login"
            className="block w-full rounded-[10px] bg-ink py-3 text-center text-sm font-bold text-surface"
          >
            Back to sign in
          </Link>
        </>
      ) : (
        <form onSubmit={submit}>
          <p className="mb-6 mt-1.5 text-center text-[12.5px] leading-[1.6] text-muted">
            Enter the email you signed up with and we&apos;ll send you a link to choose a new
            password.
          </p>

          <div className="mb-5">
            <label className="lbl" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="you@brand.com"
            />
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-[10px] bg-brand py-3 text-sm font-bold text-white transition hover:brightness-105 disabled:opacity-50"
          >
            {busy ? 'Sending…' : 'Send reset link'}
          </button>

          {err && (
            <div
              role="alert"
              className="mt-3 rounded-[9px] bg-brand-soft px-3 py-2.5 text-center text-[12.5px] font-semibold text-brand"
            >
              {err}
            </div>
          )}

          <div className="mt-5 text-center text-[12.5px] text-muted">
            Remembered it?{' '}
            <Link href="/login" className="font-bold text-accent hover:underline">
              Sign in
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}