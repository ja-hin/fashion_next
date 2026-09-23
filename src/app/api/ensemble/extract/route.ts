import sharp from 'sharp';
import { GoogleGenAI } from '@google/genai';
import { handler, json, requireUser, formData, HttpError } from '@/lib/api';
import { produce } from '@/lib/gemini';
import { buildGarmentExtractPrompt } from '@/lib/prompts';
import { logEvent } from '@/lib/logs';
import { getSettings, engineFor } from '@/lib/settings';
import { adjustBalance, getBalance } from '@/lib/auth';
import { GEMINI_API_KEY, PROVIDER, TEXT_MODEL_ID } from '@/lib/config';
import { MAX_ENSEMBLE_REFS, asRole, type RefRole } from '@/lib/ensemble';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * The longest edge sent to the model.
 *
 * Bigger than the 512px detection uses and for the opposite reason: detection
 * only has to recognise the item, this has to REPRODUCE its print, weave and
 * stitching. Capped all the same , a 6000px phone photo costs real tokens to
 * send and the model does not return anything larger for having received it.
 */
const EXTRACT_PX = 1536;

/**
 * Most items pulled out of one photograph.
 *
 * A bound on cost, not on taste: each item is its own image generation, so an
 * unbounded list would let one busy street-style photo run up eight calls. Four
 * covers a top, a bottom, shoes and a bag, which is a complete look.
 */
const MAX_ITEMS_PER_PHOTO = 4;

/**
 * Roles an extracted item is allowed to have.
 *
 * Clothing only. Widen this and CLOTHING_ONLY_RULE together if the desk ever
 * needs to pull shoes or a bag out of a photo , they are separate decisions
 * from the same fact, and splitting them would let the lister name an item the
 * role vocabulary cannot express.
 */
const EXTRACT_ROLES = ['garment', 'top', 'bottom'] as const;

/**
 * List every garment a person is wearing in the photo, before extracting any.
 *
 * This step exists because of a real failure: asked for "the clothing item", a
 * photo of someone in a white crop top and red briefs came back with the briefs
 * alone. With nothing naming a target the model picks the most prominent thing
 * and silently drops the rest, and the customer gets half their photo back.
 *
 * Naming each item first turns one ambiguous request into N unambiguous ones ,
 * and the name is what makes each extraction accurate, since "the white ribbed
 * long-sleeve crop top" is a far harder instruction to misread than "the
 * garment".
 *
 * CLOTHING ONLY, and stated at length because the first version said "clothing,
 * footwear or accessory" and duly returned a set of bangles as one of the
 * products. An accessory the customer happens to be wearing in a garment photo
 * is not what they asked to have extracted , and each one costs an image
 * generation to find that out.
 */
const CLOTHING_ONLY_RULE = [
  'List only the items of CLOTHING that a person in this photograph is wearing on their body:',
  'tops, shirts, t-shirts, dresses, one-pieces, skirts, trousers, shorts, outerwear, swimwear',
  'and underwear, including any that are only partly visible or partly out of frame.',
  'Do NOT list jewellery, bangles, bracelets, rings, necklaces, earrings, watches, bags,',
  'eyewear, hats, headbands, hair accessories, belts, scarves, footwear, socks or hosiery.',
  'Those are not garments , ignore them completely, even when clearly visible.',
  'Do not list body parts, hair, skin, tattoos, the background, furniture or anything not worn.',
  'One entry per PRODUCT, not per body part , a two-piece set is TWO entries.',
  `For each entry give "role", one of: ${EXTRACT_ROLES.join(', ')}.`,
  'Use "garment" only for a one-piece that covers the whole body; use "top" and "bottom" for separates.',
  'And give "item": that specific product in 2 to 5 words INCLUDING its colour, for example',
  '"white ribbed long-sleeve crop top" or "red thong briefs".',
  'Order them most prominent first.',
  'Return STRICT JSON only , an array, one object per item:',
  '[{"item":"red thong briefs","role":"bottom"}]',
  'If the photograph contains no clothing at all, return [].',
  'No prose, no code fences, JSON only.',
].join(' ');

interface Item {
  item: string;
  role: RefRole;
}

