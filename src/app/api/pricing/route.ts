import { handler, json } from '@/lib/api';
import { activePacks } from '@/lib/pricing';
import { getBilling } from '@/lib/settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Public pricing — powers the marketing pricing page.
 *
 * Deliberately unauthenticated: it's the same information a visitor sees on the
 * page, and nothing here is sensitive. It exposes only what's on sale, never
 * inactive packs or internal settings.
 */
export const GET = handler(async () => {
  const cfg = await getBilling();
  return json({
    packs: activePacks(cfg),
    paise_per_credit: cfg.paise_per_credit,
    gst_rate: cfg.gst_rate,
    custom_enabled: cfg.custom_enabled,
    min_credits: cfg.custom_min_credits,
    max_credits: cfg.custom_max_credits,
  });
});