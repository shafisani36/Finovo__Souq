import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { ToastContext, type ToastTone } from './toast-context';

interface ToastItem {
  id: number;
  title: string;
  message?: string;
  tone: ToastTone;
}

const ICONS = { success: CheckCircle2, error: AlertCircle, info: Info } as const;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const show = useCallback(
    ({ title, message, tone = 'success' }: { title: string; message?: string; tone?: ToastTone }) => {
      const id = ++counter.current;
      setToasts((list) => [...list.slice(-3), { id, title, message, tone }]);
      window.setTimeout(() => dismiss(id), tone === 'error' ? 6000 : 4000);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-region" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => {
          const Icon = ICONS[toast.tone];
          return (
            <div key={toast.id} className={`toast toast--${toast.tone}`} role={toast.tone === 'error' ? 'alert' : 'status'}>
              <Icon size={20} />
              <div className="toast__body">
                <p className="toast__title">{toast.title}</p>
                {toast.message && <p className="text-secondary">{toast.message}</p>}
              </div>
              <button type="button" className="icon-btn icon-btn--sm" onClick={() => dismiss(toast.id)} aria-label="Dismiss">
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
