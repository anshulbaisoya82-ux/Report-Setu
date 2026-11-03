import React, { useEffect, useState } from 'react';
import { CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';

type Tone = 'success' | 'info' | 'warning' | 'error';
interface ToastItem { id: number; message: string; tone: Tone }

type Listener = (t: ToastItem) => void;
const listeners = new Set<Listener>();
let nextId = 1;

/** Show a short, non-blocking message. Replaces window.alert(). */
export function notify(message: string, tone: Tone = 'info') {
  const item = { id: nextId++, message, tone };
  listeners.forEach((l) => l(item));
}

const toneStyle: Record<Tone, { box: string; Icon: typeof Info }> = {
  success: { box: 'bg-forest-900 text-white', Icon: CheckCircle2 },
  info: { box: 'bg-white text-ink border border-sage-300', Icon: Info },
  warning: { box: 'bg-amberalert-100 text-amberalert-700 border border-amberalert-200', Icon: AlertTriangle },
  error: { box: 'bg-critical-100 text-critical-700 border border-critical-200', Icon: AlertTriangle },
};

/** Mount once near the app root. */
export const ToastViewport: React.FC = () => {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const onToast: Listener = (t) => {
      setItems((prev) => [...prev.slice(-2), t]);
      window.setTimeout(() => setItems((prev) => prev.filter((x) => x.id !== t.id)), 4500);
    };
    listeners.add(onToast);
    return () => {
      listeners.delete(onToast);
    };
  }, []);

  return (
    <div className="fixed z-[100] bottom-20 lg:bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-md space-y-2" aria-live="polite">
      {items.map(({ id, message, tone }) => {
        const { box, Icon } = toneStyle[tone];
        return (
          <div key={id} className={`flex items-start gap-3 rounded-2xl px-4 py-3 text-sm shadow-modal ${box}`}>
            <Icon className="w-4 h-4 mt-0.5 shrink-0" />
            <p className="flex-1 leading-snug">{message}</p>
            <button type="button" aria-label="Dismiss" onClick={() => setItems((p) => p.filter((x) => x.id !== id))} className="opacity-70 hover:opacity-100">
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
