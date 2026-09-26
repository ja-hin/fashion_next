/**
 * The generation core.
 *
 * Port of gen_one_image / run_product / run_one / run_batch. The consistency
 * model is the whole point of the product, so the branch structure is preserved
 * exactly:
 *
 *   1. The HERO shot decides the model, lighting and background, and locks a seed.
 *   2. Every later pose is generated FROM the hero image, not from the garment,
 *      so the same person and setup carry across the shoot.
 *   3. Charge-on-success , credits come off the wallet only after an image
 *      actually lands on disk.
 */
import 'server-only';
import crypto from 'node:crypto';
import { storage, shootKey, shootUrl } from './storage';
import { writeDerivatives } from './derivatives';
import { produce } from './gemini';
import { getShoot, updateShoot, pushManifest, shootFilePrefix } from './shoots';
import { latestCharsheetFrontFrame, loadModel, updateModel } from './saved-models';
import { productToModel as fashnProductToModel } from './fashn';
import { adjustBalance, getBalance } from './auth';
import {
  getSettings,
  shootCost,
  normaliseResolution,
  shootNoStr,
  safeName,
  engineFor,
  engineKey,
} from './settings';
import { logEvent } from './logs';
import { pushResult, patchJob, finishJob } from './jobs';
import {
  BASE_MODEL_ID,
  HERO_MODEL_ID,
  PRO_MODEL_ID,
  FASHN_API_KEY,
  FASHN_ENGINE,
} from './config';
import {
  buildEnsemblePrompt,
  buildSameGarmentPrompt,
  VIEW_TRUTH,
  viewLabel,
  isViewRole,
  asRole,
  type RefMode,
  type RefRole,
  type EnsembleRole,
  type GarmentRole,
} from './ensemble';
import {
  KID_CATS,
  GENDER_BY_CAT,
  LOOKS,
  MALE_LOOKS,
  buildPrompt,
  buildPosePrompt,
  poseView,
  type PoseRef,
  buildSavedModelHeroPrompt,
  HEAD_COMPLETE_PROMPT,
  stylePhrase,
  FRAMING,
} from './prompts';
import type { ShootDoc, ShootOpts, Resolution } from './types';

const uniq = () => crypto.randomBytes(3).toString('hex');
const randSeed = () => 1 + Math.floor(Math.random() * 2_000_000_000);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Shown when the image model refuses the request outright.
 *
 * Three attempts have already been made and all three came back blocked, so a
 * fourth would too , which is why the card this produces carries no Retry. It
 * names the likely cause rather than apologising, because the only thing that
 * changes the outcome is changing the upload.
 */
/**
 * Shown when a saved model's FACE could not be used, but their look could.
 *
 * A warning rather than an error: the customer got an image, and it is of a
 * person matching the model they picked , but it is not the same face, and
 * saying so is the difference between a limitation and a bug report.
 */
const DESCRIBED_MODEL_WARN =
  "Generated from this model's description , their exact face cannot be used for this category.";

/**
 * A saved model written out in words: what Imagine would have been told.
 *
 * `tags.vibe` is a display string ("Fair · Mid 20s · Long wavy · Average ·
 * Tall"), so the separators are turned back into a list before it reaches a
 * prompt , a prompt is prose, and the dots read as punctuation nobody wrote.
 *
 * Returns '' when the model has no ethnicity recorded, which is the one field
 * stylePhrase cannot work without.
 */
async function savedModelWho(mid: string): Promise<string> {
  const rec = await loadModel(mid);
  if (!rec) return '';

  /*
   * The likeness first , it is the whole difference between "looks like your
   * model" and "a stranger who shares her ethnicity".
   *
   * Read from the character sheet once and cached on the model document: the
   * sheet is fixed after the model is confirmed, so the description is too, and
   * paying a vision call per shoot for an answer that cannot change would be
   * waste. A failure here is not fatal , the tag phrase below still works.
   */
  if (rec.likeness) return rec.likeness;

  try {
    const frame = await latestCharsheetFrontFrame(mid);
    if (frame) {
      const { describePerson } = await import('./genie-director');
      const likeness = await describePerson(frame);
      if (likeness) {
        await updateModel(mid, { likeness });
        return likeness;
      }
    }
  } catch (e) {
    console.error('[gen] could not describe saved model , falling back to tags', e);
  }

  const tags = rec.tags;
  if (!tags?.ethnicity) return '';
  const look = String(tags.vibe ?? '')
    .replace(/\s*·\s*/g, ', ')
    .trim()
    .toLowerCase();
  return stylePhrase(tags.ethnicity, tags.gender ?? 'female', look);
}

const POLICY_MSG =
  'This garment cannot be generated on a model. Underwear, lingerie and other ' +
  'revealing pieces are refused by the image model, and retrying will not ' +
  'change that. Try a flat-lay or ghost-mannequin shot of the piece instead.';

export interface PerImageSettings {
  backdrop?: string;
  mood?: string;
  lighting?: string;
}

interface GenOneOpts {
  jobId: string;
  pid: string;
  pose: string;
  isHero: boolean;
  framing?: string | null;
  aspect?: string | null;
  headComplete?: boolean;
  scene?: string | null;
  settings?: PerImageSettings | null;
  resolution?: string | null;
}

/**
 * Generate exactly one image and, on success, charge for it.
 *
 * Always pushes exactly one job result , either an image or an error , so the
 * client's progress counter stays truthful.
 */
export async function genOneImage(o: GenOneOpts): Promise<void> {
  const shoot = await getShoot(o.pid);
  if (!shoot) {
    pushResult(o.jobId, { pose: o.pose, error: 'Unknown shoot' });
    return;
  }

  const opts: ShootOpts = shoot.opts;
  const look = shoot.look ?? '';
  const ar = o.aspect || opts.aspect;
  const fr = o.framing || opts.framing;
  const res: Resolution = normaliseResolution(o.resolution || opts.resolution || '1K');

  const appSettings = await getSettings();
  const cost = shootCost(appSettings, opts, res);
  /*
   * The engine an admin picked for this kind of shoot, or '' to leave the
   * environment's own choice alone.
   *
   * Looked up once per image, because hero and poses are separate settings:
   * the hero decides the model, lighting and background for the whole shoot and
   * is worth the heavier engine, while the poses generated from it run on the
   * lighter one. `o.isHero` is what this call is, so one lookup covers every
   * produce() below it.
   */
  const chosen = engineFor(appSettings, engineKey(opts), o.isHero ? 'hero' : 'pose');
  /*
   * What a blank engine box falls back to, for THIS job.
   *
   * A saved model on the Special Category desk goes to FASHN when a key is
   * configured: Gemini refuses to render an identifiable person's photograph in
   * this category on every engine, while FASHN takes the identity as a real
   * input. Without a key, the heaviest Gemini engine, which at least tries.
   *
   * Poses keep the light engine either way , they are generated FROM the hero
   * once it exists, and the hero is the frame that gets refused.
   *
   * Resolved HERE rather than at the point of use, because the FASHN branch
   * below has to see the default too , reading the raw setting there would mean
   * an empty box silently never reaching FASHN at all.
   *
   * ANCHORED ONLY. It is deliberately not folded into `engine`: the saved-model
   * path is the only one that ever named a hero engine of its own, and every
   * other call has always passed nothing and let resolveModel pick. Applying a
   * hero default to those would quietly move an ordinary imagined hero off
   * flash-lite, which is a pricing change nobody asked for.
   */
  const anchoredEngine =
    chosen ||
    (o.isHero
      ? opts.special && opts.model_id
        ? FASHN_API_KEY
          ? FASHN_ENGINE
          : PRO_MODEL_ID
        : HERO_MODEL_ID
      : BASE_MODEL_ID);

  /** What the non-anchored calls pass , the raw setting, '' meaning "default". */
  const engine = chosen;
  const category = opts.category;
  // Child safety filters are NEVER relaxed, whatever the shoot was set to.
  const allowRev = !!opts.allow_revealing && !KID_CATS.has(category);
  const recast = opts.input_family === 'recast';
  const prefix = shootFilePrefix(shoot);
  const owner = opts.owner;

  if ((await getBalance(owner)) < cost) {
    pushResult(o.jobId, { pose: o.pose, error: 'Insufficient balance' });
    return;
  }

  const garmentBytes = shoot.garment_file
    ? await storage.get(shootKey(o.pid, shoot.garment_file))
    : null;

  // Extra poses are generated FROM the hero image , that's the consistency lock.
  let heroBytes: Buffer | null = null;
  if (shoot.hero_file && !o.isHero) {
    heroBytes = await storage.get(shootKey(o.pid, shoot.hero_file));
  }

  /**
   * Tagged references for whatever angle this pose reveals.
   *
   * The hero is a front shot, so it is authoritative for the front and nothing
   * more. Any pose that moves the camera , round the back, to a profile, in to
   * a detail , is asking for information the hero does not contain, and the
   * prompt otherwise has to admit that angle is unknown. If the shoot tagged a
   * photo of it, send that photo instead of leaving it to invention.
   *
   * Works in both modes: a view role means the same thing in either list, and a
   * detail pose also takes the label frame, which is where lettering lives.
   */
  const poseRefBytes: Buffer[] = [];
  const poseRefDescs: PoseRef[] = [];

  if (!o.isHero && shoot.refs?.length) {
    const view = poseView(o.pose);
    if (view) {
      // A close-up wants the label too , that is where print and lettering are.
      const wanted = view === 'detail' ? ['detail', 'label'] : [view];
      for (const want of wanted) {
        const ref = shoot.refs.find((r) => r.role === want);
        if (!ref) continue;
        const bytes = await storage.get(shootKey(o.pid, ref.file));
        if (!bytes) continue;
        poseRefBytes.push(bytes);
        if (isViewRole(ref.role)) {
          poseRefDescs.push({ label: viewLabel(ref.role), truth: VIEW_TRUTH[ref.role] });
        }
      }
    }
  }

  // Ordered first by geminiGenerate, so they are Images 1..N and the hero N+1.
  const poseRefs = poseRefBytes.length ? poseRefBytes : null;

  /** Persist the image, charge the wallet, log the event, report the result. */
  const saveAndCharge = async (
    raw: Buffer,
    extra: {
      warn?: string;
      status?: string;
      attempt?: number;
      seedUsed?: number;
      modelOverride?: string;
      usage?: Record<string, unknown>;
    } = {},
  ): Promise<void> => {
    const fname = `${o.isHero ? 'hero' : 'pose'}_${uniq()}.jpg`;
    const key = shootKey(o.pid, fname);
    await storage.put(key, raw);
    // Build the display copies now, while the user is still watching the job ,
    // the ~150ms is invisible next to the generation itself, and the results
    // grid then paints from WebP instead of paying for it on first view.
    await writeDerivatives(key, raw);

    if (o.isHero) await updateShoot(o.pid, { hero_file: fname });

    const st = o.settings ?? {};
    await pushManifest(o.pid, {
      file: fname,
      pose: o.pose,
      aspect: ar || '',
      framing: fr || '',
      backdrop: st.backdrop || '',
      mood: st.mood || '',
      lighting: st.lighting || '',
    });

    const url = shootUrl(o.pid, fname);
    await adjustBalance(owner, -cost);

    await logEvent({
      type: 'image',
      pid: o.pid,
      shoot: shootNoStr(shoot.no),
      seed: extra.seedUsed ?? shoot.seed,
      pose: o.pose,
      category,
      model: extra.modelOverride ?? opts.style ?? '-',
      /* An explicit status wins over the generic 'fallback'. Both are set on
         the described-model path , it carries a warning AND is its own kind of
         outcome , and without this the two get conflated in Logs with the
         consistency fallback, which is a different thing entirely. */
      status: extra.status ?? (extra.warn ? 'fallback' : 'success'),
      cost,
      file: `${prefix}_${safeName(o.pose)}.jpg`,
      img: url,
      user: opts.owner_email ?? '-',
      ...(extra.attempt !== undefined ? { attempt: extra.attempt } : {}),
      ...(extra.usage ?? {}),
    });

    pushResult(o.jobId, {
      pose: o.pose,
      img: url,
      cost,
      ...(extra.warn ? { warn: extra.warn } : {}),
    });
  };

  /**
   * Saved-model-anchored generation.
   *
   * On a soft content block (IMAGE_OTHER) this reseeds and retries the SAME
   * reference up to 3 attempts , it never swaps to an imagined model, because
   * the whole promise of a saved model is that the face doesn't change.
   * Returns null when all three attempts are blocked.
   */
  const produceAnchored = async (
    prompt: string,
    gBytes: Buffer | null,
    hBytes: Buffer | null,
    /** Ensemble references, sent BEFORE the model frame so it is "Image N+1". */
    refBytes: Buffer[] | null = null,
  ): Promise<{ raw: Buffer; seed: number; attempt: number; usage: Record<string, unknown> } | null> => {
    const mid = opts.model_id || '-';
    // The hero shot uses the stronger flash-image model; extra poses use the
    // lighter flash-lite model to keep cost down , unless an admin has named an
    // engine for this kind of shoot, which overrides both.
    // Already resolved, defaults and all , see `anchoredEngine` above.
    const aiModel = anchoredEngine;
    let currentSeed = shoot.seed;

    for (let att = 1; att <= 3; att++) {
      const sd = att === 1 ? currentSeed : randSeed();
      try {
        const out = await produce({
          prompt,
          refs: refBytes,
          garment: gBytes,
          hero: hBytes,
          seed: sd,
          ar,
          allowRevealing: allowRev,
          pose: o.pose,
          retryBlock: false,
          modelId: aiModel,
          imageSize: res,
        });
        if (sd !== currentSeed) {
          await updateShoot(o.pid, { seed: sd });
          shoot.seed = sd;
          currentSeed = sd;
        }
        return { raw: out.image, seed: sd, attempt: att, usage: { ...out.usage } };
      } catch (e) {
        const msg = String((e as Error)?.message ?? e);
        if (msg.includes('IMAGE_OTHER')) {
          await logEvent({
            type: 'image',
            pid: o.pid,
            seed: sd,
            pose: o.pose,
            category,
            model: mid,
            status: 'blocked_attempt',
            attempt: att,
            cost: 0,
            file: '-',
            error: msg,
            user: opts.owner_email ?? '-',
          });
          continue;
        }
        throw e;
      }
    }

    await logEvent({
      type: 'image',
      pid: o.pid,
      seed: shoot.seed,
      pose: o.pose,
      category,
      model: mid,
      status: 'blocked_hardfail',
      attempt: 3,
      cost: 0,
      file: '-',
      user: opts.owner_email ?? '-',
    });
    return null;
  };

  try {
    // ── head completion pass (uploaded base photo missing its head) ──
    if (o.headComplete) {
      if (!heroBytes && shoot.hero_file) {
        heroBytes = await storage.get(shootKey(o.pid, shoot.hero_file));
      }
      const out = await produce({
        prompt: HEAD_COMPLETE_PROMPT,
        garment: null,
        hero: heroBytes,
        seed: shoot.seed,
        ar,
        allowRevealing: allowRev,
        pose: o.pose,
        // Admin's engine for this shoot type, or the environment's default.
        // Never the FASHN sentinel , that is not a Gemini id.
        modelId: engine === FASHN_ENGINE ? undefined : engine,
        imageSize: res,
      });
      await saveAndCharge(out.image, { usage: { ...out.usage } });
      return;
    }

    // ── multi-reference hero ────────────────────────────────────────
    //
    // Either several angles of ONE garment, or several DIFFERENT items
    // assembled into one look. Both send N tagged references instead of a
    // single garment photo.
    //
    // Checked BEFORE the saved-model branch below, because that branch's prompt
    // is hardcoded to "Image 1 = garment, Image 2 = model" and only ever
    // receives one garment , a multi-reference shoot falling into it would
    // silently use the first image and drop the rest.
    //
    // Only the hero differs. Once it lands it is an ordinary hero, and every
    // later pose is generated from it like any other shoot , which is what
    // keeps the garment or assembled look locked without re-sending anything.
    if (o.isHero && shoot.refs?.length) {
      // Older shoots stored the mode in input_family; read that as a fallback.
      const refMode: RefMode =
        opts.ref_mode ?? (opts.input_family === 'ensemble' ? 'ensemble' : 'same_garment');

      const refBytes: Buffer[] = [];
      const roles: RefRole[] = [];
      for (const r of shoot.refs) {
        const b = await storage.get(shootKey(o.pid, r.file));
        // Skip a missing file rather than shifting every later reference up a
        // slot , the prompt numbers them positionally, so a silent shift would
        // put the shoes where the sunglasses should be.
        if (!b) continue;
        refBytes.push(b);
        roles.push(asRole(r.role, refMode));
      }

      if (!refBytes.length) {
        pushResult(o.jobId, { pose: o.pose, error: 'Reference images are missing.' });
        return;
      }

      const gender = GENDER_BY_CAT[category] ?? 'female';
      const child = gender === 'child';

      /**
       * Same shape either way; only the wording and the role list differ.
       *
       * `whoOverride` is how a saved model is DESCRIBED rather than shown , see
       * the fallback below. Passing it implies `anchored: false`, because there
       * is no model photograph for the prompt to point at.
       */
      const heroPrompt = (anchored: boolean, whoOverride?: string) =>
        refMode === 'ensemble'
          ? buildEnsemblePrompt({
              roles: roles as EnsembleRole[],
              who:
                whoOverride ||
                (anchored
                  ? ''
                  : child
                    ? 'a young child fashion model, age-appropriate and fully clothed'
                    : stylePhrase(opts.style, gender, look, opts.model_traits)),
              scene: opts.scene ?? '',
              framing: FRAMING[fr] ?? FRAMING.three_quarter,
              anchored,
              child,
              revealing: allowRev,
            })
          : buildSameGarmentPrompt({
              roles: roles as GarmentRole[],
              who:
                whoOverride ||
                (anchored
                  ? ''
                  : child
                    ? 'a young child fashion model, age-appropriate and fully clothed'
                    : stylePhrase(opts.style, gender, look, opts.model_traits)),
              scene: opts.scene ?? '',
              framing: FRAMING[fr] ?? FRAMING.three_quarter,
              anchored,
              child,
              revealing: allowRev,
            });

      // A saved model anchors the face: its character-sheet frame goes in after
      // the references, so the prompt can call it "Image N+1".
      if (opts.model_id) {
        const frontFrame = await latestCharsheetFrontFrame(opts.model_id);
        if (!frontFrame) {
          pushResult(o.jobId, {
            pose: o.pose,
            error: 'Selected model has no character sheet , generate one first.',
          });
          return;
        }

        /*
         * FASHN, when this job is pointed at it.
         *
         * Handled before produceAnchored rather than inside it: nothing about
         * that function applies , no prompt, no seed reroll, no Gemini engine ,
         * and threading a second provider through it would make both harder to
         * read. A failure here falls through to the same described-model
         * fallback as a Gemini refusal, so the desk behaves the same way
         * whichever provider is in front of it.
         *
         * ONE garment image: product-to-model takes a single product, not a
         * manifest. The first reference is the one the shoot leads with , on
         * this desk that is normally the extracted packshot, which already has
         * every piece of the set in one frame.
         */
        if (anchoredEngine === FASHN_ENGINE) {
          try {
            const out = await fashnProductToModel({
              garment: refBytes[0],
              face: frontFrame,
              resolution: res,
              aspect: ar,
              seed: shoot.seed,
            });
            await saveAndCharge(out.images[0], {
              status: 'fashn',
              modelOverride: opts.model_id,
              usage: {
                ai_model: `fashn/product-to-model/${out.cost.mode}-${out.cost.resolution}`,
                // FASHN's own credits, not the customer's , recorded so the
                // real cost of this path is visible next to what was charged.
                out_tok: out.cost.credits,
              },
            });
            return;
          } catch (e) {
            const msg = String((e as Error)?.message ?? e);
            console.error('[gen] FASHN failed , falling back', e);
            /* Logged, not just printed. A FASHN refusal used to reach the
               terminal only , the row that landed in Logs was the fallback's
               success, so the Logs tab said the shoot worked and never said
               which provider had actually declined it or why. */
            await logEvent({
              type: 'image',
              pid: o.pid,
              pose: o.pose,
              category,
              model: opts.model_id || '-',
              status: 'fashn_failed',
              cost: 0,
              file: '-',
              error: msg.slice(0, 300),
              user: opts.owner_email ?? '-',
            });
            // Deliberately falls through to the described-model path below,
            // the same as a Gemini refusal. r stays null.
          }
        }

        let r: Awaited<ReturnType<typeof produceAnchored>> = null;
        try {
          if (anchoredEngine !== FASHN_ENGINE) {
            r = await produceAnchored(heroPrompt(true), null, frontFrame, refBytes);
          }
        } catch (e) {
          // produceAnchored only swallows IMAGE_OTHER; IMAGE_SAFETY is thrown.
          // Both are refusals and both belong in the fallback below , anything
          // else is a real failure and must not be dressed up as one.
          const msg = String((e as Error)?.message ?? e);
          if (!msg.includes('SAFETY') && !msg.includes('IMAGE_OTHER')) throw e;
        }

        if (r) {
          await saveAndCharge(r.raw, {
            seedUsed: r.seed,
            attempt: r.attempt,
            modelOverride: opts.model_id,
            usage: r.usage,
          });
          return;
        }

        /*
         * The model's photograph was refused. Describe them instead.
         *
         * Measured, not guessed: across ten runs of the same garments, every
         * shoot that named a saved model came back IMAGE_SAFETY and every
         * shoot that described an imagined one succeeded , on the same image
         * model, with allow_revealing set and the same references. What the
         * filter objects to is being handed a photograph of an identifiable
         * person together with intimate apparel, not the clothes themselves.
         *
         * So the identity photo is dropped and the model is DESCRIBED instead ,
         * read off their own character sheet by a vision pass and cached. Words
         * are not refused the way a photograph is, and they carry far more of
         * the face than the three tags this used to fall back on. The customer
         * gets their shoot and a warning that the face is not exact.
         *
         * Confined to allow_revealing shoots on purpose. Everywhere else the
         * anchored path works, and a silent swap to a described model would
         * break the one promise a saved model makes.
         */
        if (allowRev) {
          const described = await savedModelWho(opts.model_id);
          if (described) {
            const out = await produce({
              prompt: heroPrompt(false, described),
              refs: refBytes,
              seed: shoot.seed,
              ar,
              allowRevealing: allowRev,
              pose: o.pose,
              // Admin's engine for this shoot type, or the environment's
              // default. Never the FASHN sentinel , that is not a Gemini id.
              modelId: engine === FASHN_ENGINE ? undefined : engine,
              imageSize: res,
            });
            await saveAndCharge(out.image, {
              warn: DESCRIBED_MODEL_WARN,
              status: 'described_model',
              modelOverride: opts.model_id,
              usage: { ...out.usage },
            });
            return;
          }
        }

        pushResult(o.jobId, { pose: o.pose, error: POLICY_MSG, policy: true });
        return;
      }

      const out = await produce({
        prompt: heroPrompt(false),
        refs: refBytes,
        seed: shoot.seed,
        ar,
        allowRevealing: allowRev,
        pose: o.pose,
        // Admin's engine for this shoot type, or the environment's default.
        // Never the FASHN sentinel , that is not a Gemini id.
        modelId: engine === FASHN_ENGINE ? undefined : engine,
        imageSize: res,
      });
      await saveAndCharge(out.image, { usage: { ...out.usage } });
      return;
    }

    // ── hero, anchored to a saved model ──
    if (o.isHero && opts.model_id) {
      const frontFrame = await latestCharsheetFrontFrame(opts.model_id);
      if (!frontFrame) {
        pushResult(o.jobId, {
          pose: o.pose,
          error: 'Selected model has no character sheet , generate one first.',
        });
        return;
      }
      const r = await produceAnchored(
        buildSavedModelHeroPrompt(o.pose, fr, category, opts.scene ?? ''),
        garmentBytes,
        frontFrame,
      );
      if (!r) {
        pushResult(o.jobId, { pose: o.pose, error: POLICY_MSG, policy: true });
      } else {
        await saveAndCharge(r.raw, {
          seedUsed: r.seed,
          attempt: r.attempt,
          modelOverride: opts.model_id,
          usage: r.usage,
        });
      }
      return;
    }

    // ── hero with an imagined model (or a first image with no hero yet) ──
    if (o.isHero || !heroBytes) {
      const out = await produce({
        prompt: buildPrompt({
          style: opts.style,
          scene: opts.scene,
          framing: fr,
          pose: o.pose,
          category,
          recast,
          look,
          traits: opts.model_traits,
          fromOnModel: true,
        }),
        garment: garmentBytes,
        hero: null,
        seed: shoot.seed,
        ar,
        allowRevealing: allowRev,
        pose: o.pose,
        // Admin's engine for this shoot type, or the environment's default.
        // Never the FASHN sentinel , that is not a Gemini id.
        modelId: engine === FASHN_ENGINE ? undefined : engine,
        imageSize: res,
      });
      await saveAndCharge(out.image, { usage: { ...out.usage } });
      return;
    }

    // ── extra pose on a saved-model shoot ──
    if (opts.model_id) {
      const r = await produceAnchored(
        buildPosePrompt(o.pose, fr, o.scene ?? '', poseRefDescs),
        null,
        heroBytes,
        poseRefs,
      );
      if (!r) {
        pushResult(o.jobId, { pose: o.pose, error: POLICY_MSG, policy: true });
      } else {
        await saveAndCharge(r.raw, {
          seedUsed: r.seed,
          attempt: r.attempt,
          modelOverride: opts.model_id,
          usage: r.usage,
        });
      }
      return;
    }

    // ── extra pose on an imagined-model shoot ──
    try {
      const out = await produce({
        prompt: buildPosePrompt(o.pose, fr, o.scene ?? '', poseRefDescs),
        refs: poseRefs,
        garment: null,
        hero: heroBytes,
        seed: shoot.seed,
        ar,
        allowRevealing: allowRev,
        pose: o.pose,
        tries: 3,
        // Admin's engine for this shoot type, or the environment's default.
        // Never the FASHN sentinel , that is not a Gemini id.
        modelId: engine === FASHN_ENGINE ? undefined : engine,
        imageSize: res,
      });
      await saveAndCharge(out.image, { usage: { ...out.usage } });
    } catch (e) {
      const msg = String((e as Error)?.message ?? e);
      if (!msg.includes('IMAGE_OTHER')) throw e;

      if (recast) {
        await logEvent({
          type: 'image',
          pid: o.pid,
          seed: shoot.seed,
          pose: o.pose,
          category,
          model: opts.style ?? '-',
          status: 'blocked',
          cost: 0,
          file: '-',
          error: msg,
          user: opts.owner_email ?? '-',
        });
        pushResult(o.jobId, {
          pose: o.pose,
          error:
            "This garment can't be re-cast onto a new model. Try the on-model or Extend option instead.",
          // Also a refusal: the same garment through the same path is refused
            // every time, so Retry would only spend attempts proving it.
            policy: true,
          });
        return;
      }

      // Consistency fallback: regenerate from the garment instead of the hero.
      // The pose lands, but the model may drift , hence the warning badge.
      const out = await produce({
        prompt: buildPrompt({
          style: opts.style,
          scene: opts.scene,
          framing: fr,
          pose: o.pose,
          category,
          recast,
          look,
          traits: opts.model_traits,
          fromOnModel: true,
        }),
        garment: garmentBytes,
        hero: null,
        seed: shoot.seed,
        ar,
        allowRevealing: allowRev,
        pose: o.pose,
        // Admin's engine for this shoot type, or the environment's default.
        // Never the FASHN sentinel , that is not a Gemini id.
        modelId: engine === FASHN_ENGINE ? undefined : engine,
        imageSize: res,
      });
      await saveAndCharge(out.image, {
        warn: 'model may vary (consistency fallback)',
        usage: { ...out.usage },
      });
    }
  } catch (e) {
    const msg = String((e as Error)?.message ?? e);
    /*
     * A content refusal reaching this far is still a refusal.
     *
     * The saved-model branches catch IMAGE_OTHER themselves and push the policy
     * card, but the imagined-model hero , by far the most common shoot , has no
     * catch of its own, and the consistency fallback can throw one too. Both
     * used to land on the generic "tap Retry", which is the one thing that will
     * never work: three attempts have already been refused inside produce(), so
     * every press spends three more calls proving it again.
     *
     * SAFETY is included deliberately. It is the HARD block , produce() does not
     * even retry it , so offering Retry there was wronger still.
     */
    const refused = msg.includes('IMAGE_OTHER') || msg.includes('SAFETY');
    await logEvent({
      type: 'image',
      pid: o.pid,
      seed: shoot.seed,
      pose: o.pose,
      category,
      model: opts.model_id || opts.style || '-',
      status: refused ? 'blocked' : 'error',
      cost: 0,
      file: '-',
      error: msg,
      user: opts.owner_email ?? '-',
    });
    if (refused) {
      pushResult(o.jobId, { pose: o.pose, error: POLICY_MSG, policy: true });
      return;
    }
    pushResult(o.jobId, {
      pose: o.pose,
      // Still generic for a genuine failure , a timeout or a rate limit really
      // can come good on a second press.
      error: msg.includes('blocked')
        ? "This pose couldn't be generated right now , tap Retry."
        : msg,
    });
  }
}

// ── job entry points ────────────────────────────────────────────────

/** Start a brand-new shoot: create the record, then generate the hero. */
export async function runProduct(
  jobId: string,
  pid: string,
  shoot: ShootDoc,
  garmentBytes: Buffer,
): Promise<void> {
  patchJob(jobId, { seed: shoot.seed, no: shoot.no, shoot: shootNoStr(shoot.no) });

  if (shoot.opts.input_family === 'extend') {
    // "Extend" uploads a photo that ALREADY shows the model , it becomes the
    // hero directly, no generation and no charge for that first image.
    const hname = `hero_${uniq()}.jpg`;
    const hkey = shootKey(pid, hname);
    await storage.put(hkey, garmentBytes);
    await writeDerivatives(hkey, garmentBytes);
    await updateShoot(pid, { hero_file: hname });
    await pushManifest(pid, { file: hname, pose: 'uploaded base' });

    const { looksHeadless } = await import('./images');
    if (await looksHeadless(garmentBytes)) {
      await genOneImage({ jobId, pid, pose: 'head completed', isHero: true, headComplete: true });
    } else {
      await logEvent({
        type: 'image',
        pid,
        shoot: shootNoStr(shoot.no),
        seed: shoot.seed,
        pose: 'uploaded base',
        category: shoot.opts.category,
        model: shoot.opts.style ?? '-',
        status: 'uploaded',
        cost: 0,
        file: `${shootNoStr(shoot.no)}_uploaded_base.jpg`,
        img: shootUrl(pid, hname),
        user: shoot.opts.owner_email ?? '-',
      });
      pushResult(jobId, { pose: 'uploaded base', img: shootUrl(pid, hname), cost: 0 });
    }
  } else {
    await genOneImage({ jobId, pid, pose: 'standing front', isHero: true });
  }

  finishJob(jobId, pid);
}

