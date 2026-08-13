'use client';

/**
 * The smoke burst behind the Genie summon.
 *
 * Imperative rather than React-rendered on purpose: these are ~20 throwaway
 * nodes that live for under a second and never re-render. Putting them in state
 * would mean a component re-render per particle per frame for something the
 * compositor can handle on its own.
 *
 * Everything animates transform / opacity / filter only, and no particle
 * carries a box-shadow — the glow comes from a bright gradient core instead.
 * That keeps the whole burst off the paint path, so the drawer sliding in at
 * the same moment stays smooth.
 */

const COLORS = [
  'rgba(178,150,255,.7)',
  'rgba(214,180,110,.6)',
  'rgba(255,255,255,.8)',
  'rgba(150,120,240,.65)',
  'rgba(196,160,255,.7)',
  'rgba(230,215,180,.6)',
];

/** Light enough that the burst never competes with the overlay's slide. */
const PARTICLES = 18;

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

const reduced = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function spawn(className: string, size: number, x: number, y: number): HTMLDivElement {
  const el = document.createElement('div');
  el.className = className;
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.style.left = `${x - size / 2}px`;
  el.style.top = `${y - size / 2}px`;
  document.body.appendChild(el);
  return el;
}

function puffs(x: number, y: number, gather: boolean) {
  for (let i = 0; i < PARTICLES; i++) {
    const size = rnd(34, 78);
    const el = spawn('genie-smoke', size, x, y);
    const col = COLORS[i % COLORS.length];
    el.style.background = `radial-gradient(circle at 50% 45%, ${col} 0%, ${col} 22%, transparent 68%)`;

    const ang = rnd(0, Math.PI * 2);
    const dist = rnd(40, 110);
    const dx = Math.cos(ang) * dist;
    // Drifting up on the way out reads as smoke; on the way in it converges.
    const dy = Math.sin(ang) * dist - (gather ? 0 : rnd(55, 100));

    const frames: Keyframe[] = gather
      ? [
          { transform: `translate(${dx}px,${dy - 20}px) scale(1.8)`, opacity: 0, filter: 'blur(10px)' },
          { transform: `translate(${dx * 0.4}px,${dy * 0.4}px) scale(1.15)`, opacity: 0.7, offset: 0.45, filter: 'blur(6px)' },
          { transform: 'translate(0px,8px) scale(.2)', opacity: 0, filter: 'blur(2px)' },
        ]
      : [
          { transform: 'translate(0,0) scale(.5)', opacity: 0, filter: 'blur(2px)' },
          { transform: `translate(${dx * 0.45}px,${dy * 0.45}px) scale(1.5)`, opacity: 0.9, offset: 0.3, filter: 'blur(5px)' },
          { transform: `translate(${dx}px,${dy}px) scale(3)`, opacity: 0, filter: 'blur(13px)' },
        ];

    el.animate(frames, {
      duration: gather ? rnd(680, 880) : rnd(1000, 1450),
      easing: gather ? 'ease-out' : 'cubic-bezier(.15,.6,.2,1)',
    }).onfinish = () => el.remove();
  }
}

function glowCore(x: number, y: number, gather: boolean) {
  const el = spawn('genie-glowcore', 190, x, y);
  const from: Keyframe = gather
    ? { transform: 'scale(1.8)', opacity: 0, filter: 'blur(14px)' }
    : { transform: 'scale(.25)', opacity: 0.9, filter: 'blur(4px)' };
  const to: Keyframe = gather
    ? { transform: 'scale(.3)', opacity: 0, filter: 'blur(4px)' }
    : { transform: 'scale(2.4)', opacity: 0, filter: 'blur(16px)' };

  el.animate([from, { opacity: gather ? 0.7 : 0.85, offset: 0.35 }, to], {
    duration: gather ? 640 : 760,
    easing: 'ease-out',
  }).onfinish = () => el.remove();
}

function shockRing(x: number, y: number) {
  const el = spawn('genie-ring', 120, x, y);
  el.animate(
    [
      { transform: 'scale(.2)', opacity: 0.6 },
      { transform: 'scale(2.8)', opacity: 0 },
    ],
    { duration: 680, easing: 'ease-out' },
  ).onfinish = () => el.remove();
}

/**
 * Burst smoke at a point on screen.
 *
 * `gather: false` scatters outward (Genie leaving), `true` converges inward
 * (Genie returning). A no-op under prefers-reduced-motion — the card still
 * appears and disappears, just without the theatre.
 */
export function smokeBurst(x: number, y: number, gather: boolean): void {
  if (reduced()) return;
  glowCore(x, y, gather);
  puffs(x, y, gather);
  if (!gather) shockRing(x, y);
}
