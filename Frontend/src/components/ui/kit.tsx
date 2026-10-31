import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, type LucideIcon } from 'lucide-react';

/**
 * Shared building blocks for the calm layout. Rules they encode:
 *  - one page title size, one section title size, one body size
 *  - white surfaces separated by hairlines, not shadows
 *  - forest green only for primary actions
 */

export const PageHeader: React.FC<{ title: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode; back?: { to: string; label: string } }> = ({
  title, subtitle, actions, back,
}) => (
  <header className="mb-8">
    {back && (
      <Link to={back.to} className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-stone-500 hover:text-ink">
        <ChevronRight className="h-4 w-4 rotate-180" /> {back.label}
      </Link>
    )}
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[28px] font-semibold leading-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-[15px] text-stone-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  </header>
);

export const Card: React.FC<React.HTMLAttributes<HTMLElement> & { as?: 'section' | 'div' | 'article' }> = ({ as: Tag = 'section', className = '', ...rest }) => (
  <Tag className={`rounded-2xl border border-line bg-white ${className}`} {...rest} />
);

export const SectionTitle: React.FC<{ title: React.ReactNode; subtitle?: React.ReactNode; action?: { to: string; label: string } | React.ReactNode }> = ({ title, subtitle, action }) => (
  <div className="mb-4 flex items-end justify-between gap-3">
    <div className="min-w-0">
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      {subtitle && <p className="mt-0.5 text-sm text-stone-500">{subtitle}</p>}
    </div>
    {action && typeof action === 'object' && 'to' in (action as any) ? (
      <Link to={(action as any).to} className="inline-flex shrink-0 items-center gap-0.5 text-sm font-medium text-forest-800 hover:text-forest-950">
        {(action as any).label} <ChevronRight className="h-4 w-4" />
      </Link>
    ) : (
      (action as React.ReactNode)
    )}
  </div>
);

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export const btn = (variant: BtnVariant = 'primary', size: 'md' | 'sm' = 'md') =>
  [
    'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors disabled:opacity-60 disabled:pointer-events-none',
    size === 'sm' ? 'px-3 py-1.5 text-sm' : 'px-4 py-2.5 text-sm',
    variant === 'primary' && 'bg-forest-900 text-white hover:bg-forest-850',
    variant === 'secondary' && 'border border-stone-300 bg-white text-ink hover:bg-stone-50',
    variant === 'ghost' && 'text-forest-800 hover:bg-forest-50',
    variant === 'danger' && 'border border-red-200 bg-white text-red-700 hover:bg-red-50',
  ]
    .filter(Boolean)
    .join(' ');

export const Metric: React.FC<{ label: string; value: React.ReactNode; hint?: React.ReactNode; to?: string; tone?: 'default' | 'attention' }> = ({ label, value, hint, to, tone = 'default' }) => {
  const body = (
    <>
      <p className="text-sm text-stone-500">{label}</p>
      <p className={`mt-2 text-[34px] font-semibold leading-none tracking-tight ${tone === 'attention' ? 'text-red-700' : 'text-ink'}`}>{value}</p>
      {hint && <p className="mt-2 text-sm text-stone-500">{hint}</p>}
    </>
  );
  return to ? (
    <Link to={to} className="block rounded-2xl border border-line bg-white p-5 transition-colors hover:border-stone-300">
      {body}
    </Link>
  ) : (
    <div className="rounded-2xl border border-line bg-white p-5">{body}</div>
  );
};

export const EmptyState: React.FC<{ icon?: LucideIcon; title: string; body?: React.ReactNode; action?: React.ReactNode }> = ({ icon: Icon, title, body, action }) => (
  <div className="rounded-xl border border-dashed border-stone-300 px-6 py-10 text-center">
    {Icon && <Icon className="mx-auto mb-3 h-6 w-6 text-stone-400" strokeWidth={1.8} />}
    <p className="text-sm font-semibold text-ink">{title}</p>
    {body && <p className="mx-auto mt-1 max-w-sm text-sm text-stone-500">{body}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

export const Avatar: React.FC<{ name: string; size?: 'sm' | 'md' }> = ({ name, size = 'md' }) => {
  const initials = name.replace(/^Dr\.?\s+/i, '').split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]!.toUpperCase()).join('');
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-full bg-forest-50 font-semibold text-forest-800 ${size === 'sm' ? 'h-8 w-8 text-xs' : 'h-10 w-10 text-sm'}`}>
      {initials}
    </span>
  );
};

/** Row inside a list card: whole row is the link. */
export const ListRow: React.FC<{ to: string; leading?: React.ReactNode; title: React.ReactNode; meta?: React.ReactNode; trailing?: React.ReactNode }> = ({ to, leading, title, meta, trailing }) => (
  <li>
    <Link to={to} className="flex items-center gap-3.5 px-5 py-3.5 transition-colors hover:bg-stone-50">
      {leading}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium text-ink">{title}</span>
        {meta && <span className="mt-0.5 block truncate text-sm text-stone-500">{meta}</span>}
      </span>
      {trailing}
      <ChevronRight className="h-4 w-4 shrink-0 text-stone-300" />
    </Link>
  </li>
);

const toneMap = {
  critical: 'bg-red-50 text-red-700',
  attention: 'bg-amber-50 text-amber-800',
  ok: 'bg-emerald-50 text-emerald-700',
  neutral: 'bg-stone-100 text-stone-600',
  info: 'bg-teal-50 text-teal-700',
} as const;
export type Tone = keyof typeof toneMap;

/** Small status label. Always text, never colour alone. */
export const Tag: React.FC<{ tone?: Tone; children: React.ReactNode }> = ({ tone = 'neutral', children }) => (
  <span className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-semibold ${toneMap[tone]}`}>{children}</span>
);
