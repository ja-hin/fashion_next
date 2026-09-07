/**
 * The video studio's shot briefs.
 *
 * Ported from the Omni video studio tester (omni_config.py). Each preset is a
 * complete brief the video model receives as JSON, plus a one-line `gist` that
 * is the only part a customer reads.
 *
 * The briefs are data, not prompts assembled at call time, because the Genie
 * edits them slot by slot , see lib/video.ts. Keeping them as plain objects is
 * what lets "make it sunset" change `background` and leave the shot list alone.
 */

/**
 * The reference lock. Baked into every preset's prompt and never editable , it
 * is the whole reason a video keeps the model's face and the garment from the
 * stills it was built from. The Genie is told in its system prompt not to touch
 * it, and lib/video.ts re-checks that it survived before generating.
 */
export const REFERENCE_LOCK =
  'Use the reference images ONLY for the model\'s identity and the exact garment appearance. ' +
  'Keep the same model and the same garment perfectly consistent throughout. ' +
  'No additional people, no changes to the model\'s identity, no changes to the garment, ' +
  'no text, no logos, no distortion.';

/** The camera direction inside a brief. */
export interface VideoCamera {
  movement: string;
  transitions: string;
  framing: string;
}

/** One complete brief, as the model receives it. */
export interface VideoBrief {
  duration: string;
  style: string;
  background: string;
  prompt: string;
  camera: VideoCamera;
  music: string;
  quality: string;
}

export interface VideoPreset {
  label: string;
  desc: string;
  /** One plain line describing the plan. The only part a customer reads. */
  gist: string;
  brief: VideoBrief;
}

