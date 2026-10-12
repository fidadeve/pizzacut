import { useEffect, type ReactNode } from 'react';
import { Icon } from './icons';

export function VegMark({ isVeg, className = 'h-[18px] w-[18px]' }: { isVeg: boolean; className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-[4px] border-2 ${isVeg ? 'border-charcoal' : 'border-brand'} ${className}`}
      title={isVeg ? 'Vegetarian' : 'Non-vegetarian'}
      aria-label={isVeg ? 'Vegetarian' : 'Non-vegetarian'}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${isVeg ? 'bg-charcoal' : 'bg-brand'}`} />
    </span>
  );
}

export function SpiceLevel({ level }: { level: number }) {
  if (!level) return null;
  return (
    <span className="inline-flex items-center gap-0.5 text-brand" title={`Spice level ${level} of 3`} aria-label={`Spice level ${level} of 3`}>
      {Array.from({ length: level }).map((_, i) => (
        <Icon key={i} name="flame" filled className="h-3.5 w-3.5" />
      ))}
    </span>
  );
}

export function Badge({ children, tone = 'dark' }: { children: ReactNode; tone?: 'dark' | 'brand' | 'light' }) {
  const tones = {
    dark: 'bg-charcoal text-white',
    brand: 'bg-brand text-white',
    light: 'bg-white text-charcoal border border-line',
  } as const;
  return <span className={`pill-badge ${tones[tone]}`}>{children}</span>;
}

export function Price({ cents, symbol = '$', compareCents, className = '' }: { cents: number; symbol?: string; compareCents?: number | null; className?: string }) {
  return (
    <span className={`inline-flex items-baseline gap-1.5 ${className}`}>
      <span className="font-display text-brand text-[19px] leading-none">{symbol}{(cents / 100).toFixed(2)}</span>
      {compareCents != null && compareCents > cents && (
        <span className="text-[13px] font-bold text-muted line-through">{symbol}{(compareCents / 100).toFixed(2)}</span>
      )}
    </span>
  );
}

export function QtyStepper({ value, onChange, min = 1, max = 20, small = false }: {
  value: number; onChange: (v: number) => void; min?: number; max?: number; small?: boolean;
}) {
  return (
    <div className="inline-flex items-center gap-3 rounded-full border border-line bg-white p-1">
      <button type="button" className={small ? 'stepper-btn h-8 w-8' : 'stepper-btn'} onClick={() => onChange(value - 1)} disabled={value <= min} aria-label="Decrease quantity">
        <Icon name="minus" className="h-4 w-4" />
      </button>
      <span className={`min-w-5 text-center font-display ${small ? 'text-base' : 'text-lg'}`} aria-live="polite">{value}</span>
      <button type="button" className={small ? 'stepper-btn h-8 w-8' : 'stepper-btn'} onClick={() => onChange(value + 1)} disabled={value >= max} aria-label="Increase quantity">
        <Icon name="plus" className="h-4 w-4" />
      </button>
    </div>
  );
}

export function Sheet({ open, onClose, title, children, footer }: {
  open: boolean; onClose: () => void; title?: string; children: ReactNode; footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <button className="absolute inset-0 bg-charcoal/60 backdrop-blur-[2px]" onClick={onClose} aria-label="Close dialog" tabIndex={-1} />
      <div className="animate-sheet-up relative flex max-h-[88dvh] w-full max-w-lg flex-col rounded-t-3xl bg-white shadow-pop sm:rounded-3xl">
        <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-4">
          <div className="absolute left-1/2 top-2 h-1.5 w-10 -translate-x-1/2 rounded-full bg-line sm:hidden" />
          <h2 className="mt-2 text-lg">{title}</h2>
          <button onClick={onClose} className="mt-2 flex h-9 w-9 items-center justify-center rounded-full bg-surface text-charcoal hover:bg-line" aria-label="Close">
            <Icon name="close" className="h-4 w-4" />
          </button>
        </div>
        <div className="no-scrollbar flex-1 overflow-y-auto px-5 pb-4">{children}</div>
        {footer && <div className="border-t border-line bg-white px-5 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3">{footer}</div>}
      </div>
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-surface ${className}`} />;
}

export function ProductCardSkeleton() {
  return (
    <div className="card overflow-hidden">
      <Skeleton className="h-40 w-full rounded-none" />
      <div className="space-y-2 p-4">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-6 w-24" />
      </div>
    </div>
  );
}

export function EmptyState({ icon = 'sparkle', title, body, action }: {
  icon?: Parameters<typeof Icon>[0]['name']; title: string; body?: string; action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-soft text-brand">
        <Icon name={icon} className="h-7 w-7" />
      </span>
      <h3 className="text-xl text-charcoal">{title}</h3>
      {body && <p className="max-w-sm text-sm font-semibold text-muted">{body}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-surface text-charcoal">
        <Icon name="info" className="h-6 w-6" />
      </span>
      <p className="max-w-sm text-sm font-bold text-charcoal">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="btn btn-outline btn-sm">
          <Icon name="refresh" className="h-4 w-4" /> Try again
        </button>
      )}
    </div>
  );
}

export function Spinner({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-20" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
