import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from './icons';

export function Section({ title, subtitle, to, toLabel = 'See all', children, className = '' }: {
  title: string; subtitle?: string; to?: string; toLabel?: string; children: ReactNode; className?: string;
}) {
  return (
    <section className={`animate-fade-up ${className}`}>
      <div className="mb-3 flex items-end justify-between gap-4 px-4 sm:px-0">
        <div>
          <h2 className="text-[21px] leading-tight text-ink sm:text-2xl">{title}</h2>
          {subtitle && <p className="mt-0.5 text-[13px] font-semibold text-muted">{subtitle}</p>}
        </div>
        {to && (
          <Link to={to} className="flex shrink-0 items-center gap-0.5 text-[13px] font-extrabold text-brand hover:text-brand-dark">
            {toLabel} <Icon name="chevronRight" className="h-4 w-4" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
