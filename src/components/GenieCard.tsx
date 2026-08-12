'use client';

import { GenieIcon } from './icons';

/**
 * The "Ask Genie" tile that sits beside "Add pose" in the results grid.
 *
 * Genie is reachable from inside the Add Pose card too, but only once you have
 * opened it and only in the context of the pose you are already writing. This
 * is the way in when you have no pose in mind at all — "build me a catalogue"
 * — so it gets its own front door rather than being a button behind a button.
 *
 * Sized to match AddCard's tile exactly so the two read as a pair.
 */
export default function GenieCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title="Ask Genie — describe a shot, build a catalogue, or match a reference photo"
      className="group relative w-[212px] self-start overflow-hidden rounded-card border-[1.5px] border-genie/35 bg-surface shadow-card transition hover:-translate-y-[3px] hover:border-genie hover:shadow-pop"
    >
      {/* A soft bloom behind the orb rather than a flat fill, so the tile reads
          as lit from within next to the plain dashed Add pose card. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70 transition group-hover:opacity-100"
        style={{
          background:
            'radial-gradient(120% 80% at 50% 18%, color-mix(in srgb, var(--genie) 18%, transparent) 0%, transparent 62%)',
        }}
      />

      <div className="relative flex min-h-[300px] flex-col items-center justify-center gap-4 px-5 py-6">
        {/* GenieIcon is already the purple orb with the sparkle in it, so this
            only adds the drop glow underneath it. */}
        <GenieIcon className="h-[74px] w-[74px] drop-shadow-[0_10px_22px_color-mix(in_srgb,var(--genie)_45%,transparent)] transition group-hover:scale-105" />

        <span className="text-center">
          <span className="block text-[15px] font-bold">Ask Genie</span>
          <span className="mt-1 block text-[11.5px] text-muted">tap to summon ✨</span>
        </span>
      </div>
    </button>
  );
}