export const VIDEO_PRESETS: Record<string, VideoPreset> = {
  studio_pdp: {
    label: 'Studio PDP',
    desc: 'Clean e-commerce product video',
    gist: 'Studio PDP · clean seamless backdrop · slow turns + detail push-in · soft music',
    brief: {
      duration: '10 seconds',
      style: 'clean studio e-commerce product video',
      background: 'clean seamless studio backdrop with soft even lighting',
      prompt:
        'Create a polished 10-second fashion video. ' +
        REFERENCE_LOCK +
        ' Set on a clean seamless studio backdrop with soft even lighting. 0-3s: full-body '
        + 'front view, model makes a slow quarter turn. 3-6s: three-quarter and side views '
        + 'showing garment fit and silhouette. 6-8s: smooth close-up push-in on the garment\'s '
        + 'key detail. 8-10s: model returns to a clean front pose, gentle push-in, clean ending. '
        + 'Bright accurate catalogue lighting, true-to-life colour, sharp detail, minimal '
        + 'distracting motion. catalogue-quality, photorealistic, true-to-life colour Soft '
        + 'subtle background music. The music resolves and fades out smoothly over the final '
        + 'second (9-10s), landing on a clean final beat exactly as the last shot settles, then '
        + 'silence.',
      camera: {
        movement: 'slow, smooth, stable turns and a gentle detail push-in',
        transitions: 'clean simple cuts',
        framing: 'full-body, three-quarter, side, and close-up detail',
      },
      music: 'Soft subtle background music',
      quality: 'catalogue-quality, photorealistic, true-to-life colour',
    },
  },
  editorial: {
    label: 'Editorial',
    desc: 'Fast-cut premium campaign film',
    gist: 'Editorial fashion film · fast cinematic cuts · full-body to detail shots · upbeat music',
    brief: {
      duration: '10 seconds',
      style: 'fast-paced premium editorial fashion film',
      background: 'clean premium editorial set',
      prompt:
        'Create a polished 10-second fashion video. ' +
        REFERENCE_LOCK +
        ' 0-2s: striking full-body entrance with a quick forward camera push. 2-4s: dynamic '
        + 'three-quarter angle highlighting silhouette and fit. 4-6s: close-up detail shot with '
        + 'a fast cinematic sweep across the garment. 6-8s: model turns with a subtle confident '
        + 'movement as the camera arcs around. 8-10s: strong final full-body editorial pose with '
        + 'a quick push-in and clean ending. Premium editorial lighting, sophisticated '
        + 'composition, realistic fabric movement, seamless transitions, high-end campaign '
        + 'aesthetic. high-end cinematic, photorealistic, polished campaign Fast-paced upbeat '
        + 'premium fashion beat synchronized with the cuts. The music resolves and fades out '
        + 'smoothly over the final second (9-10s), landing on a clean final beat exactly as the '
        + 'last shot settles, then silence.',
      camera: {
        movement: 'fast, smooth cinematic push-ins, arcs, sweeps and subtle tracking',
        transitions: 'quick seamless editorial cuts',
        framing: 'full-body, three-quarter and close-up detail',
      },
      music: 'Fast-paced upbeat premium fashion beat synchronized with the cuts',
      quality: 'high-end cinematic, photorealistic, polished campaign',
    },
  },
  on_location: {
    label: 'On-location',
    desc: 'Model in a real setting (change the world)',
    gist: 'On-location lifestyle · stylish sunlit city street · natural relaxed motion · warm upbeat music',
    brief: {
      duration: '10 seconds',
      style: 'premium lifestyle fashion film on location',
      background: 'a stylish sunlit city street on a bright day',
      prompt:
        'Create a polished 10-second fashion video. ' +
        REFERENCE_LOCK +
        ' Set on a stylish sunlit city street on a bright day. 0-2s: full-body entrance '
        + 'walking into frame with a forward camera push. 2-4s: three-quarter tracking shot '
        + 'alongside the model showing the outfit in motion. 4-6s: close-up detail sweep across '
        + 'the garment as she moves. 6-8s: the model turns with a natural confident movement, '
        + 'camera arcs around. 8-10s: relaxed final full-body pose, gentle push-in, clean '
        + 'ending. Natural warm daylight, cinematic depth, realistic fabric movement in the '
        + 'breeze. photorealistic, cinematic, premium street-style campaign Warm upbeat '
        + 'lifestyle track synced to the cuts. The music resolves and fades out smoothly over '
        + 'the final second (9-10s), landing on a clean final beat exactly as the last shot '
        + 'settles, then silence.',
      camera: {
        movement: 'smooth tracking, arcs and push-ins with natural handheld energy',
        transitions: 'quick seamless cuts',
        framing: 'full-body, three-quarter tracking and close-up',
      },
      music: 'Warm upbeat lifestyle track synced to the cuts',
      quality: 'photorealistic, cinematic, premium street-style campaign',
    },
  },
  detail: {
    label: 'Detail / Fabric',
    desc: 'Macro on texture, drape and print',
    gist: 'Detail / fabric · macro on texture and drape · slow elegant sweeps · minimal music',
    brief: {
      duration: '10 seconds',
      style: 'close-up fabric and detail film',
      background: 'soft neutral studio background',
      prompt:
        'Create a polished 10-second fashion video. ' +
        REFERENCE_LOCK +
        ' Set on a soft neutral studio background, focused on fabric, print, texture and '
        + 'drape. 0-3s: slow macro sweep across the print and texture. 3-6s: the fabric moves '
        + 'and drapes gently as the model makes a small movement. 6-8s: close-up on a key detail '
        + '(edge, seam, print motif). 8-10s: pull back to a three-quarter view of the garment on '
        + 'the model, clean ending. Soft directional light that reveals texture, shallow depth '
        + 'of field. tactile, photorealistic, refined product detail Minimal ambient background '
        + 'music. The music resolves and fades out smoothly over the final second (9-10s), '
        + 'landing on a clean final beat exactly as the last shot settles, then silence.',
      camera: {
        movement: 'slow elegant macro sweeps and a gentle pull-back',
        transitions: 'soft dissolves and clean cuts',
        framing: 'extreme close-up and detail, ending three-quarter',
      },
      music: 'Minimal ambient background music',
      quality: 'tactile, photorealistic, refined product detail',
    },
  },
  turntable: {
    label: 'Turntable / 360',
    desc: 'Clean product-forward rotation',
    gist: 'Turntable · clean 360 rotation · product-forward · steady studio light',
    brief: {
      duration: '10 seconds',
      style: 'clean product turntable',
      background: 'clean seamless studio backdrop',
      prompt:
        'Create a polished 10-second fashion video. ' +
        REFERENCE_LOCK +
        ' Set on a seamless studio backdrop. The camera slowly and steadily orbits a full 360 '
        + 'degrees around the model, keeping the full outfit in frame the whole time, with one '
        + 'brief gentle push-in on the garment detail around 5-6s before continuing the '
        + 'rotation. Even bright studio lighting, true colours, sharp detail, minimal model '
        + 'movement, product-forward. catalogue-quality, photorealistic, product-forward Soft '
        + 'subtle background music. The music resolves and fades out smoothly over the final '
        + 'second (9-10s), landing on a clean final beat exactly as the last shot settles, then '
        + 'silence.',
      camera: {
        movement: 'steady slow 360-degree orbit with one brief detail push-in',
        transitions: 'continuous, single flowing shot',
        framing: 'full-body throughout, brief close-up',
      },
      music: 'Soft subtle background music',
      quality: 'catalogue-quality, photorealistic, product-forward',
    },
  },
  runway: {
    label: 'Runway / Catwalk',
    desc: 'Confident walk toward camera, runway energy',
    gist: 'Runway walk · confident stride toward camera · dramatic light · bold beat',
    brief: {
      duration: '10 seconds',
      style: 'high-fashion runway film',
      background: 'a sleek runway with dramatic spotlighting and a dark backdrop',
      prompt:
        'Create a polished 10-second fashion video. ' +
        REFERENCE_LOCK +
        ' Set on a sleek runway with dramatic spotlighting. 0-3s: model walks toward camera '
        + 'with a confident runway stride, garment moving with each step. 3-6s: camera tracks '
        + 'the walk from a slightly low angle, emphasising the silhouette. 6-8s: model reaches '
        + 'the camera and strikes a strong pose, quick detail push-in. 8-10s: model turns and '
        + 'walks away revealing the back of the outfit, clean ending. Dramatic directional '
        + 'runway lighting. high-fashion, cinematic, photorealistic Bold confident runway beat. '
        + 'The music resolves and fades out smoothly over the final second (9-10s), landing on a '
        + 'clean final beat exactly as the last shot settles, then silence.',
      camera: {
        movement: 'tracking toward and with the model, low confident angles',
        transitions: 'bold clean cuts',
        framing: 'full-body walk, strong pose, back reveal',
      },
      music: 'Bold confident runway beat',
      quality: 'high-fashion, cinematic, photorealistic',
    },
  },
  reel: {
    label: 'Instagram Reel',
    desc: 'Trendy fast social-first vertical',
    gist: 'Instagram reel · trendy rapid cuts · high energy · punchy trending beat',
    brief: {
      duration: '10 seconds',
      style: 'trendy social-media fashion reel',
      background: 'a vibrant, colourful trendy backdrop',
      prompt:
        'Create a polished 10-second fashion video. ' +
        REFERENCE_LOCK +
        ' Set against a vibrant trendy backdrop. A high-energy rapid-fire sequence: every '
        + '1.5-2 seconds cut to a new dynamic angle or pose of the model in the outfit - '
        + 'full-body, three-quarter, spin, detail, hero pose. Snappy, punchy, social-first '
        + 'energy with bold pops of colour and crisp transitions. vibrant, crisp, social-media '
        + 'polished High-energy punchy trending beat synced to every cut. The music resolves and '
        + 'fades out smoothly over the final second (9-10s), landing on a clean final beat '
        + 'exactly as the last shot settles, then silence.',
      camera: {
        movement: 'fast whip pans, quick snappy cuts, dynamic angles',
        transitions: 'rapid punchy cuts every 1.5-2s',
        framing: 'rapid mix of full-body, spin, detail and hero',
      },
      music: 'High-energy punchy trending beat synced to every cut',
      quality: 'vibrant, crisp, social-media polished',
    },
  },
  slowmo: {
    label: 'Slow-mo Glam',
    desc: 'Luxurious slow motion, fabric & hair flow',
    gist: 'Slow-mo glam · luxurious slow motion · flowing fabric and hair · elegant score',
    brief: {
      duration: '10 seconds',
      style: 'luxurious slow-motion glamour film',
      background: 'an elegant softly-lit luxe setting',
      prompt:
        'Create a polished 10-second fashion video. ' +
        REFERENCE_LOCK +
        ' Set in an elegant softly-lit luxe setting. Everything unfolds in graceful slow '
        + 'motion: 0-4s hair and fabric flow as the model makes a slow elegant turn. 4-7s a slow '
        + 'reveal of the garment\'s drape and movement. 7-10s a slow push-in to a poised, '
        + 'glamorous final pose. Dreamy soft lighting, luxurious mood, silky fabric motion. '
        + 'luxurious, dreamy, photorealistic Elegant cinematic slow score. The music resolves '
        + 'and fades out smoothly over the final second (9-10s), landing on a clean final beat '
        + 'exactly as the last shot settles, then silence.',
      camera: {
        movement: 'slow smooth glides and push-ins in slow motion',
        transitions: 'slow graceful dissolves',
        framing: 'flowing full-body and elegant close-ups',
      },
      music: 'Elegant cinematic slow score',
      quality: 'luxurious, dreamy, photorealistic',
    },
  },
  golden_hour: {
    label: 'Golden Hour',
    desc: 'Warm cinematic sunset, aspirational',
    gist: 'Golden hour · warm sunset backlight · dreamy aspirational lifestyle · warm uplifting track',
    brief: {
      duration: '10 seconds',
      style: 'aspirational golden-hour lifestyle film',
      background: 'a beautiful outdoor location at golden-hour sunset with warm backlight',
      prompt:
        'Create a polished 10-second fashion video. ' +
        REFERENCE_LOCK +
        ' Set outdoors at golden hour with warm sunset backlight and gentle lens flares. 0-3s: '
        + 'model walks into the warm light with a natural, aspirational ease. 3-6s: '
        + 'three-quarter tracking as the light catches the garment. 6-8s: close-up detail '
        + 'glowing in the warm light. 8-10s: serene final full-body pose against the sunset, '
        + 'clean ending. Warm cinematic backlighting, dreamy aspirational mood. cinematic, warm, '
        + 'photorealistic, aspirational Warm dreamy uplifting track. The music resolves and '
        + 'fades out smoothly over the final second (9-10s), landing on a clean final beat '
        + 'exactly as the last shot settles, then silence.',
      camera: {
        movement: 'smooth cinematic tracking and push-ins, backlit',
        transitions: 'soft warm cuts',
        framing: 'full-body, three-quarter tracking, glowing detail',
      },
      music: 'Warm dreamy uplifting track',
      quality: 'cinematic, warm, photorealistic, aspirational',
    },
  },
  festive: {
    label: 'Festive / Occasion',
    desc: 'Celebration setting, warm & ornate',
    gist: 'Festive occasion · warm celebration setting with soft lights · elegant festive mood · warm celebratory music',
    brief: {
      duration: '10 seconds',
      style: 'festive occasion-wear film',
      background: 'a warm festive celebration setting with soft decorative bokeh lights',
      prompt:
        'Create a polished 10-second fashion video. ' +
        REFERENCE_LOCK +
        ' Set in a warm festive celebration setting with soft glowing decorative lights '
        + '(bokeh). 0-3s: elegant full-body entrance suited to a festive occasion. 3-6s: '
        + 'graceful three-quarter movement showing the outfit\'s flow and ornamentation. 6-8s: '
        + 'close-up on the garment\'s festive detail and embellishment. 8-10s: confident, '
        + 'celebratory final full-body pose, gentle push-in, clean ending. Warm ornate lighting, '
        + 'rich festive mood. rich, warm, photorealistic, occasion-ready Warm celebratory '
        + 'festive track. The music resolves and fades out smoothly over the final second '
        + '(9-10s), landing on a clean final beat exactly as the last shot settles, then silence.',
      camera: {
        movement: 'elegant smooth arcs and push-ins',
        transitions: 'warm graceful cuts',
        framing: 'full-body, three-quarter, festive detail',
      },
      music: 'Warm celebratory festive track',
      quality: 'rich, warm, photorealistic, occasion-ready',
    },
  },
  street_style: {
    label: 'Street Style',
    desc: 'Edgy urban, dynamic and cool',
    gist: 'Street style · edgy urban backdrop · dynamic cool motion · modern beat',
    brief: {
      duration: '10 seconds',
      style: 'edgy urban street-style film',
      background: 'a graphic urban street with bold architecture',
      prompt:
        'Create a polished 10-second fashion video. ' +
        REFERENCE_LOCK +
        ' Set on a graphic urban street with bold architecture. 0-2s: bold full-body entrance '
        + 'with attitude and a quick camera push. 2-4s: dynamic low-angle three-quarter shot. '
        + '4-6s: sharp close-up detail with a fast sweep. 6-8s: model moves with confident cool '
        + 'attitude, camera whips around. 8-10s: strong final urban hero pose, clean ending. '
        + 'High-contrast urban light, edgy cool aesthetic. edgy, high-contrast, photorealistic '
        + 'Cool modern urban beat. The music resolves and fades out smoothly over the final '
        + 'second (9-10s), landing on a clean final beat exactly as the last shot settles, then '
        + 'silence.',
      camera: {
        movement: 'dynamic handheld energy, bold angles, quick whips',
        transitions: 'sharp modern cuts',
        framing: 'bold full-body, low-angle, sharp detail',
      },
      music: 'Cool modern urban beat',
      quality: 'edgy, high-contrast, photorealistic',
    },
  },
  spotlight: {
    label: 'Studio Spotlight',
    desc: 'Dark studio, dramatic spotlight, luxe',
    gist: 'Studio spotlight · dark dramatic backdrop · high-contrast luxe · cinematic score',
    brief: {
      duration: '10 seconds',
      style: 'dramatic spotlight studio film',
      background: 'a dark studio with a single dramatic spotlight and deep shadows',
      prompt:
        'Create a polished 10-second fashion video. ' +
        REFERENCE_LOCK +
        ' Set in a dark studio with a single dramatic spotlight and deep shadows. 0-3s: model '
        + 'emerges from shadow into the spotlight, full-body, slow reveal. 3-6s: the light rakes '
        + 'across the garment as the model turns, high contrast. 6-8s: dramatic close-up detail '
        + 'catching the light. 8-10s: powerful final pose in the spotlight, slow push-in, clean '
        + 'ending. Moody high-key-on-black lighting, luxe and cinematic. luxe, high-contrast, '
        + 'photorealistic, cinematic Dramatic cinematic score. The music resolves and fades out '
        + 'smoothly over the final second (9-10s), landing on a clean final beat exactly as the '
        + 'last shot settles, then silence.',
      camera: {
        movement: 'slow dramatic push-ins and arcs in low-key light',
        transitions: 'moody clean cuts',
        framing: 'full-body reveal, raking detail, hero pose',
      },
      music: 'Dramatic cinematic score',
      quality: 'luxe, high-contrast, photorealistic, cinematic',
    },
  },
};

