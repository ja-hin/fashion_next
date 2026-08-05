'use client';

/**
 * Browser-side API helpers.
 *
 * The server speaks form-encoded requests and FastAPI-shaped errors
 * (`{"detail": "..."}`), so both are wrapped here rather than repeated at every
 * call site.
 */

export class ApiError extends Error {
  status: number;
  constructor(status: number, detail: string) {
    super(detail);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function toError(r: Response): Promise<ApiError> {
  let detail = 'Something went wrong.';
  try {
    const j = await r.json();
    if (j?.detail) detail = String(j.detail);
  } catch {
    // Non-JSON error body — keep the generic message.
  }
  return new ApiError(r.status, detail);
}

export async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url, { credentials: 'same-origin' });
  if (!r.ok) throw await toError(r);
  return r.json() as Promise<T>;
}

/** POST form-encoded fields. */
export async function postForm<T>(
  url: string,
  fields: Record<string, string | number | boolean> = {},
): Promise<T> {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(fields)) body.append(k, String(v));

  const r = await fetch(url, { method: 'POST', body, credentials: 'same-origin' });
  if (!r.ok) throw await toError(r);
  return r.json() as Promise<T>;
}

/** POST multipart (used for the garment upload). */
export async function postMultipart<T>(url: string, fd: FormData): Promise<T> {
  const r = await fetch(url, { method: 'POST', body: fd, credentials: 'same-origin' });
  if (!r.ok) throw await toError(r);
  return r.json() as Promise<T>;
}

export async function patchForm<T>(
  url: string,
  fields: Record<string, string | number> = {},
): Promise<T> {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(fields)) body.append(k, String(v));

  const r = await fetch(url, { method: 'PATCH', body, credentials: 'same-origin' });
  if (!r.ok) throw await toError(r);
  return r.json() as Promise<T>;
}

export async function del<T>(url: string): Promise<T> {
  const r = await fetch(url, { method: 'DELETE', credentials: 'same-origin' });
  if (!r.ok) throw await toError(r);
  return r.json() as Promise<T>;
}

/**
 * Cache-bust an image URL.
 *
 * Generated images are served with a long immutable cache, and a regenerated
 * pose can reuse a URL the browser already has — so freshly rendered images get
 * a one-off query param.
 */
export const bust = (u: string) =>
  u ? `${u}${u.includes('?') ? '&' : '?'}t=${Date.now()}` : u;

/** Whole numbers stay whole; fractional credits show one decimal. */
export const fmt = (n: number | undefined | null): string => {
  const v = Number(n ?? 0);
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
};

export const safeJs = (s: string) =>
  (s || 'image')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase()
    .slice(0, 48) || 'image';

export const titleCase = (s: string) =>
  (s ?? '').replace(/(^|\s)\w/g, (c) => c.toUpperCase());

const ETH_LABELS: Record<string, string> = {
  european: 'European',
  indian: 'Indian',
  east_asian: 'East Asian',
  southeast_asian: 'Southeast Asian',
  middle_eastern: 'Middle Eastern',
  african: 'Black / African',
  latina: 'Latina',
  diverse: 'Diverse',
};

export const ethLabel = (s: string | undefined) => ETH_LABELS[s ?? ''] ?? s ?? '—';

/** dd/mm/yyyy hh:mm from an ISO timestamp. */
export function fmtLogDate(ts: string | undefined): string {
  if (!ts) return '';
  const [d, t] = String(ts).split('T');
  const p = (d ?? '').split('-');
  if (p.length !== 3) return ts;
  return `${p[2]}/${p[1]}/${p[0]}${t ? ' ' + t.slice(0, 5) : ''}`;
}

/**
 * Per-image AI spend is fractions of a cent, so this shows 4 decimals —
 * anything less rounds every row to $0.00 and the column looks broken.
 */
export function fmtUsd(v: unknown): string {
  if (v === null || v === undefined || v === '') return '';
  const n = Number(v);
  return Number.isNaN(n) ? '' : `$${n.toFixed(4)}`;
}

export const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : '');