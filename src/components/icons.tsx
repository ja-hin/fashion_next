/** Inline SVG icons. Stroke-based so they pick up `currentColor` from the parent. */

type P = { className?: string };

const stroke = {
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export const CopyIcon = ({ className = 'w-[15px] h-[15px]' }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V5a2 2 0 0 1 2-2h10" />
  </svg>
);

export const RegenIcon = ({ className = 'w-[15px] h-[15px]' }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke}>
    <path d="M21 12a9 9 0 1 1-2.6-6.3" />
    <path d="M21 3v5h-5" />
  </svg>
);

export const DownloadIcon = ({ className = 'w-[15px] h-[15px]' }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke}>
    <path d="M12 3v12" />
    <path d="M7 12l5 5 5-5" />
    <path d="M5 21h14" />
  </svg>
);

export const TrashIcon = ({ className = 'w-[15px] h-[15px]' }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke}>
    <path d="M3 6h18" />
    <path d="M8 6V4h8v2" />
    <path d="M6 6l1 14h10l1-14" />
  </svg>
);

export const EyeIcon = ({ className = 'w-4 h-4' }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke}>
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export const EyeOffIcon = ({ className = 'w-4 h-4' }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke}>
    <path d="M10.6 6.2A9.6 9.6 0 0 1 12 6c6.4 0 10 7 10 7a17 17 0 0 1-2.5 3.3" />
    <path d="M6.3 7.7A17 17 0 0 0 2 13s3.6 7 10 7a9.4 9.4 0 0 0 4.2-1" />
    <path d="M9.9 10.1a3 3 0 0 0 4.2 4.2" />
    <path d="M3 3l18 18" />
  </svg>
);

export const GearIcon = ({ className = 'w-[18px] h-[18px]' }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

export const ChartIcon = ({ className = 'w-4 h-4' }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke}>
    <path d="M3 3v18h18" />
    <path d="M7 14l4-4 3 3 5-6" />
  </svg>
);

export const PlusCircleIcon = ({ className = 'w-4 h-4' }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v8M8 12h8" />
  </svg>
);

export const ImagesIcon = ({ className = 'w-4 h-4' }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke}>
    <rect x="3" y="3" width="14" height="14" rx="2" />
    <path d="M7 21h12a2 2 0 0 0 2-2V7" />
    <circle cx="8" cy="8" r="1.4" />
    <path d="M3 13l3.5-3.5L11 14" />
  </svg>
);

export const PersonIcon = ({ className = 'w-4 h-4' }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke}>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
  </svg>
);

export const ReceiptIcon = ({ className = 'w-4 h-4' }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke}>
    <path d="M5 3v18l2.5-1.5L10 21l2-1.5L14 21l2.5-1.5L19 21V3z" />
    <path d="M9 8h6M9 12h6M9 16h3" />
  </svg>
);

export const DocIcon = ({ className = 'w-4 h-4' }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke}>
    <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
    <path d="M14 3v6h6" />
    <path d="M8 13h8M8 17h5" />
  </svg>
);

export const SlidersIcon = ({ className = 'w-4 h-4' }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke}>
    <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3" />
    <path d="M1 14h6M9 8h6M17 16h6" />
  </svg>
);

export const LogoutIcon = ({ className = 'w-4 h-4' }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="M16 17l5-5-5-5" />
    <path d="M21 12H9" />
  </svg>
);

export const PersonPlusIcon = ({ className = 'w-4 h-4' }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke}>
    <path d="M15 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm-7 9a7 7 0 0 1 14 0M5 8v6M2 11h6" />
  </svg>
);

export const PlayIcon = ({ className = 'w-[15px] h-[15px]' }: P) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M8 5v14l11-7z" />
  </svg>
);

export const ShieldCheckIcon = ({ className = 'w-4 h-4' }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke}>
    <path d="M12 3l7 3v5c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6l7-3z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);

export const PauseIcon = ({ className = 'w-4 h-4' }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke}>
    <path d="M9 5v14M15 5v14" />
  </svg>
);

export const SearchIcon = ({ className = 'w-[13px] h-[13px]' }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke}>
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4-4" />
  </svg>
);

export const GridIcon = ({ className = 'w-5 h-5' }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke}>
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
);

/** My Garments — a t-shirt outline. */
export const ShirtIcon = ({ className = 'w-4 h-4' }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke}>
    <path d="M9 3L5 5 3 9l3 1v10h12V10l3-1-2-4-4-2" />
    <path d="M9 3a3 3 0 0 0 6 0" />
  </svg>
);

/** The Generate tab — a wand with a spark. */
export const WandIcon = ({ className = 'w-4 h-4' }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke}>
    <path d="M4 20L16 8" />
    <path d="M14 6l4 4" />
    <path d="M18 3v4M20 5h-4" />
    <path d="M6 13v3M7.5 14.5h-3" />
  </svg>
);

/** Credits — a stack of coins, as in the balance pill. */
export const CoinsIcon = ({ className = 'w-4 h-4' }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke}>
    <ellipse cx="12" cy="7" rx="8" ry="3.4" />
    <path d="M4 7v5c0 1.9 3.6 3.4 8 3.4s8-1.5 8-3.4V7" />
    <path d="M4 12v5c0 1.9 3.6 3.4 8 3.4s8-1.5 8-3.4v-5" />
  </svg>
);

/** Points left by default; flip with a `rotate-180` class to point right. */
export const ChevronLeftIcon = ({ className = 'w-4 h-4' }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke}>
    <path d="M15 5l-7 7 7 7" />
  </svg>
);

/** The classic sidebar glyph: a panel with its rail picked out. */
export const PanelIcon = ({ className = 'w-4 h-4' }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M9 4v16" />
  </svg>
);

export const AlertIcon = ({ className = 'w-4 h-4' }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...stroke}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 8v4M12 16h.01" />
  </svg>
);

export const SaveIcon = ({ className = 'w-[15px] h-[15px]' }: P) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M17 3H5a2 2 0 0 0-2 2v14l4-3h10a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z" />
  </svg>
);

/**
 * The Genie mark — the character artwork, not a glyph.
 *
 * Served from /genie.webp rather than the 1.65 MB source PNG in public: this
 * renders between 15px and 64px, and shipping a 1254px master for a 15px button
 * would cost more than the rest of the page. The WebP is 256px / ~20 KB, which
 * still covers the largest use at 4x DPI. Regenerate it from
 * "New-Genie Lite.png" if the artwork changes.
 *
 * `object-contain` matters — every caller sizes this with square h-/w- classes,
 * and the artwork is not square once its transparent margin is trimmed.
 */
export const GenieIcon = ({ className = 'w-7 h-7' }: P) => (
  // eslint-disable-next-line @next/next/no-img-element
  <img
    src="/genie.webp"
    alt=""
    aria-hidden
    draggable={false}
    className={`${className} select-none object-contain`}
  />
);