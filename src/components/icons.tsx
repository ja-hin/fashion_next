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
 * The Prompt Genie mark. Drawn inline rather than shipped as the original
 * ~14 KB base64 PNG — it scales cleanly and costs nothing to load.
 */
export const GenieIcon = ({ className = 'w-7 h-7' }: P) => (
  <svg viewBox="0 0 32 32" className={className} aria-hidden>
    <defs>
      <linearGradient id="genie-g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#a97cf5" />
        <stop offset="100%" stopColor="#6d3bd1" />
      </linearGradient>
    </defs>
    <circle cx="16" cy="16" r="15" fill="url(#genie-g)" />
    <path
      d="M16 7l1.9 5.1L23 14l-5.1 1.9L16 21l-1.9-5.1L9 14l5.1-1.9L16 7z"
      fill="#fff"
    />
    <circle cx="23" cy="22.5" r="2" fill="#fff" opacity=".9" />
    <circle cx="10" cy="22" r="1.3" fill="#fff" opacity=".7" />
  </svg>
);