import { handler, json, HttpError } from '@/lib/api';
import { requireOwnedModel } from '@/lib/saved-models';
import { getBalance } from '@/lib/auth';
import { getSettings, shootCost } from '@/lib/settings';
import { buildCharsheetSinglePrompt, CHARSHEET_SINGLE_POSES } from '@/lib/prompts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Preview what generating a character sheet will cost and look like.
 * Does NOT generate anything — the UI shows this in a confirm dialog first.
 */
export const GET = handler(
  async (_req: Request, ctx: { params: Promise<{ mid: string }> }) => {
    const { mid } = await ctx.params;
    const { user, rec } = await requireOwnedModel(mid);

    const refs = rec.refs ?? [];
    // The anchor must be an ORIGINAL reference, never a previously generated
    // character-sheet frame — otherwise each new sheet drifts from the last.
    const originals = refs.filter((r) => !r.charsheet);
    const primary = originals.find((r) => r.primary) ?? originals[0];
    if (!primary) {
      throw new HttpError(
        400,
        'Model has no original reference images to anchor the character sheet.',
      );
    }

    const tags = rec.tags ?? {};
    const settings = await getSettings();
    // A character sheet is always billed at the saved-model 1K rate.
    const costPerImage = shootCost(settings, { model_id: mid }, '1K');
    const numImages = CHARSHEET_SINGLE_POSES.length;

    return json({
      prompt: buildCharsheetSinglePrompt(
        CHARSHEET_SINGLE_POSES[0][1],
        tags.gender ?? 'female',
        tags.ethnicity ?? '',
      ),
      ref_count: refs.length,
      cost: costPerImage * numImages,
      cost_per_image: costPerImage,
      num_images: numImages,
      balance: await getBalance(user._id),
    });
  },
);