let _client: GoogleGenAI | null = null;
const client = (): GoogleGenAI => {
  if (!_client) _client = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  return _client;
};

/**
 * What is in this photo. Never throws , a failed listing falls back to one
 * unnamed item, which is the old single-item behaviour and still produces
 * something useful rather than failing the whole upload.
 */
async function listItems(buf: Buffer): Promise<Item[]> {
  const fallback: Item[] = [{ item: '', role: asRole(null) }];
  if (PROVIDER === 'mock') return fallback;

  try {
    const resp = await client().models.generateContent({
      model: TEXT_MODEL_ID,
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType: 'image/jpeg', data: buf.toString('base64') } },
            { text: CLOTHING_ONLY_RULE },
          ],
        },
      ],
      config: { responseMimeType: 'application/json', temperature: 0 },
    } as Parameters<GoogleGenAI['models']['generateContent']>[0]);

    const raw = (resp?.text ?? '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    const arr: unknown = JSON.parse(raw);
    if (!Array.isArray(arr) || !arr.length) return fallback;

    const items = arr.slice(0, MAX_ITEMS_PER_PHOTO).map((row) => {
      const r = (row ?? {}) as Record<string, unknown>;
      return {
        // Clamped on the way in: this string goes straight into a prompt, and a
        // prompt is an instruction. Same reasoning as asRole , see detect.
        item: String(r.item ?? '').trim().toLowerCase().slice(0, 60),
        // Clamped to the clothing roles: a lister that ignores the list and
        // says "jewellery" must not be able to put that word in a prompt.
        role: (EXTRACT_ROLES as readonly string[]).includes(String(r.role))
          ? (String(r.role) as RefRole)
          : asRole(null),
      };
    });

    const named = items.filter((i) => i.item);
    return named.length ? named : fallback;
  } catch (e) {
    console.error('[extract] item listing failed , falling back to one item', e);
    return fallback;
  }
}

/**
 * Pull each garment out of a photo of someone wearing it.
 *
 * Reached from the Special Category desk: detection reports `has_person` on an
 * upload, the customer chooses "extract the garment for me", and this turns
 * their photo into garment-only references the shoot can actually use.
 *
 * ONE PHOTO IN, ONE PACKSHOT OUT , however many pieces are in it. Someone
 * photographed in a bra and briefs is wearing a SET, which is one product on
 * this desk, so both pieces come back in a single frame laid out the way they
 * are worn. That keeps an upload at one image generation and hands the shoot
 * one reference instead of two it would have to reassemble.
 *
 * Images in, images out. Nothing is written to storage and no shoot is created:
 * results go straight back to the browser. If the customer then abandons the
 * desk, nothing was kept , the right default for someone else's photograph of a
 * person.
 *
 * CHARGED PER PHOTO, at `extract_price` from app settings (Settings page, next
 * to the video price). Per photo rather than per garment because that is what a
 * photo costs us , every piece in it comes back in one packshot from one
 * generation.
 *
 * Charged only for photos that come back. A refusal costs the customer nothing,
 * which matters here more than usual: whether the model will process a given
 * photograph is not something they can tell in advance, and billing for the
 * answer "no" would make that their problem.
 *
 * Failures are per photo, never for the batch: one photo the model refuses
 * should not throw away the others that came out fine , nor bill for them.
 */
