import { handler, json, requireAdmin, formData, str, HttpError } from '@/lib/api';
import { getBilling } from '@/lib/settings';
import { updateSettings } from '@/lib/settings';
import { sanitisePacks, type BillingConfig } from '@/lib/pricing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Current top-up configuration, including packs an admin has deactivated. */
export const GET = handler(async () => {
  await requireAdmin();
  return json(await getBilling());
});

const int = (v: string, lo: number, hi: number, dflt: number): number => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(Math.max(n, lo), hi) : dflt;
};

/**
 * Save top-up packs and rates.
 *
 * Everything is re-validated here rather than trusted from the form, because
 * these values become real charges — sanitisePacks() drops any pack priced at
 * zero, since that would hand out free credits.
 */
export const POST = handler(async (req: Request) => {
  await requireAdmin();
  const fd = await formData(req);
  const current = await getBilling();

  let packs = current.packs;
  const raw = str(fd, 'packs');
  if (raw) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new HttpError(400, 'Could not read the pack list.');
    }
    packs = sanitisePacks(parsed);
    if (!Array.isArray(parsed) || (parsed.length > 0 && packs.length === 0)) {
      throw new HttpError(
        400,
        'No valid packs. Each needs a name, at least 1 credit and a price above zero.',
      );
    }
  }

  const min = int(str(fd, 'custom_min_credits'), 1, 1_000_000, current.custom_min_credits);
  const max = int(str(fd, 'custom_max_credits'), 1, 1_000_000, current.custom_max_credits);
  if (min > max) throw new HttpError(400, 'Minimum credits cannot exceed the maximum.');

  // Stored as a fraction (0.18), entered as a percentage (18).
  const gstPct = Number(str(fd, 'gst_percent'));
  const gstRate = Number.isFinite(gstPct)
    ? Math.min(Math.max(gstPct, 0), 100) / 100
    : current.gst_rate;

  const next: BillingConfig = {
    paise_per_credit: int(
      str(fd, 'paise_per_credit'),
      1,
      10_000_000,
      current.paise_per_credit,
    ),
    gst_rate: gstRate,
    custom_enabled: str(fd, 'custom_enabled') !== '0',
    custom_min_credits: min,
    custom_max_credits: max,
    packs,
  };

  await updateSettings({ billing: next });
  return json({ ok: true, billing: next });
});