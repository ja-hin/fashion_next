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
 *   3. Charge-on-success — credits come off the wallet only after an image
 *      actually lands on disk.
 */
import 'server-only';
import crypto from 'node:crypto';
import { storage, shootKey, shootUrl } from './storage';
import { writeDerivatives } from './derivatives';
import { produce } from './gemini';
import { getShoot, updateShoot, pushManifest, shootFilePrefix } from './shoots';
import { latestCharsheetFrontFrame } from './saved-models';
import { adjustBalance, getBalance } from './auth';
import { getSettings, shootCost, normaliseResolution, shootNoStr, safeName } from './settings';
import { logEvent } from './logs';
import { pushResult, patchJob, finishJob } from './jobs';
import { BASE_MODEL_ID, HERO_MODEL_ID } from './config';
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

const ANCHOR_FAIL_MSG =
  "Couldn't place this garment on your saved model — try a different garment photo or retry.";

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
 * Always pushes exactly one job result — either an image or an error — so the
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

  // Extra poses are generated FROM the hero image — that's the consistency lock.
  let heroBytes: Buffer | null = null;
  if (shoot.hero_file && !o.isHero) {
    heroBytes = await storage.get(shootKey(o.pid, shoot.hero_file));
  }

  /**
   * Tagged references for whatever angle this pose reveals.
   *
   * The hero is a front shot, so it is authoritative for the front and nothing
   * more. Any pose that moves the camera — round the back, to a profile, in to
   * a detail — is asking for information the hero does not contain, and the
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
      // A close-up wants the label too — that is where print and lettering are.
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
    // Build the display copies now, while the user is still watching the job —
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
      status: extra.warn ? 'fallback' : (extra.status ?? 'success'),
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
   * reference up to 3 attempts — it never swaps to an imagined model, because
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
    // lighter flash-lite model to keep cost down.
    const aiModel = o.isHero ? HERO_MODEL_ID : BASE_MODEL_ID;
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
    // receives one garment — a multi-reference shoot falling into it would
    // silently use the first image and drop the rest.
    //
    // Only the hero differs. Once it lands it is an ordinary hero, and every
    // later pose is generated from it like any other shoot — which is what
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
        // slot — the prompt numbers them positionally, so a silent shift would
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

      /** Same shape either way; only the wording and the role list differ. */
      const heroPrompt = (anchored: boolean) =>
        refMode === 'ensemble'
          ? buildEnsemblePrompt({
              roles: roles as EnsembleRole[],
              who: anchored
                ? ''
                : child
                  ? 'a young child fashion model, age-appropriate and fully clothed'
                  : stylePhrase(opts.style, gender, look),
              scene: opts.scene ?? '',
              framing: FRAMING[fr] ?? FRAMING.three_quarter,
              anchored,
              child,
            })
          : buildSameGarmentPrompt({
              roles: roles as GarmentRole[],
              who: anchored
                ? ''
                : child
                  ? 'a young child fashion model, age-appropriate and fully clothed'
                  : stylePhrase(opts.style, gender, look),
              scene: opts.scene ?? '',
              framing: FRAMING[fr] ?? FRAMING.three_quarter,
              anchored,
              child,
            });

      // A saved model anchors the face: its character-sheet frame goes in after
      // the references, so the prompt can call it "Image N+1".
      if (opts.model_id) {
        const frontFrame = await latestCharsheetFrontFrame(opts.model_id);
        if (!frontFrame) {
          pushResult(o.jobId, {
            pose: o.pose,
            error: 'Selected model has no character sheet — generate one first.',
          });
          return;
        }

        const r = await produceAnchored(heroPrompt(true), null, frontFrame, refBytes);
        if (!r) {
          pushResult(o.jobId, { pose: o.pose, error: ANCHOR_FAIL_MSG });
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

      const out = await produce({
        prompt: heroPrompt(false),
        refs: refBytes,
        seed: shoot.seed,
        ar,
        allowRevealing: allowRev,
        pose: o.pose,
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
          error: 'Selected model has no character sheet — generate one first.',
        });
        return;
      }
      const r = await produceAnchored(
        buildSavedModelHeroPrompt(o.pose, fr, category, opts.scene ?? ''),
        garmentBytes,
        frontFrame,
      );
      if (!r) {
        pushResult(o.jobId, { pose: o.pose, error: ANCHOR_FAIL_MSG });
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
          fromOnModel: true,
        }),
        garment: garmentBytes,
        hero: null,
        seed: shoot.seed,
        ar,
        allowRevealing: allowRev,
        pose: o.pose,
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
        pushResult(o.jobId, { pose: o.pose, error: ANCHOR_FAIL_MSG });
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
        });
        return;
      }

      // Consistency fallback: regenerate from the garment instead of the hero.
      // The pose lands, but the model may drift — hence the warning badge.
      const out = await produce({
        prompt: buildPrompt({
          style: opts.style,
          scene: opts.scene,
          framing: fr,
          pose: o.pose,
          category,
          recast,
          look,
          fromOnModel: true,
        }),
        garment: garmentBytes,
        hero: null,
        seed: shoot.seed,
        ar,
        allowRevealing: allowRev,
        pose: o.pose,
        imageSize: res,
      });
      await saveAndCharge(out.image, {
        warn: 'model may vary (consistency fallback)',
        usage: { ...out.usage },
      });
    }
  } catch (e) {
    const msg = String((e as Error)?.message ?? e);
    const nice = msg.includes('blocked')
      ? "This pose couldn't be generated right now — tap Retry."
      : msg;
    await logEvent({
      type: 'image',
      pid: o.pid,
      seed: shoot.seed,
      pose: o.pose,
      category,
      model: opts.model_id || opts.style || '-',
      status: 'error',
      cost: 0,
      file: '-',
      error: msg,
      user: opts.owner_email ?? '-',
    });
    pushResult(o.jobId, { pose: o.pose, error: nice });
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
    // "Extend" uploads a photo that ALREADY shows the model — it becomes the
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