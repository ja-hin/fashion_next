/**
 * Shared helpers for route handlers.
 *
 * The client posts `application/x-www-form-urlencoded` / `multipart/form-data`
 * and expects FastAPI-shaped errors (`{"detail": "..."}`) — both are preserved
 * so the front end error handling is identical to the old app.
 */
import 'server-only';
import { NextResponse } from 'next/server';
import { currentUser } from './auth';
import { ensureBootstrapped } from './bootstrap';
import type { UserDoc } from './types';

/** An error carrying an HTTP status, mirroring FastAPI's HTTPException. */
export class HttpError extends Error {
  status: number;
  constructor(status: number, detail: string) {
    super(detail);
    this.name = 'HttpError';
    this.status = status;
  }
}

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status });

export const fail = (status: number, detail: string) =>
  NextResponse.json({ detail }, { status });

/**
 * Wrap a handler so HttpError becomes the right status and anything unexpected
 * becomes a 500 without leaking a stack trace to the browser.
 *
 * Returns `Response` rather than `NextResponse` because the download routes
 * stream raw bytes (images, ZIPs, CSV) instead of JSON.
 */
export function handler<A extends unknown[]>(
  fn: (...args: A) => Promise<Response>,
): (...args: A) => Promise<Response> {
  return async (...args: A) => {
    try {
      await ensureBootstrapped();
      return await fn(...args);
    } catch (e) {
      if (e instanceof HttpError) return fail(e.status, e.message);
      console.error('[api] unhandled error', e);
      return fail(500, 'Something went wrong. Please try again.');
    }
  };
}

/** The signed-in user, or a 401. */
export async function requireUser(): Promise<UserDoc> {
  const u = await currentUser();
  if (!u) throw new HttpError(401, 'Not authenticated');
  return u;
}

/** The signed-in user, or a 403 if they aren't an admin. */
export async function requireAdmin(): Promise<UserDoc> {
  const u = await requireUser();
  if (!u.is_admin) throw new HttpError(403, 'Admin only');
  return u;
}

// ── form parsing ────────────────────────────────────────────────────

export async function formData(req: Request): Promise<FormData> {
  try {
    return await req.formData();
  } catch {
    throw new HttpError(400, 'Malformed request body.');
  }
}

export const str = (fd: FormData, key: string, dflt = ''): string => {
  const v = fd.get(key);
  return typeof v === 'string' ? v : dflt;
};

export function num(fd: FormData, key: string, dflt: number | null = null): number {
  const v = fd.get(key);
  const n = Number(typeof v === 'string' ? v : NaN);
  if (Number.isFinite(n)) return n;
  if (dflt === null) throw new HttpError(400, `Missing or invalid field: ${key}`);
  return dflt;
}

/** Accepts "1"/"true"/"on"/"yes" as true — matches FastAPI's bool form parsing. */
export const bool = (fd: FormData, key: string, dflt = false): boolean => {
  const v = fd.get(key);
  if (typeof v !== 'string') return dflt;
  return ['1', 'true', 'on', 'yes'].includes(v.toLowerCase());
};

export function file(fd: FormData, key: string): File {
  const v = fd.get(key);
  if (!v || typeof v === 'string') throw new HttpError(400, `Missing file: ${key}`);
  return v as File;
}

export async function fileBuffer(fd: FormData, key: string): Promise<Buffer> {
  const f = file(fd, key);
  return Buffer.from(await f.arrayBuffer());
}