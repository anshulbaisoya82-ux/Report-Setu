import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LogOut, Menu, Settings, ShieldCheck, X, type LucideIcon } from 'lucide-react';
import { Logo } from '../common/Logo';
import { useStore } from '../../store/useStore';
import { NotificationBell } from '../notifications/NotificationBell';

export interface NavItem {
  name: string;
  path: string;
  icon: LucideIcon;
  exact?: boolean;
  badge?: number;
  /** Shown in the phone bottom bar (max 5). */
  primary?: boolean;
}

interface AppShellProps {
  items: NavItem[];
  settingsPath: string;
  privacyNote: string;
  /** Who is signed in, shown at the bottom of the sidebar. */
  account?: { name: string; detail?: string };
  /** Routes that manage their own full-height scrolling (e.g. chat). */
  fullBleed?: (pathname: string) => boolean;
}

const isActive = (pathname: string, item: { path: string; exact?: boolean }) =>
  item.exact ? pathname === item.path : pathname === item.path || pathname.startsWith(`${item.path}/`);

const initialsOf = (name: string) =>
  name.replace(/^Dr\.?\s+/i, '').split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]!.toUpperCase()).join('');

/**
 * Responsive frame shared by the doctor and patient portals.
 *  - ≥1024px: quiet white sidebar
 *  - <1024px: top bar with a slide-out menu, plus a bottom tab bar on phones
 */
export const AppShell: React.FC<AppShellProps> = ({ items, settingsPath, privacyNote, account, fullBleed }) => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const logout = useStore((s) => s.logout);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => setDrawerOpen(false), [pathname]);
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrawerOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const current = [...items, { name: 'Settings', path: settingsPath, icon: Settings }].find((i) => isActive(pathname, i));
  const bleed = fullBleed?.(pathname) ?? false;

  const link = (active: boolean) =>
    `flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
      active ? 'bg-forest-50 font-semibold text-forest-900' : 'font-medium text-stone-600 hover:bg-stone-100 hover:text-ink'
    }`;

  const sidebar = (
    <div className="flex h-full flex-col gap-6 p-4">
      <div className="flex items-center justify-between px-2 pt-1.5">
        <Logo size="md" theme="dark" />
        <span className="hidden lg:block"><NotificationBell placement="sidebar" /></span>
        <button type="button" aria-label="Close menu" className="rounded-lg p-1.5 text-stone-500 hover:bg-stone-100 lg:hidden" onClick={() => setDrawerOpen(false)}>
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-0.5" aria-label="Main">
        {items.map((item) => {
          const active = isActive(pathname, item);
          const Icon = item.icon;
          return (
            <NavLink key={item.path} to={item.path} aria-current={active ? 'page' : undefined} className={link(active)}>
              <span className="flex items-center gap-3">
                <Icon className={`h-[18px] w-[18px] ${active ? 'text-forest-900' : 'text-stone-400'}`} strokeWidth={1.9} />
                {item.name}
              </span>
              {item.badge ? (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-terracotta-500 px-1.5 text-xs font-semibold text-white">{item.badge}</span>
              ) : null}
            </NavLink>
          );
        })}
      </nav>

      <div className="space-y-1">
        <p className="mb-3 flex items-start gap-2 px-3 text-xs leading-relaxed text-stone-500">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-forest-700" />
          {privacyNote}
        </p>
        <NavLink to={settingsPath} className={({ isActive: a }) => link(a)}>
          <span className="flex items-center gap-3">
            <Settings className="h-[18px] w-[18px] text-stone-400" strokeWidth={1.9} /> Settings
          </span>
        </NavLink>
        <div className="mt-2 flex items-center gap-3 border-t border-line px-2 pt-3">
          {account && (
            <>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-forest-900 text-xs font-semibold text-white">{initialsOf(account.name)}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ink">{account.name}</span>
                {account.detail && <span className="block truncate text-xs text-stone-500">{account.detail}</span>}
              </span>
            </>
          )}
          <button type="button" onClick={handleLogout} aria-label="Log out" title="Log out" className="ml-auto rounded-lg p-2 text-stone-500 hover:bg-stone-100 hover:text-ink">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  const phoneTabs = items.filter((i) => i.primary).slice(0, 5);

  return (
    <div className="min-h-screen bg-canvas lg:flex">
      <aside className="hidden lg:block lg:w-60 lg:shrink-0">
        <div className="sticky top-0 h-screen overflow-y-auto border-r border-line bg-white">{sidebar}</div>
      </aside>

      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-line bg-white px-4 lg:hidden">
        <button type="button" aria-label="Open menu" aria-expanded={drawerOpen} onClick={() => setDrawerOpen(true)} className="-ml-1 rounded-lg p-1.5 text-stone-600 hover:bg-stone-100">
          <Menu className="h-5 w-5" />
        </button>
        <Logo size="sm" theme="dark" />
        <span className="ml-auto truncate text-sm font-medium text-stone-500">{current?.name}</span>
        <NotificationBell />
      </header>

      <div className={`fixed inset-0 z-50 lg:hidden ${drawerOpen ? '' : 'pointer-events-none'}`} aria-hidden={!drawerOpen}>
        <div className={`absolute inset-0 bg-forest-950/40 transition-opacity ${drawerOpen ? 'opacity-100' : 'opacity-0'}`} onClick={() => setDrawerOpen(false)} />
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          className={`absolute inset-y-0 left-0 w-72 max-w-[85vw] overflow-y-auto bg-white shadow-modal transition-transform duration-200 ${drawerOpen ? 'translate-x-0' : '-translate-x-full'}`}
        >
          {sidebar}
        </div>
      </div>

      <main className={`min-w-0 flex-1 ${bleed ? 'flex flex-col lg:h-screen' : ''}`}>
        {bleed ? (
          <div className="flex min-h-[calc(100vh-3.5rem-4rem)] flex-1 flex-col pb-16 sm:pb-0 lg:h-full lg:min-h-0 lg:overflow-hidden">
            <Outlet />
          </div>
        ) : (
          <div className="mx-auto w-full max-w-[1240px] px-4 pb-24 pt-6 sm:px-6 lg:px-10 lg:pb-12 lg:pt-10">
            <Outlet />
          </div>
        )}
      </main>

      {phoneTabs.length > 0 && (
        <nav
          aria-label="Quick navigation"
          className="fixed inset-x-0 bottom-0 z-40 grid border-t border-line bg-white pb-[env(safe-area-inset-bottom)] sm:hidden"
          style={{ gridTemplateColumns: `repeat(${phoneTabs.length}, minmax(0, 1fr))` }}
        >
          {phoneTabs.map((item) => {
            const active = isActive(pathname, item);
            const Icon = item.icon;
            return (
              <NavLink key={item.path} to={item.path} className={`relative flex flex-col items-center gap-0.5 py-2 text-xs font-medium ${active ? 'text-forest-900' : 'text-stone-500'}`}>
                <Icon className="h-5 w-5" strokeWidth={active ? 2.2 : 1.8} />
                <span className="max-w-full truncate px-1">{item.name}</span>
                {item.badge ? <span className="absolute right-[calc(50%-18px)] top-1 h-2 w-2 rounded-full bg-terracotta-500" /> : null}
              </NavLink>
            );
          })}
        </nav>
      )}
    </div>
  );
};
