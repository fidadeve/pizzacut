import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

interface Toast { id: number; message: string; type: 'success' | 'error' | 'info' }
const ToastContext = createContext<{ push: (message: string, type?: Toast['type']) => void } | null>(null);

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((message: string, type: Toast['type'] = 'success') => {
    const id = nextId++;
    setToasts(t => [...t.slice(-2), { id, message, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3200);
  }, []);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[80] flex flex-col items-center gap-2 px-4 lg:bottom-8" role="status" aria-live="polite">
        {toasts.map(t => (
          <div key={t.id}
            className={`animate-pop-in pointer-events-auto max-w-sm rounded-2xl px-4 py-3 text-sm font-bold shadow-pop ${
              t.type === 'error' ? 'bg-charcoal text-white' : t.type === 'info' ? 'bg-white text-charcoal border border-line' : 'bg-brand text-white'
            }`}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
