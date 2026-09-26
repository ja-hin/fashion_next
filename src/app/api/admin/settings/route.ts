import { handler, json, requireAdmin, formData, str, num } from '@/lib/api';
import { getSettings, updateSettings } from '@/lib/settings';
import type { PriceGrid, Resolution, EngineConfig, EnginePair } from '@/lib/types';

export const runtime = 'nodejs';

const MODES = ['imagine', 'saved'] as const;
const RESOLUTIONS: Resolution[] = ['1K', '2K', '4K'];

export const POST = handler(async (req: Request) => {
  await requireAdmin();
  const fd = await formData(req);
  const geniePrice = num(fd, 'genie_price');
  const pricesRaw = str(fd, 'prices');
  const specialRaw = str(fd, 'special_prices');
  const enginesRaw = str(fd, 'engines');
  /*
   * Video is priced as one flat per-clip figure, not through the resolution
   * grid: a clip is a single 10-second render at one size, so there is nothing
   * for a grid to vary. Absent or non-numeric leaves the stored value alone,
   * the same rule the price cells follow , a blank box means "don't touch",
   * never "make it free".
   */
  const videoRaw = str(fd, 'video_price');
  const videoPrice = Number(videoRaw);

  /* Extraction is priced the same way and for the same reason: one uploaded
     photo is one image generation whatever it holds, so there is nothing for a
     resolution grid to vary. */
  const extractRaw = str(fd, 'extract_price');
  const extractPrice = Number(extractRaw);

  const current = await getSettings();

  /**
   * Lay a posted grid over the stored one.
   *
   * Shared by both grids so they cannot drift on the rule that matters: a blank
   * cell means "leave this one alone", never "make it free". Bad JSON leaves
   * the grid untouched rather than failing the whole save.
   */
  const merge = (raw: string, base: PriceGrid): PriceGrid => {
    const out: PriceGrid = { imagine: { ...base.imagine }, saved: { ...base.saved } };
    if (!raw) return out;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        for (const mode of MODES) {
          const m = parsed[mode] ?? {};
          for (const r of RESOLUTIONS) {
            const v = Number(m[r]);
            if (m[r] !== '' && m[r] !== null && m[r] !== undefined && Number.isFinite(v)) {
              out[mode][r] = v;
            }
          }
        }
      }
    } catch {
      // Bad JSON leaves pricing untouched rather than failing the whole save.
    }
    return out;
  };

  /**
   * Engine ids, trimmed and length-capped.
   *
   * Free text on purpose , these ids change whenever Google renames a preview
   * model, and a fixed dropdown would need a deploy to follow one. '' is a real
   * value here and means "use the environment default", so unlike the price
   * cells a blank IS saved.
   */
  const PAIR_KEYS = ['imagine', 'saved', 'special_imagine', 'special_saved'] as const;
  const clean = (v: unknown) => (typeof v === 'string' ? v.trim().slice(0, 80) : '');
  /* A stored bare string is the pre-split shape and meant "the whole shoot", so
     it seeds both halves rather than being discarded. */
  const asPair = (v: unknown): EnginePair =>
    typeof v === 'string'
      ? { hero: clean(v), pose: clean(v) }
      : {
          hero: clean((v as Partial<EnginePair>)?.hero),
          pose: clean((v as Partial<EnginePair>)?.pose),
        };

  const engines: EngineConfig = {
    imagine: asPair(current.engines?.imagine),
    saved: asPair(current.engines?.saved),
    special_imagine: asPair(current.engines?.special_imagine),
    special_saved: asPair(current.engines?.special_saved),
    extract: clean(current.engines?.extract),
  };

  if (enginesRaw) {
    try {
      const parsed = JSON.parse(enginesRaw);
      if (parsed && typeof parsed === 'object') {
        for (const k of PAIR_KEYS) {
          if (parsed[k] !== undefined) engines[k] = asPair(parsed[k]);
        }
        if (parsed.extract !== undefined) engines.extract = clean(parsed.extract);
      }
    } catch {
      // Bad JSON leaves the engines untouched rather than failing the save.
    }
  }

  const prices = merge(pricesRaw, current.prices);
  const special_prices = merge(specialRaw, current.special_prices ?? current.prices);

  const saved = await updateSettings({
    genie_price: geniePrice,
    prices,
    special_prices,
    engines,
    ...(videoRaw !== '' && Number.isFinite(videoPrice) && videoPrice >= 0
      ? { video_price: videoPrice }
      : {}),
    ...(extractRaw !== '' && Number.isFinite(extractPrice) && extractPrice >= 0
      ? { extract_price: extractPrice }
      : {}),
  });
  return json({
    ok: true,
    prices: saved.prices,
    special_prices: saved.special_prices,
    engines: saved.engines,
    video_price: saved.video_price,
    extract_price: saved.extract_price,
  });
});