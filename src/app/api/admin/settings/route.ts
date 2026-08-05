import { handler, json, requireAdmin, formData, str, num } from '@/lib/api';
import { getSettings, updateSettings } from '@/lib/settings';
import type { PriceGrid, Resolution } from '@/lib/types';

export const runtime = 'nodejs';

const MODES = ['imagine', 'saved'] as const;
const RESOLUTIONS: Resolution[] = ['1K', '2K', '4K'];

export const POST = handler(async (req: Request) => {
  await requireAdmin();
  const fd = await formData(req);
  const geniePrice = num(fd, 'genie_price');
  const pricesRaw = str(fd, 'prices');

  const current = await getSettings();
  const prices: PriceGrid = {
    imagine: { ...current.prices.imagine },
    saved: { ...current.prices.saved },
  };

  if (pricesRaw) {
    try {
      const parsed = JSON.parse(pricesRaw);
      if (parsed && typeof parsed === 'object') {
        for (const mode of MODES) {
          const m = parsed[mode] ?? {};
          for (const r of RESOLUTIONS) {
            const v = Number(m[r]);
            // Blank cells mean "leave this one alone", not "set to zero".
            if (m[r] !== '' && m[r] !== null && m[r] !== undefined && Number.isFinite(v)) {
              prices[mode][r] = v;
            }
          }
        }
      }
    } catch {
      // Bad JSON leaves pricing untouched rather than failing the whole save.
    }
  }

  const saved = await updateSettings({ genie_price: geniePrice, prices });
  return json({ ok: true, prices: saved.prices });
});