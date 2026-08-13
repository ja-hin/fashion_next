'use client';

import { useEffect, useRef, useState } from 'react';
import { smokeBurst } from '@/lib/client/smoke';
import { GenieIcon } from './icons';

/** Timings mirror the animation durations in globals.css. */
const OVERLAY_LAG = 150; // let the poof start before the drawer sweeps in
const POOF_MS = 470; // vanish finished — safe to hide
const REFORM_LAG = 150; // let the drawer clear before Genie comes back
const MATERIALIZE_MS = 640;

type Phase = 'idle' | 'poof' | 'hidden' | 'materialize';

/**
 * The floating "Ask Genie" tile beside "Add pose" — and the summon it performs.
 *
 * Clicking it does not simply open a panel: the card bursts into smoke, the
 * drawer sweeps in behind it, and closing the drawer re-forms the card out of
 * the same smoke gathering back together. The two halves are one gesture, which
 * is why the card owns the whole sequence and only needs to be told whether the
 * drawer is currently open.
 *
 * All of it degrades: under prefers-reduced-motion the particles are skipped
 * and the CSS transitions are switched off, so the card just goes and returns.
 */
export default function GenieCard({
  open,
  onClick,
}: {
  /** Whether the Genie drawer is showing. Falling to false re-forms the card. */
  open: boolean;
  onClick: () => void;
}) {
  const cardRef = useRef<HTMLButtonElement>(null);
  const [phase, setPhase] = useState<Phase>('idle');

  // Every step is a timeout, and the user can navigate away mid-sequence — so
  // they are tracked and cleared rather than left to fire into a dead tree.
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const after = (ms: number, fn: () => void) => {
    timers.current.push(setTimeout(fn, ms));
  };
  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    },
    [],
  );

  /** Centre of the card in viewport coords — where the smoke comes from. */
  function centre() {
    const r = cardRef.current?.getBoundingClientRect();
    return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: 0, y: 0 };
  }

  function summon() {
    if (phase !== 'idle' || open) return;
    const { x, y } = centre();

    setPhase('poof');
    smokeBurst(x, y, false);
    after(OVERLAY_LAG, onClick);
    after(POOF_MS, () => setPhase('hidden'));
  }

  // The drawer closing is the cue to come back. Driven off the `open` prop
  // rather than the close button so it also fires on Escape and backdrop click.
  useEffect(() => {
    if (open || phase !== 'hidden') return;

    after(REFORM_LAG, () => {
      // Measured while still hidden — `visibility: hidden` keeps the slot in
      // layout, so the centre is the same point the smoke left from.
      const { x, y } = centre();
      setPhase('materialize');
      smokeBurst(x, y, true);
      after(MATERIALIZE_MS, () => setPhase('idle'));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, phase]);

  const stateClass =
    phase === 'poof'
      ? 'is-poof'
      : phase === 'hidden'
        ? 'is-hidden'
        : phase === 'materialize'
          ? 'is-materialize'
          : '';

  return (
    // The outer slot keeps a fixed footprint in the flex row. Without it the
    // bobbing card would drag its neighbours up and down with it, and the grid
    // would reflow the moment Genie vanished.
    <div className="flex w-[212px] flex-shrink-0 items-center justify-center self-center py-4">
      <button
        ref={cardRef}
        onClick={summon}
        aria-hidden={phase === 'hidden'}
        tabIndex={phase === 'hidden' ? -1 : undefined}
        title="Ask Genie — describe a shot, build a catalogue, or match a reference photo"
        className={`genie-card group relative w-[190px] cursor-pointer rounded-[18px] border border-accent/25 px-[14px] py-4 text-center ${stateClass}`}
      >
        <span className="genie-orb relative mx-auto mb-2.5 flex h-[64px] w-[64px] items-center justify-center transition group-hover:scale-105">
          <GenieIcon className="relative h-full w-full" />
        </span>

        <span className="block text-[15px] font-extrabold tracking-[-0.01em]">Ask Genie</span>
        <span className="mt-0.5 block text-[11.5px] text-muted">tap to summon ✨</span>
      </button>
    </div>
  );
}
