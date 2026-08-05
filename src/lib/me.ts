/**
 * The "who am I" payload, shared by `/api/me` and the studio layout so both
 * always agree. The layout uses it to render server-side (no auth flash); the
 * API route uses it to refresh the client after a balance or pricing change.
 */
import 'server-only';
import { currentUser } from './auth';
import { getSettings } from './settings';
import { PROVIDER, VERSION } from './config';
import { STYLES } from './prompts';

export interface MePayload {
  authed: boolean;
  admin?: boolean;
  provider?: 'gemini' | 'mock';
  version?: string;
  name?: string;
  email?: string;
  balance?: number;
  price?: number;
  styles?: string[];
  prices?: { imagine: Record<string, number>; saved: Record<string, number> };
  genie?: { free: number; price: number; max: number };
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
    name: u.name,
    email: u.email,
    balance: u.balance,
    price: s.price_per_image,
    styles: Object.keys(STYLES),
    prices: s.prices,
    genie: { free: s.genie_free, price: s.genie_price, max: s.genie_max },
  };
}