export const POST = handler(async (req: Request) => {
  const user = await requireUser();
  const fd = await formData(req);

  const files = fd.getAll('refs').filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) throw new HttpError(400, 'No images to extract from.');
  if (files.length > MAX_ENSEMBLE_REFS) {
    throw new HttpError(400, `At most ${MAX_ENSEMBLE_REFS} images at a time.`);
  }

  let shrunk: Buffer[];
  try {
    shrunk = await Promise.all(
      files.map(async (f) =>
        sharp(Buffer.from(await f.arrayBuffer()))
          // Phone photos carry their orientation in EXIF; without this the
          // model is handed a sideways garment and faithfully extracts one.
          .rotate()
          .resize({ width: EXTRACT_PX, height: EXTRACT_PX, fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 90 })
          .toBuffer(),
      ),
    );
  } catch {
    throw new HttpError(400, 'One of those images could not be read , use JPG, PNG or WebP.');
  }

  const appSettings = await getSettings();
  const cost = Number(appSettings.extract_price ?? 0);
  /* The engine an admin picked for extraction, or '' to leave the environment's
     default. This is the detail-critical step , it has to reproduce print and
     weave, not just recognise them , so it is worth being able to point at the
     heavier model without redeploying. */
  const engine = engineFor(appSettings, 'extract');
  /* Checked for ONE photo, not the whole batch. Each is charged as it lands, so
     someone with credits for two of their three uploads gets two extractions
     and a clear message on the third , which is better than being turned away
     at the door with enough balance to do most of the job. */
  if (cost > 0 && (await getBalance(user._id)) < cost) {
    throw new HttpError(402, 'Not enough credits to extract a garment.');
  }

  type Extracted = { image: string; label: string; role: RefRole };
  const results: Array<{ item?: Extracted; error?: string }> = [];

  /*
   * One generation per PHOTO, not per garment.
   *
   * A bra and briefs photographed together are one product on this desk, so
   * they come back in one frame , which is also why an upload costs one image
   * generation however many pieces the lister found. The alternative, a call
   * per item, billed one photo as two and handed the shoot two references it
   * then had to reassemble into the set it started as.
   *
   * Sequential across photos all the same: these are full image generations
   * against the same per-key rate limit the shoot path uses, and firing six at
   * once buys a little wall-clock and a lot of 429s.
   */
  for (const buf of shrunk) {
    const items = await listItems(buf);
    const names = items.map((i) => i.item).filter(Boolean);
    // The role the whole packshot carries. A single piece keeps its own; a set
    // is a one-piece look as far as the shoot is concerned, so it goes in as
    // 'garment' rather than pretending to be just the top or just the bottom.
    const role: RefRole = items.length > 1 ? asRole('garment') : (items[0]?.role ?? asRole(null));
    const label = names.join(' + ');
    const pose = `extract ${label || 'garment'}`.slice(0, 120);

    try {
      const { image, usage } = await produce({
        prompt: buildGarmentExtractPrompt(names),
        garment: buf,
        // Portrait for a set: a top above a bottom does not fit a square
        // without shrinking both. A single piece is comfortable either way.
        ar: names.length > 1 ? '3:4' : '1:1',
        imageSize: '1K',
        modelId: engine || undefined,
        // A refusal here will not be fixed by asking the same question again ,
        // it is a judgement about the photograph, not a transient block.
        retryBlock: false,
        pose,
      });

      // Normalised on the way out: the model's JPEG is re-encoded at a known
      // quality so what the browser swaps in is predictable in size.
      const jpg = await sharp(image).jpeg({ quality: 92 }).toBuffer();

      /* Charged AFTER the image exists, and with allowNegative false so two
         requests racing each other cannot overdraw between them. If it fails
         the balance went while this was generating , the image is dropped
         rather than handed over unpaid. */
      if (cost > 0) {
        const left = await adjustBalance(user._id, -cost, false);
        if (left === null) {
          await logEvent({
            type: 'image',
            status: 'error',
            pose,
            cost: 0,
            user: user.email,
            error: 'balance ran out during extraction',
            ...usage,
          });
          results.push({ error: 'Your credits ran out before this photo finished.' });
          continue;
        }
      }

      await logEvent({
        type: 'image',
        status: 'success',
        pose,
        cost,
        user: user.email,
        ...usage,
      });

      results.push({
        item: {
          image: `data:image/jpeg;base64,${jpg.toString('base64')}`,
          label,
          role,
        },
      });
    } catch (e) {
      const msg = String((e as Error)?.message ?? e);
      await logEvent({
        type: 'image',
        status: 'error',
        pose,
        cost: 0,
        user: user.email,
        error: msg.slice(0, 300),
      });
      results.push({
        // The model's own wording is not for the customer , it says things like
        // "blocked (IMAGE_OTHER)". Say what it means for them instead.
        error: msg.includes('blocked')
          ? 'The model would not process this photo. Try a different one, or upload the garment on its own.'
          : 'Could not extract the garment from this photo.',
      });
    }
  }

  // The browser updates the credit pill from this rather than refetching /api/me.
  return json({ results, balance: await getBalance(user._id) });
});
