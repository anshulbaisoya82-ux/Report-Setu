import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck, Loader2 } from 'lucide-react';
import { notificationsApi, type AppNotification } from '../../api/client';

const POLL_MS = 60_000;

function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  const d = Math.floor(s / 86400);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}

/**
 * Bell with unread count. Reads GET /notifications, marks one read on open (PUT /notifications/:id/read)
 * and all read (PUT /notifications/read-all). Refreshes every minute and on socket notifications.
 */
export const NotificationBell: React.FC<{ placement?: 'sidebar' | 'header' }> = ({ placement = 'header' }) => {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const box = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await notificationsApi.getNotifications({ limit: 20 });
      setItems(res?.notifications || []);
      setUnread(res?.unreadCount || 0);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load notifications.');
    }
  }, []);

  useEffect(() => {
    load();
    const t = window.setInterval(load, POLL_MS);
    const onPush = () => load();
    window.addEventListener('reportsetu:notification', onPush);
    return () => {
      window.clearInterval(t);
      window.removeEventListener('reportsetu:notification', onPush);
    };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next) {
      setLoading(true);
      await load();
      setLoading(false);
    }
  };

  const markOne = async (n: AppNotification) => {
    if (n.isRead) return;
    setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
    setUnread((u) => Math.max(0, u - 1));
    try {
      await notificationsApi.markAsRead(n.id);
    } catch {
      load();
    }
  };

  const markAll = async () => {
    setItems((prev) => prev.map((x) => ({ ...x, isRead: true })));
    setUnread(0);
    try {
      await notificationsApi.markAllAsRead();
    } catch {
      load();
    }
  };

  return (
    <div className="relative" ref={box}>
      <button
        type="button"
        onClick={toggle}
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open}
        className="relative rounded-lg p-2 text-stone-500 hover:bg-stone-100 hover:text-ink"
      >
        <Bell className="h-[18px] w-[18px]" strokeWidth={1.9} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-terracotta-500 px-1 text-[10px] font-semibold leading-none text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* The sidebar scrolls, so there the panel is fixed beside it rather than inside it (avoids clipping). */}
      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className={`z-50 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-line bg-white shadow-modal ${placement === 'sidebar' ? 'fixed left-[15.5rem] top-4' : 'absolute right-0 top-full mt-2'}`}
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="text-sm font-semibold text-ink">Notifications</span>
            {unread > 0 && (
              <button type="button" onClick={markAll} className="flex items-center gap-1 text-xs font-semibold text-forest-800 hover:underline">
                <CheckCheck className="h-3.5 w-3.5" /> Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {loading && items.length === 0 ? (
              <p className="flex items-center justify-center gap-2 py-8 text-xs text-stone-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading</p>
            ) : error && items.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs text-stone-500">{error}</p>
            ) : items.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs text-stone-500">No notifications yet.</p>
            ) : (
              <ul>
                {items.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => markOne(n)}
                      className={`flex w-full gap-3 border-b border-line/70 px-4 py-3 text-left last:border-0 hover:bg-stone-50 ${n.isRead ? '' : 'bg-forest-50/50'}`}
                    >
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.isRead ? 'bg-transparent' : 'bg-terracotta-500'}`} />
                      <span className="min-w-0 flex-1">
                        <span className={`block text-sm ${n.isRead ? 'font-medium text-stone-700' : 'font-semibold text-ink'}`}>{n.title}</span>
                        <span className="mt-0.5 block text-xs leading-relaxed text-stone-600">{n.message}</span>
                        <span className="mt-1 block text-xs text-stone-400">{timeAgo(n.createdAt)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
