'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  WandIcon,
  ImagesIcon,
  PersonPlusIcon,
  PersonIcon,
  ChartIcon,
  PlusCircleIcon,
  ReceiptIcon,
  DocIcon,
  SlidersIcon,
  ChevronLeftIcon,
} from './icons';
import type { Me } from '@/lib/client/types';

const RAIL_KEY = 'studio.navRailed';

type Item = { href: string; label: string; Icon: (p: { className?: string }) => React.ReactElement };

/** The work itself — where you spend almost all of your time. */
const MAIN: Item[] = [
  { href: '/generate', label: 'Generate', Icon: WandIcon },
  { href: '/gallery', label: 'Gallery', Icon: ImagesIcon },
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
 * Navigation only — the credit balance lives in the TopBar, where it is visible
 * at every breakpoint and on every page. Showing the same number twice on one
 * screen invites the two to disagree after a generation.
 */
export default function SideNav({ me }: { me: Me }) {
  const pathname = usePathname();

  // Reading localStorage during render would desync the server and client
  // markup, so the stored preference is adopted after mount.
  const [railed, setRailed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setRailed(localStorage.getItem(RAIL_KEY) === '1');
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) localStorage.setItem(RAIL_KEY, railed ? '1' : '0');
  }, [railed, ready]);

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
        title={railed ? label : undefined}
        aria-current={active ? 'page' : undefined}
        className={`flex items-center rounded-[10px] transition-colors ${
          railed ? 'flex-col justify-center gap-1 px-1 py-2' : 'gap-2.5 px-3 py-2'
        } ${
          active
            ? 'bg-accent text-white'
            : 'text-muted hover:bg-surface2 hover:text-ink'
        }`}
      >
        <Icon className={railed ? 'h-[18px] w-[18px]' : 'h-4 w-4'} />
        <span
          className={
            railed
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
    <nav
      aria-label="Studio"
      className={`hidden flex-shrink-0 flex-col overflow-y-auto border-r border-line bg-bg lg:flex ${
        railed ? 'w-[76px] px-2 py-3' : 'w-[212px] px-3 py-3'
      }`}
    >
      <div className={`mb-2 flex items-center ${railed ? 'justify-center' : ''}`}>
        {!railed && (
          <span className="px-1 text-[10px] font-bold uppercase tracking-[0.1em] text-muted">
            Studio
          </span>
        )}
        <button
          onClick={() => setRailed((v) => !v)}
          title={railed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={railed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!railed}
          className={`flex h-[28px] w-[28px] items-center justify-center rounded-lg text-muted transition hover:bg-surface2 hover:text-ink ${
            railed ? '' : 'ml-auto'
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

    </nav>
  );
}
