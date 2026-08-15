'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { fmt } from '@/lib/client/api';
import {
  WandIcon,
  ImagesIcon,
  PersonPlusIcon,
  ShirtIcon,
  PersonIcon,
  ChartIcon,
  PlusCircleIcon,
  ReceiptIcon,
  DocIcon,
  SlidersIcon,
  CoinsIcon,
  ChevronLeftIcon,
} from './icons';
import type { Me } from '@/lib/client/types';

type Item = { href: string; label: string; Icon: (p: { className?: string }) => React.ReactElement };

/** The work itself — where you spend almost all of your time. */
const MAIN: Item[] = [
  { href: '/generate', label: 'Generate', Icon: WandIcon },
  { href: '/gallery', label: 'Gallery', Icon: ImagesIcon },
  { href: '/garments', label: 'My Garments', Icon: ShirtIcon },
  { href: '/models', label: 'My Models', Icon: PersonPlusIcon },
];

/** Account and money — visited occasionally, so they sit below a divider. */
const ACCOUNT: Item[] = [
  { href: '/recharge', label: 'Recharge', Icon: PlusCircleIcon },
  { href: '/usage', label: 'Usage', Icon: ChartIcon },
  { href: '/billing', label: 'Billing', Icon: ReceiptIcon },
  { href: '/profile', label: 'Account', Icon: PersonIcon },
];

const ADMIN: Item[] = [
  { href: '/logs', label: 'Logs', Icon: DocIcon },
  { href: '/admin', label: 'Settings', Icon: SlidersIcon },
];

/**
 * The studio's primary navigation.
 *
 * Collapses to an icon rail with the label beneath each icon, which keeps every
 * destination readable at ~76px — a rail of bare icons would need a tooltip and
 * a guess. Expanded, the labels move alongside.
 *
 * Lives in the shell rather than a page so it survives navigation, and is
 * hidden below `lg` where the TopBar menu already carries the same links.
 *
 * The balance appears here as well as in the TopBar. Both render the same
 * `balance` from StudioContext, so they cannot drift apart — the rail copy is
 * simply the one in reach while you are choosing where to go next.
 */
export default function SideNav({
  me,
  balance,
  railed,
  onRailed,
}: {
  me: Me;
  balance: number;
  railed: boolean;
  onRailed: (v: boolean) => void;
}) {
  const pathname = usePathname();

  /**
   * A temporary hover expansion. Deliberately NOT the stored preference: a
   * pointer crossing the rail on its way somewhere else should not silently
   * change a setting the user chose.
   */
  const [peek, setPeek] = useState(false);
  const wide = !railed || peek;

  const items = [...MAIN];
  const lower = [...ACCOUNT, ...(me.admin ? ADMIN : [])];

  function Row({ href, label, Icon }: Item) {
    // `/models` must not light up on `/models/abc`'s sibling routes only —
    // startsWith covers the detail pages, which are still that section.
    const active = pathname === href || pathname.startsWith(`${href}/`);

    return (
      <Link
        key={href}
        href={href}
        title={!wide ? label : undefined}
        aria-current={active ? 'page' : undefined}
        className={`flex items-center rounded-[10px] transition-colors ${
          !wide ? 'flex-col justify-center gap-1 px-1 py-2' : 'gap-2.5 px-3 py-2'
        } ${
          active
            ? 'bg-accent text-white'
            : 'text-muted hover:bg-surface2 hover:text-ink'
        }`}
      >
        <Icon className={!wide ? 'h-[18px] w-[18px]' : 'h-4 w-4'} />
        <span
          className={
            !wide
              ? 'max-w-full truncate text-[9.5px] font-semibold leading-none'
              : 'truncate text-[13px] font-semibold'
          }
        >
          {label}
        </span>
      </Link>
    );
  }

  return (
    // The outer slot holds the collapsed footprint; the nav itself is absolute
    // so a hover peek floats OVER the page instead of shoving the results grid
    // sideways every time the pointer passes.
    <div
      className={`relative hidden flex-shrink-0 lg:block ${railed ? 'w-[76px]' : 'w-[212px]'}`}
    >
      <nav
        aria-label="Studio"
        onMouseEnter={() => railed && setPeek(true)}
        onMouseLeave={() => setPeek(false)}
        className={`absolute inset-y-0 left-0 z-30 flex flex-col overflow-y-auto border-r border-line bg-bg transition-[width] duration-200 ${
          !wide ? 'w-[76px] px-2 py-3' : 'w-[212px] px-3 py-3'
        } ${peek ? 'shadow-pop' : ''}`}
      >
      <div className={`mb-2 flex items-center ${!wide ? 'justify-center' : ''}`}>
        {wide && (
          <span className="px-1 text-[10px] font-bold uppercase tracking-[0.1em] text-muted">
            Studio
          </span>
        )}
        <button
          onClick={() => {
            onRailed(!railed);
            setPeek(false);
          }}
          title={railed ? 'Keep sidebar open' : 'Collapse sidebar'}
          aria-label={railed ? 'Keep sidebar open' : 'Collapse sidebar'}
          aria-expanded={!railed}
          className={`flex h-[28px] w-[28px] items-center justify-center rounded-lg text-muted transition hover:bg-surface2 hover:text-ink ${
            !wide ? '' : 'ml-auto'
          }`}
        >
          <ChevronLeftIcon className={`h-4 w-4 ${railed ? 'rotate-180' : ''}`} />
        </button>
      </div>

      <div className="flex flex-col gap-1">
        {items.map((it) => (
          <Row key={it.href} {...it} />
        ))}
      </div>

      <div className="my-3 h-px flex-shrink-0 bg-line" />

      <div className="flex flex-col gap-1">
        {lower.map((it) => (
          <Row key={it.href} {...it} />
        ))}
      </div>

      {/* Pinned to the foot, and a link because "I'm low" and "top me up" are
          the same thought. */}
      <Link
        href="/recharge"
        title={`${fmt(balance)} credits — tap to recharge`}
        className={`mt-auto flex flex-shrink-0 items-center rounded-[10px] border border-accent/40 bg-accent-soft text-accent transition hover:border-accent ${
          !wide ? 'flex-col justify-center gap-0.5 px-1 py-2' : 'gap-2 px-3 py-2'
        }`}
      >
        <CoinsIcon className="h-4 w-4 flex-shrink-0" />
        <span className="truncate text-[13px] font-bold tabular-nums">{fmt(balance)}</span>
        <span
          className={
            !wide
              ? 'text-[8.5px] font-bold uppercase leading-none text-muted'
              : 'text-[10px] font-bold uppercase text-muted'
          }
        >
          credits
        </span>
        </Link>
      </nav>
    </div>
  );
}
