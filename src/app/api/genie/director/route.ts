import sharp from 'sharp';
import { handler, json, formData, str, HttpError } from '@/lib/api';
import { requireOwnedShoot } from '@/lib/shoots';
import { adjustBalance, getBalance } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import { runDirector, MAX_SET_SIZE, type GenieMessage } from '@/lib/genie-director';
import { logEvent } from '@/lib/logs';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** Reference images are art direction, not detail work — 1024px is plenty. */
const MAX_REF_PX = 1024;

/**
 * One turn of the Genie art-director conversation for a shoot.
 *
 * Charged per turn, like the one-shot Prompt Genie. Unlike that one there is no
 * useful local fallback — a spec the UI can apply either came from the model or
 * didn't — so a provider failure REFUNDS rather than inventing something.
 *
 * The hero anchor is read from the shoot server-side. It is never accepted from
 * the request: it goes into the system prompt, so a client that could set it
 * could rewrite Genie's instructions.
 */
export const POST = handler(async (req: Request) => {
  const fd = await formData(req);
  const pid = str(fd, 'pid');
  if (!pid) throw new HttpError(400, 'Missing shoot id');

  // Ownership check doubles as auth, and gives us the anchor.
  const { user, shoot } = await requireOwnedShoot(pid);

  let messages: GenieMessage[];
  try {
    const parsed = JSON.parse(str(fd, 'messages') || '[]');
    if (!Array.isArray(parsed)) throw new Error('not an array');
    messages = parsed
      .map((m) => ({
        role: m?.role === 'user' ? ('user' as const) : ('genie' as const),
        text: String(m?.text ?? ''),
      }))
      // A long chat would blow the prompt out; the recent turns carry the intent.
      .slice(-12);
  } catch {
    throw new HttpError(400, 'Bad messages — expected a JSON array of {role,text}');
  }

  // The poses already ticked on the card. Genie rewrites these one-for-one when
  // asked to improve them, so the set that comes back matches the selection.
  let selection: string[] = [];
  try {
    const parsed = JSON.parse(str(fd, 'poses') || '[]');
    if (Array.isArray(parsed)) {
      selection = parsed
        .map((p) => String(p ?? '').trim())
        .filter(Boolean)
        .slice(0, MAX_SET_SIZE);
    }
  } catch {
    selection = [];
  }

  let image: Buffer | null = null;
  const upload = fd.get('image');
  if (upload instanceof File && upload.size > 0) {
    try {
      image = await sharp(Buffer.from(await upload.arrayBuffer()))
        .rotate()
        .resize({ width: MAX_REF_PX, height: MAX_REF_PX, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 90 })
        .toBuffer();
    } catch {
      throw new HttpError(400, "Couldn't read that reference image — use a JPG, PNG or WebP.");
    }
  }

  const per = Number((await getSettings()).genie_price ?? 0);

  let charged = 0;
  if (per > 0) {
    const nb = await adjustBalance(user._id, -per, false);
    if (nb === null) throw new HttpError(402, 'Insufficient balance for Genie');
    charged = per;
  }

  let turn;
  try {
    turn = await runDirector(messages, shoot, image, selection);
  } catch (e) {
    // Nothing usable came back, so the credit goes home.
    if (charged) await adjustBalance(user._id, charged);
    console.error('[genie] director turn failed', e);
    throw new HttpError(502, 'Genie is unavailable right now.');
  }

  await logEvent({
    type: 'genie',
    pid,
    seed: String(shoot.seed ?? '-'),
    pose: '(genie director)',
    category: shoot.opts?.category ?? '-',
    model: '-',
    status: charged ? 'paid' : 'free',
    cost: charged,
    file: `${turn.intent}${image ? ' +ref' : ''} → ${turn.spec.pose.slice(0, 60)}`,
    user: user.email,
  });

  return json({ ...turn, charged, balance: await getBalance(user._id) });
});