/** Add a single extra pose to an existing shoot. */
export async function runOne(
  jobId: string,
  pid: string,
  pose: string,
  framing: string | null,
  aspect: string | null,
  scene: string | null,
  settings: PerImageSettings | null,
  resolution: string | null,
): Promise<void> {
  await genOneImage({
    jobId,
    pid,
    pose,
    isHero: false,
    framing,
    aspect,
    scene,
    settings,
    resolution,
  });
  finishJob(jobId, pid);
}

export interface BatchRow {
  pose?: string;
  framing?: string;
  aspect?: string;
  scene?: string;
  backdrop?: string;
  mood?: string;
  lighting?: string;
  resolution?: string;
}

/**
 * Run a planned batch. Deliberately SEQUENTIAL with a pause between images:
 * firing 10 image calls at once reliably trips Gemini's rate limiter, and
 * results stream into the UI one at a time anyway.
 */
export async function runBatch(jobId: string, pid: string, rows: BatchRow[]): Promise<void> {
  const { PROVIDER } = await import('./config');

  for (const r of rows) {
    await genOneImage({
      jobId,
      pid,
      pose: r.pose || 'pose',
      isHero: false,
      framing: r.framing ?? null,
      aspect: r.aspect ?? null,
      scene: r.scene || null,
      settings: {
        backdrop: r.backdrop || '',
        mood: r.mood || '',
        lighting: r.lighting || '',
      },
      resolution: normaliseResolution(r.resolution) === '1K' && !r.resolution ? null : (r.resolution ?? null),
    });
    await sleep(PROVIDER === 'mock' ? 300 : 2000);
  }

  finishJob(jobId, pid);
}

/** Pick a per-shoot appearance phrase so two shoots never look identical. */
export function pickLook(category: string): string {
  const gender = GENDER_BY_CAT[category] ?? 'female';
  if (gender === 'child') return '';
  const pool = gender === 'male' ? MALE_LOOKS : LOOKS;
  return pool[Math.floor(Math.random() * pool.length)];
}

export { randSeed, uniq };