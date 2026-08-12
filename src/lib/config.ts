/**
 * Central config — every setting is read from the environment, with a safe
 * fallback for local dev. Port of the old config.py.
 *
 * Server-only: this module reads process.env and must never be imported from a
 * client component.
 */
import 'server-only';

function env(name: string, fallback: string): string {
  const v = process.env[name];
  return v === undefined || v === '' ? fallback : v;
}

function envInt(name: string, fallback: number): number {
  const n = Number.parseInt(env(name, String(fallback)), 10);
  return Number.isFinite(n) ? n : fallback;
}

// ── Database ────────────────────────────────────────────────────────
export const MONGODB_URI = env('MONGODB_URI', 'mongodb://127.0.0.1:27017');
export const MONGODB_DB = env('MONGODB_DB', 'aimagegen');

// ── Keys ────────────────────────────────────────────────────────────
export const GEMINI_API_KEY = env('GEMINI_API_KEY', '').trim();

/** "gemini" when a live key is present, otherwise "mock" (DEMO mode). */
export const PROVIDER: 'gemini' | 'mock' = GEMINI_API_KEY ? 'gemini' : 'mock';

/**
 * Print every prompt sent to the image model to the server console.
 * On by default outside production, since prompt wording is tuned by hand and
 * there is otherwise no way to see what actually went out.
 */
export const LOG_PROMPTS =
  env('LOG_PROMPTS', process.env.NODE_ENV === 'production' ? '0' : '1') !== '0';

// ── Image engines ───────────────────────────────────────────────────
// BASE = everything (poses, edits, imagined-model heroes).
// HERO = the saved-model hero only — the one call where identity is decided.
export const BASE_MODEL_ID = env('BASE_MODEL_ID', 'gemini-3.1-flash-lite-image');
export const HERO_MODEL_ID = env('HERO_MODEL_ID', 'gemini-3.1-flash-image');

/**
 * Text engine — Genie's art director, which reasons and returns JSON rather
 * than pixels. The *-image models above reject `responseMimeType: application/
 * json` with INVALID_ARGUMENT, so this deliberately is NOT one of them.
 */
export const TEXT_MODEL_ID = env('TEXT_MODEL_ID', 'gemini-2.5-flash');

// ── Razorpay ────────────────────────────────────────────────────────
// KEY_ID is public (it is handed to Razorpay Checkout in the browser).
// KEY_SECRET and WEBHOOK_SECRET are server-only and must never be imported
// from a client component — this module is 'server-only', which enforces that.
export const RAZORPAY_KEY_ID = env('RAZORPAY_KEY_ID', '').trim();
export const RAZORPAY_KEY_SECRET = env('RAZORPAY_KEY_SECRET', '').trim();
export const RAZORPAY_WEBHOOK_SECRET = env('RAZORPAY_WEBHOOK_SECRET', '').trim();

/** Payments are live only when both halves of the key pair are present. */
export const PAYMENTS_ENABLED = Boolean(RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET);

/** Shown on the Razorpay Checkout modal. */
export const PAYMENT_BRAND = env('PAYMENT_BRAND', 'Vdofy Studio');
export const PAYMENT_CURRENCY = env('PAYMENT_CURRENCY', 'INR');

// ── Email ───────────────────────────────────────────────────────────
/**
 * Absolute base URL, used to build links inside emails. A reset link has to
 * work when clicked from a mail client, so it can never be relative.
 */
export const APP_URL = env('APP_URL', 'http://localhost:3000').replace(/\/+$/, '');

/**
 * "smtp" | "resend" | "console".
 * Defaults to console outside production — the reset link is printed to the
 * terminal so the flow is testable without a mail account.
 */
export const MAIL_DRIVER = env(
  'MAIL_DRIVER',
  process.env.NODE_ENV === 'production' ? 'smtp' : 'console',
).toLowerCase();

export const MAIL_FROM = env('MAIL_FROM', 'AImageGen <no-reply@localhost>');

export const SMTP_HOST = env('SMTP_HOST', '');
export const SMTP_PORT = envInt('SMTP_PORT', 587);
export const SMTP_USER = env('SMTP_USER', '');
export const SMTP_PASS = env('SMTP_PASS', '');
/** True for port 465 (implicit TLS); 587 uses STARTTLS and stays false. */
export const SMTP_SECURE = env('SMTP_SECURE', SMTP_PORT === 465 ? '1' : '0') !== '0';

