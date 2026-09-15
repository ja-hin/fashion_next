import { handler, json, requireUser, formData, str, HttpError } from '@/lib/api';
import { adjustBalance, getBalance } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import { genieText } from '@/lib/gemini';
import { CAST_GENIE_SYSTEM } from '@/lib/prompts';
import { logEvent } from '@/lib/logs';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Prompt Genie , rewrite a pose/scene description into sharper wording.
 *
 * Charged up front (unlike image generation) because the improvement is the
 * product; if the AI call then fails we still return usable text rather than
 * taking the credit for nothing.
 */
export const POST = handler(async (req: Request) => {
  const me = await requireUser();
  const fd = await formData(req);
  const prompt = str(fd, 'prompt');
  // 'cast' writes a casting brief about a PERSON; the default rewrites a
  // pose/scene and is told to leave the person alone. Same charge, same log,
  // opposite instruction , see CAST_GENIE_SYSTEM.
  const cast = str(fd, 'mode') === 'cast';

  const s = await getSettings();
  const per = Number(s.genie_price ?? 0);

  let charged = 0;
  if (per > 0) {
    const nb = await adjustBalance(me._id, -per, false);
    if (nb === null) throw new HttpError(402, 'Insufficient balance for Genie');
    charged = per;
  }

  const balance = await getBalance(me._id);

  let improved: string;
  let usage: Record<string, unknown> = {};
  try {
    const out = await genieText(prompt, cast ? CAST_GENIE_SYSTEM : undefined);
    improved = out.text;
    if (out.usage) usage = { ...out.usage };
  } catch {
    // Never leave the user with nothing after a charge , fall back to a light
    // local embellishment.
    improved = cast
      ? `${(prompt ?? '').replace(/[.\s]+$/, '')}, natural skin texture, calm confident expression.`
      : `${(prompt ?? '').replace(/[.\s]+$/, '')}, editorial composition, soft cinematic light.`;
  }

  await logEvent({
    type: 'genie',
    pid: '-',
    seed: '-',
    pose: cast ? '(casting brief)' : '(prompt improve)',
    category: '-',
    model: '-',
    status: charged ? 'paid' : 'free',
    cost: charged,
    file: `${prompt.slice(0, 60)} → ${improved.slice(0, 60)}`,
    user: me.email,
    ...usage,
  });

  return json({
    improved,
    charged,
    balance,
    next_charged: per > 0,
    capped: false,
  });
});