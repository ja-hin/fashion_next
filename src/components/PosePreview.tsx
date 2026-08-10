'use client';

import { useState } from 'react';
import { poseImageSrcs } from '@/lib/client/constants';

/**
 * The reference thumbnail shown while a pose is hovered.
 *
 * Walks the candidate paths in order and renders nothing at all once they have
 * all failed, so a pose with no artwork yet simply shows no popover rather than
 * a broken-image box. Mount it keyed by label — the fallback walk is per-pose
 * state and has to restart when the hovered pose changes.
 */
export default function PosePreview({
  category,
  label,
  side,
}: {
  category: string;
  label: string;
  /** Which way to open, decided by the caller from available room. */
  side: 'left' | 'right';
}) {
  const srcs = poseImageSrcs(category, label);
  const [i, setI] = useState(0);

  // Every candidate 404'd — this pose isn't illustrated yet.
  if (i >= srcs.length) return null;

  return (
    <div
      // pointer-events-none: the popover overlaps the neighbouring result
      // cards, and swallowing their hover/click would be worse than the peek is
      // worth.
      className={`pointer-events-none absolute top-0 z-30 w-[184px] overflow-hidden rounded-card border border-line bg-surface shadow-pop ${
        side === 'right' ? 'left-full ml-2' : 'right-full mr-2'
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={srcs[i]}
        alt={`${label} pose reference`}
        onError={() => setI((n) => n + 1)}
        className="block aspect-[4/5] w-full object-cover"
      />
      <div className="truncate px-2.5 py-[7px] text-[11px] font-bold">{label}</div>
    </div>
  );
}
