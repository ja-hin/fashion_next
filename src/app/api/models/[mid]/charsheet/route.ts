import crypto from 'node:crypto';
import { handler, json, formData, str, HttpError } from '@/lib/api';
import { requireOwnedModel, updateModel, loadModel, publicModel } from '@/lib/saved-models';
import { storage, modelKey } from '@/lib/storage';
import { adjustBalance, getBalance } from '@/lib/auth';
import { getSettings, shootCost } from '@/lib/settings';
import { produce } from '@/lib/gemini';
import { composeDisplayGrid } from '@/lib/images';
import { logEvent } from '@/lib/logs';
import { PROVIDER } from '@/lib/config';
import { buildCharsheetSinglePrompt, CHARSHEET_SINGLE_POSES } from '@/lib/prompts';
import type { ModelRef } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 600;

/**
 * Generate a 6-angle character sheet: front, back, both knee-up sides, and two
 * close-ups. Each angle is its own focused AI call anchored to the model's
 * primary reference — that produces far better per-angle fidelity than asking
 * for one collage and slicing it up.
 *
 * Charging is per-frame and immediate, so a partial run (say 4 of 6 succeed)
 * bills for exactly what was delivered.
 */
export const POST = handler(
  async (req: Request, ctx: { params: Promise<{ mid: string }> }) => {
    const { mid } = await ctx.params;
    const { user, rec } = await requireOwnedModel(mid);

    if (PROVIDER !== 'gemini') {
      throw new HttpError(400, 'Character sheet generation requires a live Gemini API key.');
    }

    const fd = await formData(req);
    const replaceBatch = str(fd, 'replace_batch');

    let refs = rec.refs ?? [];

    const originals = refs.filter((r) => !r.charsheet);
    const primary = originals.find((r) => r.primary) ?? originals[0];
    if (!primary) {
      throw new HttpError(
        400,
        'Model has no original reference images to anchor the character sheet.',
      );
    }

    const primaryBytes = await storage.get(modelKey(mid, primary.file));
    if (!primaryBytes) {
      throw new HttpError(400, 'Primary reference image file is missing on disk.');
    }

    const tags = rec.tags ?? {};
    const gender = tags.gender ?? 'female';
    const ethnicity = tags.ethnicity ?? '';

    const settings = await getSettings();
    const costPerImage = shootCost(settings, { model_id: mid }, '1K');
    const numImages = CHARSHEET_SINGLE_POSES.length;
    const totalCost = costPerImage * numImages;

    const balance = await getBalance(user._id);
    if (balance < totalCost) {
      throw new HttpError(
        402,
        `Insufficient balance. Generating a character sheet costs ${totalCost} credits ` +
          `(${numImages} × ${costPerImage}); your balance is ${balance}.`,
      );
    }

    // Drop the previous batch first when the user chose "Replace".
    if (replaceBatch) {
      const keep: ModelRef[] = [];
      for (const r of refs) {
        if (r.charsheet && r.batch === replaceBatch) {
          await storage.remove(modelKey(mid, r.file));
        } else {
          keep.push(r);
        }
      }
      refs = keep;
      if (rec.kept_batch === replaceBatch) {
        await updateModel(mid, { refs, kept_batch: '' });
      } else {
        await updateModel(mid, { refs });
      }
    }

    const stamp = crypto.randomBytes(3).toString('hex');
    const newRefs: ModelRef[] = [];
    const frameBytes: Buffer[] = [];

    for (let i = 0; i < CHARSHEET_SINGLE_POSES.length; i++) {
      const [slotLabel, poseDesc, ar] = CHARSHEET_SINGLE_POSES[i];
      const prompt = buildCharsheetSinglePrompt(poseDesc, gender, ethnicity);

      let out;
      try {
        // The primary reference is the identity anchor (hero slot); there's no
        // garment image, since this sheet is a neutral-outfit reference rather
        // than the model dressed in a specific product.
        out = await produce({
          prompt,
          garment: null,
          hero: primaryBytes,
          seed: null,
          ar,
          allowRevealing: false,
          pose: slotLabel,
        });
      } catch (e) {
        const msg = String((e as Error)?.message ?? e);
        await logEvent({
          type: 'charsheet',
          pid: '-',
          seed: '-',
          pose: slotLabel,
          category: '-',
          model: mid,
          status: 'error',
          cost: 0,
          file: `charsheet_${mid}`,
          error: msg,
          user: user.email,
        });
        // Nothing generated at all → fail cleanly. Some frames already done →
        // stop here and keep what we have rather than rolling everything back.
        if (!frameBytes.length) {
          throw new HttpError(
            502,
            `Character sheet generation failed on angle '${slotLabel}': ${msg}`,
          );
        }
        break;
      }

      const fn = `charsheet_${stamp}_${i}.jpg`;
      await storage.put(modelKey(mid, fn), out.image);
      newRefs.push({ file: fn, pose: slotLabel, primary: false, charsheet: 'frame', batch: stamp });
      frameBytes.push(out.image);

      await adjustBalance(user._id, -costPerImage);
      await logEvent({
        type: 'charsheet',
        pid: '-',
        seed: '-',
        pose: slotLabel,
        category: '-',
        model: mid,
        status: 'success',
        cost: costPerImage,
        file: fn,
        user: user.email,
        ...out.usage,
      });
    }

    if (!frameBytes.length) {
      throw new HttpError(502, 'Character sheet generation produced no images.');
    }

    // The grid is display-only; the individual frames are what actually anchor
    // future shoots, so a failure here is non-fatal.
    try {
      const gridBytes = await composeDisplayGrid(frameBytes);
      const gridFn = `charsheet_grid_${stamp}.jpg`;
      await storage.put(modelKey(mid, gridFn), gridBytes);
      newRefs.unshift({
        file: gridFn,
        pose: 'character sheet (full grid)',
        primary: false,
        charsheet: 'grid',
        batch: stamp,
      });
    } catch (e) {
      console.error('[charsheet] grid composition failed', e);
    }

    await updateModel(mid, { refs: [...refs, ...newRefs] });

    const fresh = await loadModel(mid);
    return json({
      ok: true,
      model: publicModel(fresh!),
      batch: stamp,
      balance: await getBalance(user._id),
      cost: costPerImage * frameBytes.length,
      frames_generated: frameBytes.length,
    });
  },
);