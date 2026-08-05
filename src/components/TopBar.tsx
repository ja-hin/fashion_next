'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { postForm, fmt } from '@/lib/client/api';
import {
  GearIcon,
  ChartIcon,
  PlusCircleIcon,
  ReceiptIcon,
  DocIcon,
  SlidersIcon,
  LogoutIcon,
} from './icons';
import type { Me } from '@/lib/client/types';

const TABS: Array<[string, string]> = [
  ['/generate', 'Generate'],
  ['/gallery', 'Gallery'],
  ['/models', 'My Models'],
];

export default function TopBar({ me, balance }: { me: Me; balance: number }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTheme(
      (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') ?? 'light',
    );
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [menuOpen]);

  // Close the menu whenever the route changes.
  useEffect(() => setMenuOpen(false), [pathname]);

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem('aig', next);
    } catch {
      // Private-mode browsers block localStorage — the theme just won't persist.
    }
    setTheme(next);
  }

  async function logout() {
    await postForm('/auth/logout');
    window.location.href = '/login';
  }

  const menuItem =
    'flex w-full items-center gap-[10px] rounded-lg px-3 py-[9px] text-left text-[13.5px] font-semibold text-ink hover:bg-surface2';

  return (
    <header className="relative z-20 flex h-[60px] flex-shrink-0 items-center gap-[14px] border-b border-line bg-surface px-[22px]">
      <Link href="/generate" className="text-xl font-extrabold tracking-[-0.03em]">
        <span className="text-brand">AI</span>mageGen
      </Link>
      

      

      <nav className="absolute left-1/2 top-0 hidden h-[60px] -translate-x-1/2 items-center gap-0.5 md:flex">
        {TABS.map(([href, label]) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`relative rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                active ? 'text-ink' : 'text-muted hover:text-ink'
              }`}
            >
              {label}
              {active && (
                <span className="animate-slide-in absolute -bottom-3 left-4 right-4 h-0.5 rounded-sm bg-brand" />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="flex-1" />

      <div className="flex items-center gap-[7px] rounded-[30px] bg-surface2 px-[14px] py-[7px] text-[13px] font-bold">
        <span className="hidden text-[10px] text-muted sm:inline">BALANCE</span>
        <b className="text-[15px] tabular-nums text-brand">{fmt(balance)}</b>
        <span className="hidden text-[10px] text-muted sm:inline">CREDITS</span>
      </div>

      <button
        onClick={toggleTheme}
        aria-label="Toggle theme"
        className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-surface2 text-[15px] transition-colors hover:bg-line"
      >
        {theme === 'dark' ? '☀' : '☾'}
      </button>

      <span
        title={me.email}
        className="hidden max-w-[150px] overflow-hidden text-ellipsis whitespace-nowrap text-[12.5px] font-bold lg:inline"
      >
        {me.name || me.email}
      </span>

      <div className="relative" ref={menuRef}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((v) => !v);
          }}
          aria-label="Menu"
          aria-expanded={menuOpen}
          className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-surface2 transition-colors hover:bg-line"
        >
          <GearIcon />
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-[46px] z-[60] flex min-w-[190px] flex-col gap-0.5 rounded-xl border border-line bg-surface p-1.5 shadow-pop">
            {/* Duplicated here so the main tabs stay reachable on small screens. */}
            <div className="md:hidden">
              {TABS.map(([href, label]) => (
                <Link key={href} href={href} className={menuItem}>
                  {label}
                </Link>
              ))}
              <div className="mx-1.5 my-[5px] h-px bg-line" />
            </div>

            <Link href="/usage" className={menuItem}>
              <ChartIcon /> Usage
            </Link>
            <Link href="/recharge" className={menuItem}>
              <PlusCircleIcon /> Recharge
            </Link>
            <Link href="/billing" className={menuItem}>
              <ReceiptIcon /> Billing &amp; invoices
            </Link>

            {me.admin && (
              <>
                <div className="mx-1.5 my-[5px] h-px bg-line" />
                <div className="px-3 pb-[3px] pt-1.5 text-[10px] font-bold uppercase tracking-[0.06em] text-muted">
                  Admin
                </div>
                <Link href="/logs" className={menuItem}>
                  <DocIcon /> Logs
                </Link>
                <Link href="/admin" className={menuItem}>
                  <SlidersIcon /> Admin settings
                </Link>
              </>
            )}

            <div className="mx-1.5 my-[5px] h-px bg-line" />
            <button className={menuItem} onClick={logout}>
              <LogoutIcon /> Log out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