/**
 * The "describe your own" pseudo-preset.
 *
 * Not in VIDEO_PRESETS because it has no brief of its own , the brief is
 * written by the Genie from the customer's own description. This is its key on
 * the wire and the skeleton the authored brief is merged onto, so a model that
 * omits a slot still produces a complete brief rather than an undefined one.
 */
export const CUSTOM_KEY = 'custom';

export const CUSTOM_SKELETON: VideoBrief = {
  duration: '10 seconds',
  style: 'fashion video',
  background: 'as described',
  prompt: REFERENCE_LOCK,
  camera: {
    movement: 'smooth cinematic movement',
    transitions: 'clean cuts',
    framing: 'full-body, three-quarter and close-up detail',
  },
  music: 'Music suited to the scene',
  quality: 'photorealistic, cinematic',
};

/**
 * The lock for references that show the garment but nobody wearing it ,
 * flat-lays, packshots, a ghost mannequin.
 *
 * The default lock says "keep the same model", which is an instruction with no
 * referent when no model appears in any reference: the model is being asked to
 * hold constant something it was never shown. This one moves the guarantee onto
 * the garment, where the evidence actually is, and asks for one invented model
 * held consistent for the ten seconds instead.
 */
export const GARMENT_LOCK =
  'Use the reference images ONLY for the exact garment: its cut, colour, fabric, print and ' +
  'every detail must match them precisely. Dress ONE model in that exact garment and keep ' +
  'that same model and the same garment perfectly consistent for the whole video. ' +
  'No additional people, no changes to the garment, no text, no logos, no distortion.';