export const RESEND_API_KEY = env('RESEND_API_KEY', '');

/** How long a password-reset link stays valid. */
export const RESET_TTL_MINUTES = envInt('RESET_TTL_MINUTES', 60);

// ── Invoicing ───────────────────────────────────────────────────────
// Printed on every GST invoice. A real tax invoice is legally required to
// carry the seller's registered name, address and GSTIN — fill these in
// before sending an invoice to a customer.
export const SELLER_NAME = env('SELLER_NAME', PAYMENT_BRAND);
export const SELLER_ADDRESS = env('SELLER_ADDRESS', '');
export const SELLER_GSTIN = env('SELLER_GSTIN', '');
export const SELLER_PAN = env('SELLER_PAN', '');
export const SELLER_EMAIL = env('SELLER_EMAIL', '');
/** Seller's state, e.g. "Maharashtra". Decides CGST+SGST vs IGST. */
export const SELLER_STATE = env('SELLER_STATE', '');
/** SAC code for online software services. 998314 = IT design & development. */
export const INVOICE_SAC = env('INVOICE_SAC', '998314');
/** Prefix for invoice numbers — "VDF" gives VDF/2026-27/0001. */
export const INVOICE_PREFIX = env('INVOICE_PREFIX', 'INV');

// ── Admin account (seeded on first boot if no admin exists) ─────────
export const ADMIN_EMAIL = env('ADMIN_EMAIL', 'admin@vdofy.app');
export const ADMIN_PASSWORD = env('ADMIN_PASSWORD', 'vdofyadmin');

// ── Wallet & limits ─────────────────────────────────────────────────
/** Free credits every new account starts with. Their output is watermarked. */
export const DEFAULT_BALANCE_IMAGES = envInt('DEFAULT_BALANCE_IMAGES', 50);
export const PRICE_PER_IMAGE = 1; // legacy flat fallback; real pricing is the admin grid
export const MAX_IMG_PX = 1400;

// ── Free-tier watermark ─────────────────────────────────────────────
/** Kill switch — set WATERMARK=0 to serve every image clean. */
export const WATERMARK_ENABLED = env('WATERMARK', '1') !== '0';
/** File inside /public. */
export const WATERMARK_LOGO = env('WATERMARK_LOGO', 'logo-black.png');
/** 0–1. Low enough to leave the image readable, high enough to deter reuse. */
export const WATERMARK_OPACITY = Math.min(
  Math.max(Number(env('WATERMARK_OPACITY', '0.16')) || 0.16, 0.02),
  1,
);

// ── Storage ─────────────────────────────────────────────────────────
export const STORAGE_DRIVER = env('STORAGE_DRIVER', 'local');
export const DATA_DIR = env('DATA_DIR', './data');

// ── Prompt Genie (legacy knobs kept so migrated state stays meaningful) ──
export const GENIE_FREE_PER_PROMPT = 1;
export const GENIE_PRICE_PER_IMPROVE = 0.1;
export const GENIE_MAX_PER_PROMPT = 5;

// ── What a call costs US, in USD per 1,000,000 tokens ───────────────
// Purely for the "Cost (USD)" column in the Logs tab — this is our own spend
// with Google, NOT what the user is charged (that stays the credits grid).
export type TokenRate = { in: number; out: number };

export const TOKEN_RATE_DEFAULT: TokenRate = { in: 0.3, out: 30.0 };

export const TOKEN_RATES_USD: Record<string, TokenRate> = (() => {
  const base: Record<string, TokenRate> = {
    'gemini-3.1-flash-image': { in: 0.5, out: 60.0 },
    'gemini-3.1-flash-lite-image': { in: 0.25, out: 30.0 },
    'gemini-2.5-flash': { in: 0.3, out: 2.5 },
  };
  const raw = env('TOKEN_RATES_USD', '');
  if (!raw) return base;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') Object.assign(base, parsed);
  } catch {
    // Bad JSON must never stop the app booting — keep the defaults.
  }
  return base;
})();

export const VERSION = '1.0.0';