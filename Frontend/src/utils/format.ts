/**
 * Display helpers. The backend returns ISO timestamps (e.g. 2026-10-22T09:30:00.000Z)
 * while some older records hold pre-formatted strings ("22 Oct 2026"); both render cleanly.
 */
const ISO_LIKE = /^\d{4}-\d{2}-\d{2}/;

export function formatDate(value?: string | Date | null, opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' }): string {
  if (!value) return '';
  if (typeof value === 'string' && !ISO_LIKE.test(value)) return value;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('en-GB', opts);
}

export const formatShortDate = (value?: string | Date | null) => formatDate(value, { day: '2-digit', month: 'short' });

export function initials(name?: string): string {
  return (name || '')
    .replace(/^Dr\.?\s+/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]!.toUpperCase())
    .join('');
}
