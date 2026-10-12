import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useFetch } from '../lib/useFetch';
import { useSettings } from '../lib/settings';
import { useToast } from '../lib/toast';
import type { PublicPromo } from '../lib/types';
import { money } from '../lib/format';
import { ErrorState, Skeleton } from '../components/ui';
import { Icon } from '../components/icons';

export function OffersPage() {
  const { settings } = useSettings();
  const { push } = useToast();
  const { data, loading, error, retry } = useFetch(() => api.get<{ promos: PublicPromo[] }>('/promos'), []);
  const promos = data?.promos ?? [];
  const sym = settings.currencySymbol;

  const copy = (code: string) => {
    navigator.clipboard?.writeText(code).then(() => push(`Code ${code} copied`)).catch(() => push(`Use code ${code} at checkout`, 'info'));
  };

  return (
    <div className="mx-auto max-w-2xl px-4 pb-10 pt-5">
      <div className="rounded-[28px] bg-charcoal p-6 text-white">
        <span className="pill-badge bg-brand text-white">Deals</span>
        <h1 className="mt-3 text-3xl leading-tight">Save more,<br />eat better.</h1>
        <p className="mt-2 max-w-sm text-[13.5px] font-semibold text-white/75">
          Active promo codes from the PizzaCut kitchen. Copy one, apply it in the cart, and the discount is verified by our system before you pay.
        </p>
      </div>

      <h2 className="mb-3 mt-7 text-xl text-ink">Active promo codes</h2>
      {loading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}</div>
      ) : error ? (
        <ErrorState message={error} onRetry={retry} />
      ) : (
        <ul className="space-y-3">
          {promos.map(promo => (
            <li key={promo.code} className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-2xl border-2 border-dashed border-brand px-3 py-1.5 font-display text-xl tracking-wide text-brand">
                    {promo.code}
                  </span>
                  <button onClick={() => copy(promo.code)} className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-surface hover:text-brand" aria-label={`Copy code ${promo.code}`}>
                    <Icon name="copy" className="h-4 w-4" />
                  </button>
                </div>
                <p className="mt-2 text-[14px] font-extrabold text-ink">{promo.description}</p>
                <p className="text-[12px] font-semibold text-muted">
                  {promo.minOrderCents > 0 ? `Minimum order ${money(promo.minOrderCents, sym)}` : 'No minimum order'}
                  {promo.maxDiscountCents != null ? ` · saves up to ${money(promo.maxDiscountCents, sym)}` : ''}
                </p>
              </div>
              <Link to="/menu" className="btn btn-primary btn-sm shrink-0">Use this code</Link>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-7 rounded-3xl border border-line bg-surface p-5">
        <h2 className="text-lg text-ink">How to redeem</h2>
        <ol className="mt-3 space-y-3">
          {[
            ['Pick your food', 'Add pizzas, sides and drinks to your cart.'],
            ['Apply the code', 'Tap the promo field in your cart and hit Apply.'],
            ['We verify it', 'Our system checks the code, minimum order and discount before you pay.'],
          ].map(([title, body], i) => (
            <li key={title} className="flex gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand font-display text-base text-white">{i + 1}</span>
              <div>
                <p className="text-[14px] font-extrabold text-ink">{title}</p>
                <p className="text-[12.5px] font-semibold text-muted">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
