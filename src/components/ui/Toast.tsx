import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertOctagon, AlertTriangle, Info, X } from 'lucide-react';
import { cn } from '../../lib/utils';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  title?: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextValue {
  toasts: ToastItem[];
  addToast: (toast: Omit<ToastItem, 'id'>) => string;
  removeToast: (id: string) => void;
  success: (message: string, title?: string) => string;
  error: (message: string, title?: string) => string;
  warning: (message: string, title?: string) => string;
  info: (message: string, title?: string) => string;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    ({ title, message, type = 'info', duration = 4000 }: Omit<ToastItem, 'id'>) => {
      const id = Math.random().toString(36).substring(2, 9);
      const newToast: ToastItem = { id, title, message, type, duration };

      setToasts((prev) => [...prev, newToast]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }

      return id;
    },
    [removeToast]
  );

  const success = useCallback(
    (message: string, title = 'Action Completed') => addToast({ title, message, type: 'success' }),
    [addToast]
  );
  const error = useCallback(
    (message: string, title = 'Operation Failed') => addToast({ title, message, type: 'error', duration: 6000 }),
    [addToast]
  );
  const warning = useCallback(
    (message: string, title = 'Operational Notice') => addToast({ title, message, type: 'warning', duration: 5000 }),
    [addToast]
  );
  const info = useCallback(
    (message: string, title = 'System Update') => addToast({ title, message, type: 'info' }),
    [addToast]
  );

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, success, error, warning, info }}>
      {children}
      {/* Toast Render Viewport */}
      <div
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-3 sm:px-0"
        aria-live="polite"
        role="region"
        aria-label="System notifications"
      >
        {toasts.map((toast) => {
          const typeConfig = {
            success: {
              icon: CheckCircle2,
              iconColor: 'text-emerald-400',
              bgColor: 'bg-slate-900/95 border-emerald-500/40 shadow-emerald-950/20',
              barColor: 'bg-emerald-500',
            },
            error: {
              icon: AlertOctagon,
              iconColor: 'text-rose-400',
              bgColor: 'bg-slate-900/95 border-rose-500/40 shadow-rose-950/20',
              barColor: 'bg-rose-500',
            },
            warning: {
              icon: AlertTriangle,
              iconColor: 'text-amber-400',
              bgColor: 'bg-slate-900/95 border-amber-500/40 shadow-amber-950/20',
              barColor: 'bg-amber-500',
            },
            info: {
              icon: Info,
              iconColor: 'text-teal-400',
              bgColor: 'bg-slate-900/95 border-teal-500/40 shadow-teal-950/20',
              barColor: 'bg-teal-500',
            },
          }[toast.type];

          const IconComponent = typeConfig.icon;

          return (
            <div
              key={toast.id}
              role="status"
              className={cn(
                'pointer-events-auto relative overflow-hidden rounded-md border text-slate-100 shadow-xl backdrop-blur-md p-3.5 transition-all duration-300 animate-in slide-in-from-bottom-3',
                typeConfig.bgColor
              )}
            >
              <div
                className={cn('absolute left-0 top-0 bottom-0 w-1', typeConfig.barColor)}
                aria-hidden="true"
              />
              <div className="flex items-start gap-3 pl-1">
                <IconComponent className={cn('w-4 h-4 shrink-0 mt-0.5', typeConfig.iconColor)} />
                <div className="flex-1 min-w-0 pr-2">
                  {toast.title && (
                    <div className="text-xs font-semibold tracking-tight text-white mb-0.5">
                      {toast.title}
                    </div>
                  )}
                  <p className="text-[12px] leading-relaxed text-slate-300 break-words">
                    {toast.message}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeToast(toast.id)}
                  className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                  aria-label="Dismiss notification"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};
