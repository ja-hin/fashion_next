/**
 * The "who am I" payload, shared by `/api/me` and the studio layout so both
 * always agree. The layout uses it to render server-side (no auth flash); the
 * API route uses it to refresh the client after a balance or pricing change.
 */
import 'server-only';
import { currentUser } from './auth';
import { shouldWatermark } from './watermark';
import { getSettings } from './settings';
import {
  PROVIDER,
  VERSION,
  BASE_MODEL_ID,
  HERO_MODEL_ID,
  PRO_MODEL_ID,
  FASHN_API_KEY,
  FASHN_ENGINE,
} from './config';
import { STYLES } from './prompts';
import { offerState } from './offer';

export interface MePayload {
  authed: boolean;
  admin?: boolean;
  provider?: 'gemini' | 'mock';
  version?: string;
  /** Public user id , "U0007". Shown so a customer can quote it in support. */
  uid?: string;
  name?: string;
  email?: string;
  balance?: number;
  price?: number;
  styles?: string[];
  prices?: { imagine: Record<string, number>; saved: Record<string, number> };
  genie?: { free: number; price: number; max: number };
  /** Credits for one 10-second video. */
  video_price?: number;
  /**
   * The complimentary-credits offer , whether to show it, and why.
   * Decided server-side so the rule lives in one place and the client cannot
   * be talked into showing it by editing local state.
   */
  offer?: { show: boolean; reason: string; mark: number };
  extract_price?: number;
  special_prices?: { imagine: Record<string, number>; saved: Record<string, number> };
  /** Admin-chosen engine per job. Model names, not secrets. */
  engines?: { imagine: { hero: string; pose: string }; saved: { hero: string; pose: string }; special_imagine: { hero: string; pose: string }; special_saved: { hero: string; pose: string }; extract: string };
  /** What each blank engine box falls back to, so the admin can see it. */
  engine_defaults?: { base: string; hero: string; pro: string; fashn: string; fashn_ready: boolean };
  /**
   * True while this account is on the free credits, so its images are served
   * with the brand watermark. Flips to false permanently on the first payment.
   */
  watermark?: boolean;
}

export async function getMePayload(): Promise<MePayload> {
  const u = await currentUser();
  if (!u) return { authed: false };

  const s = await getSettings();
  return {
    authed: true,
    admin: u.is_admin,
    provider: PROVIDER,
    version: VERSION,
    uid: u.uid ?? '',
    name: u.name,
    email: u.email,
    balance: u.balance,
    price: s.price_per_image,
    styles: Object.keys(STYLES),
    prices: s.prices,
    genie: { free: s.genie_free, price: s.genie_price, max: s.genie_max },
    video_price: s.video_price,
    offer: offerState(u),
    extract_price: s.extract_price,
    special_prices: s.special_prices,
    engines: s.engines,
    engine_defaults: {
      base: BASE_MODEL_ID,
      hero: HERO_MODEL_ID,
      pro: PRO_MODEL_ID,
      fashn: FASHN_ENGINE,
      fashn_ready: !!FASHN_API_KEY,
    },
    watermark: shouldWatermark(u),
  };
}