/** Which guarantee a brief carries, decided by what the references show. */
export type LockMode = 'model' | 'garment';

/**
 * The lock is the product guarantee, so it is enforced here rather than trusted
 * anywhere upstream: an authored brief never contains it (the model is not told
 * it), and an edited one can lose it to a careless rewrite. Prepended, so it
 * outranks anything the description asked for.
 *
 * Swapping , not just prepending , matters for garment mode: the twelve presets
 * have the on-model lock baked into their prompt text, so leaving it in beside
 * the garment lock would hand the model two contradictory instructions.
 */
export function withLock(brief: VideoBrief, mode: LockMode = 'model'): VideoBrief {
  const want = mode === 'garment' ? GARMENT_LOCK : REFERENCE_LOCK;
  const other = mode === 'garment' ? REFERENCE_LOCK : GARMENT_LOCK;

  let prompt = brief.prompt ?? '';
  if (prompt.includes(other)) prompt = prompt.split(other).join('').replace(/\s{2,}/g, ' ').trim();
  if (prompt.includes(want)) return prompt === brief.prompt ? brief : { ...brief, prompt };
  return { ...brief, prompt: want + ' ' + prompt };
}

export type VideoPresetKey = keyof typeof VIDEO_PRESETS;

export const VIDEO_PRESET_KEYS = Object.keys(VIDEO_PRESETS);

/** Vertical for social, horizontal for a PDP. Anything else is rejected. */
export const VIDEO_ASPECTS: Array<[string, string]> = [
  ['9:16', 'Vertical · 9:16'],
  ['16:9', 'Horizontal · 16:9'],
];

export const normaliseAspect = (v: string | null | undefined): string =>
  VIDEO_ASPECTS.some(([a]) => a === v) ? (v as string) : '9:16';
