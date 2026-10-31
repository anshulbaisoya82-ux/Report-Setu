import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LogOut, Menu, Settings, ShieldCheck, X, type LucideIcon } from 'lucide-react';
import { Logo } from '../common/Logo';
import { useStore } from '../../store/useStore';

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
  /** Routes that manage their own full-height scrolling (e.g. chat). */
  fullBleed?: (pathname: string) => boolean;
}

const isActive = (pathname: string, item: NavItem) =>
  item.exact ? pathname === item.path : pathname === item.path || pathname.startsWith(`${item.path}/`);

/**
 * Responsive app frame shared by the doctor and patient portals.
 *  - ≥1024px: fixed forest sidebar (Figma layout)
 *  - <1024px: top bar with a slide-out menu, plus a bottom tab bar on phones
 */
export const AppShell: React.FC<AppShellProps> = ({ items, settingsPath, privacyNote, fullBleed }) => {
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

  const sidebar = (
    <div className="flex h-full flex-col justify-between gap-6 p-5 lg:p-6">
      <div className="space-y-8">
        <div className="flex items-center justify-between pt-1">
          <Logo size="md" />
          <button type="button" aria-label="Close menu" className="lg:hidden rounded-lg p-1.5 text-white/70 hover:bg-white/10" onClick={() => setDrawerOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-2">
          <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/45">Menu</p>
          <nav className="space-y-1" aria-label="Main">
            {items.map((item) => {
              const active = isActive(pathname, item);
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  aria-current={active ? 'page' : undefined}
                  className={`flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm transition-colors ${
                    active ? 'bg-sage-50 font-semibold text-forest-900 shadow-xs' : 'font-medium text-white/80 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <Icon className={`h-[18px] w-[18px] ${active ? 'text-forest-900' : 'text-white/65'}`} />
                    {item.name}
                  </span>
                  {item.badge ? (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-terracotta-500 px-1.5 text-[11px] font-bold text-white">
                      {item.badge}
                    </span>
                  ) : null}
                </NavLink>
              );
            })}
          </nav>
        </div>
      </div>

      <div className="space-y-3">
        <div className="rounded-2xl border border-white/10 bg-black/15 p-3.5">
          <p className="mb-1 flex items-center gap-2 text-xs font-semibold text-white">
            <ShieldCheck className="h-4 w-4 text-sage-400" /> Private by design
          </p>
          <p className="text-[11px] leading-relaxed text-white/60">{privacyNote}</p>
        </div>
        <NavLink
          to={settingsPath}
          className={({ isActive: a }) =>
            `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm transition-colors ${a ? 'bg-sage-50 font-semibold text-forest-900' : 'font-medium text-white/80 hover:bg-white/10 hover:text-white'}`
          }
        >
          <Settings className="h-[18px] w-[18px] opacity-70" /> Settings
        </NavLink>
        <button type="button" onClick={handleLogout} className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white">
          <LogOut className="h-[18px] w-[18px] opacity-70" /> Log out
        </button>
      </div>
    </div>
  );

  const phoneTabs = items.filter((i) => i.primary).slice(0, 5);

  return (
    <div className="min-h-screen bg-sage-100 lg:flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:block lg:w-64 lg:shrink-0">
        <div className="sticky top-0 h-screen overflow-y-auto bg-forest-900 text-white">{sidebar}</div>
      </aside>

      {/* Tablet / phone top bar */}
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-white/10 bg-forest-900 px-4 text-white lg:hidden">
        <button type="button" aria-label="Open menu" aria-expanded={drawerOpen} onClick={() => setDrawerOpen(true)} className="-ml-1 rounded-lg p-1.5 hover:bg-white/10">
          <Menu className="h-5 w-5" />
        </button>
        <Logo size="sm" />
        <span className="ml-auto truncate text-sm font-medium text-white/80">{current?.name}</span>
      </header>

      {/* Slide-out drawer */}
      <div className={`fixed inset-0 z-50 lg:hidden ${drawerOpen ? '' : 'pointer-events-none'}`} aria-hidden={!drawerOpen}>
        <div className={`absolute inset-0 bg-forest-950/50 transition-opacity ${drawerOpen ? 'opacity-100' : 'opacity-0'}`} onClick={() => setDrawerOpen(false)} />
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          className={`absolute inset-y-0 left-0 w-72 max-w-[85vw] overflow-y-auto bg-forest-900 text-white shadow-modal transition-transform duration-200 ${drawerOpen ? 'translate-x-0' : '-translate-x-full'}`}
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
          <div className="mx-auto w-full max-w-[1400px] px-4 pb-24 pt-5 sm:px-6 sm:pt-6 lg:px-8 lg:pb-10 lg:pt-8">
            <Outlet />
          </div>
        )}
      </main>

      {/* Phone bottom tabs */}
      {phoneTabs.length > 0 && (
        <nav aria-label="Quick navigation" className="fixed inset-x-0 bottom-0 z-40 grid border-t border-sage-300 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden" style={{ gridTemplateColumns: `repeat(${phoneTabs.length}, minmax(0, 1fr))` }}>
          {phoneTabs.map((item) => {
            const active = isActive(pathname, item);
            const Icon = item.icon;
            return (
              <NavLink key={item.path} to={item.path} className={`relative flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold ${active ? 'text-forest-900' : 'text-stone-500'}`}>
                <Icon className="h-5 w-5" />
                <span className="truncate max-w-full px-1">{item.name}</span>
                {item.badge ? <span className="absolute right-[calc(50%-18px)] top-1 h-2 w-2 rounded-full bg-terracotta-500" /> : null}
              </NavLink>
            );
          })}
        </nav>
      )}
    </div>
  );
};
