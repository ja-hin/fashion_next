'use client';

import { useState } from 'react';
import Link from 'next/link';
import { postForm, ApiError } from '@/lib/client/api';
import AuthShell from './AuthShell';
import PasswordInput from './PasswordInput';

/**
 * Sign in / create account. `/login` and `/register` are separate routes, so
 * this renders one mode at a time and links across rather than tabbing in place.
 */
export default function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const isSignup = mode === 'register';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (busy) return;
    setBusy(true);
    setErr('');
    try {
      const fields: Record<string, string> = { email, password };
      if (isSignup) fields.name = name;
      await postForm(isSignup ? '/auth/signup' : '/auth/login', fields);
      // Hard navigation so the studio layout re-runs its server-side auth check
      // and renders already signed in.
      window.location.href = '/generate';
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : 'Something went wrong.');
      setBusy(false);
    }
  }

  return (
    <AuthShell>
        <form
          onSubmit={submit}
          className="rounded-2xl border border-line bg-surface p-8 shadow-pop"
        >
          <h1 className="text-center text-[19px] font-bold">
            {isSignup ? 'Create your studio account' : 'Welcome back'}
          </h1>
          <p className="mb-6 mt-1.5 text-center text-[12.5px] text-muted">
            {isSignup
              ? 'Start with free credits — no card needed.'
              : 'Sign in to pick up where you left off.'}
          </p>

          {isSignup && (
            <div className="mb-3">
              <label className="lbl" htmlFor="name">
                Your name
              </label>
              <input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                placeholder="Aisha Kapoor"
              />
            </div>
          )}

          <div className="mb-3">
            <label className="lbl" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="you@brand.com"
            />
          </div>

          <div className="mb-5">
            <div className="flex items-baseline justify-between">
              <label className="lbl" htmlFor="password">
                Password
              </label>
              {!isSignup && (
                <Link
                  href="/forgot"
                  className="mb-1.5 text-[11.5px] font-semibold text-accent hover:underline"
                >
                  Forgot password?
                </Link>
              )}
            </div>
            <PasswordInput
              id="password"
              required
              value={password}
              onChange={setPassword}
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              placeholder={isSignup ? 'At least 6 characters' : '••••••••'}
            />
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-[10px] bg-brand py-3 text-sm font-bold text-white transition hover:brightness-105 disabled:opacity-50"
          >
            {busy ? 'Please wait…' : isSignup ? 'Create account' : 'Sign in'}
          </button>

          {err && (
            <div
              role="alert"
              className="mt-3 rounded-[9px] bg-brand-soft px-3 py-2.5 text-center text-[12.5px] font-semibold text-brand"
            >
              {err}
            </div>
          )}

          <div className="mt-6 border-t border-line pt-5 text-center text-[12.5px] text-muted">
            {isSignup ? (
              <>
                Already have an account?{' '}
                <Link href="/login" className="font-bold text-brand hover:underline">
                  Sign in
                </Link>
              </>
            ) : (
              <>
                New here?{' '}
                <Link href="/register" className="font-bold text-brand hover:underline">
                  Create an account
                </Link>
              </>
            )}
          </div>
      </form>
    </AuthShell>
  );
}
