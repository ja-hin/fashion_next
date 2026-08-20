'use client';

import { SearchIcon } from './icons';

/** Small presentational primitives shared across the studio views. */

export function Field({
  label,
  children,
  className = '',
  dim = false,
  float = false,
}: {
  label?: string;
  children: React.ReactNode;
  className?: string;
  dim?: boolean;
  /**
   * Sit the label astride the control's top border instead of above it. Only
   * for a field whose child is a single bordered input — over a filled block
   * like a segmented control it notches nothing and just overlaps.
   */
  float?: boolean;
}) {
  return (
    // `relative` is the positioning context a floated label resolves against.
    <div className={`relative mb-[13px] ${dim ? 'opacity-50' : ''} ${className}`}>
      {label && (
        <label
          className={
            float
              ? // Painted with the panel's own background so it cuts a notch in
                // the border rather than overprinting it — `bg-bg` rather than a
                // literal white, or the notch is a white bar in the dark theme.
                'lbl absolute -top-[5px] left-3 z-[1] mb-0 bg-bg px-1'
              : 'lbl'
          }
        >
          {label}
        </label>
      )}
      {children}
    </div>
  );
}

export function Select({
  value,
  onChange,
  options,
  disabled,
  className = '',
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  /** Either ["value", "Label"] pairs or plain strings used as both. */
  options: Array<[string, string] | string>;
  disabled?: boolean;
  className?: string;
  id?: string;
}) {
  return (
    <select
      id={id}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={className}
      
    >
      {options.map((o) => {
        const [v, l] = Array.isArray(o) ? o : [o, o];
        return (
          <option key={v} value={v}>
            {l}
          </option>
        );
      })}
    </select>
  );
}

export function SearchBox({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative max-w-[340px] flex-1">
      <span className="absolute left-[11px] top-1/2 -translate-y-1/2 text-muted">
        <SearchIcon className="h-4 w-4" />
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-[34px]"
      />
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  children,
}: {
  icon: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto my-[60px] max-w-[380px] text-center">
      <div className="mx-auto mb-[22px] flex h-[150px] w-[120px] items-center justify-center rounded-[14px] border-[1.5px] border-dashed border-line bg-surface2 text-3xl opacity-50">
        {icon}
      </div>
      <h3 className="mb-2 text-[19px] font-bold">{title}</h3>
      <p className="text-[13.5px] leading-[1.6] text-muted">{children}</p>
    </div>
  );
}

const PILL_TONE: Record<string, string> = {
  success: 'bg-[rgba(31,122,77,.12)] text-green',
  fallback: 'bg-amber-soft text-amber',
  blocked: 'bg-brand-soft text-brand',
  blocked_attempt: 'bg-brand-soft text-brand',
  blocked_hardfail: 'bg-brand-soft text-brand',
  error: 'bg-brand-soft text-brand',
  genie: 'bg-[rgba(109,59,209,.12)] text-genie',
  free: 'bg-[rgba(109,59,209,.12)] text-genie',
  paid: 'bg-[rgba(109,59,209,.12)] text-genie',
  uploaded: 'bg-surface2 text-muted',
};

export function Pill({ status }: { status: string }) {
  const s = (status ?? '').toLowerCase();
  const tone = PILL_TONE[s] ?? 'bg-surface2 text-muted';
  return (
    <span className={`rounded-[20px] px-[9px] py-[3px] text-[10.5px] font-bold ${tone}`}>
      {s ? s[0].toUpperCase() + s.slice(1) : ''}
    </span>
  );
}

/** The shimmer placeholder shown while an image generates. */
export function Skeleton() {
  return <div className="skeleton aspect-[4/5] w-[212px] rounded-card" />;
}

export function TableWrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

export function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th className="whitespace-nowrap border-b border-line bg-surface2 px-[14px] py-3 text-left text-[10.5px] font-bold uppercase tracking-[0.05em] text-muted">
      {children}
    </th>
  );
}

export function Td({
  children,
  mono = false,
  className = '',
}: {
  children?: React.ReactNode;
  mono?: boolean;
  className?: string;
}) {
  return (
    <td
      // Mono cells hold ids, timestamps, model names and numbers — wrapping
      // those turns one row into five lines. The table scrolls horizontally
      // instead (see TableWrap).
      className={`border-b border-line px-[14px] py-[11px] ${
        mono ? 'whitespace-nowrap tabular-nums text-muted' : ''
      } ${className}`}
    >
      {children}
    </td>
  );
}