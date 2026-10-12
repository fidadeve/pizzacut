import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../lib/cart';
import { useSettings } from '../lib/settings';
import { useToast } from '../lib/toast';
import { money } from '../lib/format';
import { EmptyState, ErrorState, QtyStepper, Skeleton, VegMark } from '../components/ui';
import { Icon } from '../components/icons';

export function CartPage() {
  const { cart, loading, error, refresh, updateItem, removeItem, applyPromo, removePromo, busy } = useCart();
  const { settings } = useSettings();
  const { push } = useToast();
  const navigate = useNavigate();
  const [promoInput, setPromoInput] = useState('');
  const [promoError, setPromoError] = useState<string | null>(null);

  const sym = settings.currencySymbol || cart?.settings.currencySymbol || '$';

  if (loading && !cart) {
    return (
      <div className="mx-auto max-w-3xl space-y-3 px-4 pt-6">
        <Skeleton className="h-8 w-40" />
        {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error && !cart) {
    return <div className="mx-auto max-w-3xl px-4 pt-6"><ErrorState message={error} onRetry={refresh} /></div>;
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4">
        <EmptyState
          icon="cart" title="Your cart is empty"
          body="Hungry eyes, empty cart. The menu is full of reasons to fix that."
          action={<Link to="/menu" className="btn btn-primary btn-sm">Browse the menu</Link>}
        />
      </div>
    );
  }

  const deliveryGap = Math.max(0, settings.freeDeliveryMinCents - cart.subtotalCents);

  const applyCode = async () => {
    setPromoError(null);
    try {
      await applyPromo(promoInput.trim());
      setPromoInput('');
      push('Promo code applied');
    } catch (err) {
      setPromoError(err instanceof Error ? err.message : 'Could not apply that code');
    }
  };

  const changeQty = async (id: string, qty: number) => {
    try { await updateItem(id, { qty }); } catch (err) { push(err instanceof Error ? err.message : 'Could not update quantity', 'error'); }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 pb-8 pt-5">
      <div className="flex items-center justify-between">
        <h1 className="text-[26px] text-ink sm:text-3xl">Your cart</h1>
        <Link to="/menu" className="text-[13px] font-extrabold text-brand hover:underline">+ Add more food</Link>
      </div>

      <ul className="mt-4 space-y-3">
        {cart.items.map(item => {
          const customization = [item.size, item.crust, ...item.toppings.map(t => t.name), item.extraCheese ? 'Extra cheese' : null]
            .filter(Boolean).join(' · ');
          return (
            <li key={item.id} className="card flex gap-3 p-3.5">
              <Link to={`/product/${item.product.slug}?edit=${item.id}`} className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-surface">
                <img src={item.product.image} alt={item.name} width={200} height={200} className="h-full w-full object-cover" />
              </Link>
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-start gap-2">
                  <VegMark isVeg={item.product.isVeg} className="mt-0.5 h-4 w-4" />
                  <h2 className="line-clamp-1 flex-1 text-[15px] font-extrabold text-ink" style={{ fontFamily: 'var(--font-sans)' }}>{item.name}</h2>
                  <button onClick={() => { void removeItem(item.id).then(() => push(`${item.name} removed`)).catch(() => push('Could not remove item', 'error')); }}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-brand-soft hover:text-brand"
                    aria-label={`Remove ${item.name} from cart`}>
                    <Icon name="trash" className="h-4 w-4" />
                  </button>
                </div>
                {customization && <p className="mt-0.5 line-clamp-2 text-[12px] font-semibold text-muted">{customization}</p>}
                <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                  <QtyStepper small value={item.qty} onChange={v => void changeQty(item.id, v)} />
                  <div className="text-right">
                    <p className="font-display text-[17px] text-brand">{money(item.lineTotalCents, sym)}</p>
                    {item.qty > 1 && <p className="text-[11px] font-bold text-muted">{money(item.unitPriceCents, sym)} each</p>}
                  </div>
                </div>
                {item.customizable && (
                  <Link to={`/product/${item.product.slug}?edit=${item.id}`} className="mt-2 flex items-center gap-1 text-[12px] font-extrabold text-charcoal hover:text-brand">
                    <Icon name="edit" className="h-3.5 w-3.5" /> Edit customization
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {/* Promo */}
      <section className="card mt-5 p-4">
        <h2 className="text-base text-ink">Promo code</h2>
        {cart.promo ? (
          <div className="mt-2 flex items-center gap-3 rounded-2xl border-2 border-dashed border-brand bg-brand-soft p-3">
            <Icon name="tag" className="h-5 w-5 shrink-0 text-brand" />
            <div className="min-w-0">
              <p className="font-display text-lg leading-none text-brand">{cart.promo.code}</p>
              <p className="truncate text-[12px] font-bold text-muted">{cart.promo.description} · you save {money(cart.discountCents, sym)}</p>
            </div>
            <button onClick={() => { void removePromo(); }} className="btn btn-ghost btn-xs ml-auto" aria-label="Remove promo code">Remove</button>
          </div>
        ) : (
          <>
            <div className="mt-2 flex gap-2">
              <input value={promoInput} onChange={e => { setPromoInput(e.target.value.toUpperCase()); setPromoError(null); }}
                className="field flex-1 uppercase tracking-wider" placeholder="e.g. SAVE20" aria-label="Promo code" />
              <button onClick={() => void applyCode()} disabled={busy || !promoInput.trim()} className="btn btn-dark btn-sm">Apply</button>
            </div>
            {promoError && <p className="mt-2 text-[12.5px] font-bold text-brand" role="alert">{promoError}</p>}
            <Link to="/offers" className="mt-2 inline-block text-[12.5px] font-extrabold text-brand hover:underline">See available codes</Link>
          </>
        )}
      </section>

      {/* Summary */}
      <section className="card mt-4 p-4">
        <h2 className="mb-3 text-base text-ink">Bill summary</h2>
        <dl className="space-y-2 text-[13.5px] font-bold">
          <div className="flex justify-between"><dt className="text-muted">Item total</dt><dd className="text-ink">{money(cart.subtotalCents, sym)}</dd></div>
          {cart.discountCents > 0 && (
            <div className="flex justify-between text-brand"><dt>Discount ({cart.promo?.code})</dt><dd>−{money(cart.discountCents, sym)}</dd></div>
          )}
          <div className="flex justify-between">
            <dt className="text-muted">Delivery</dt>
            <dd className="text-ink">
              {deliveryGap > 0
                ? `${money(settings.deliveryFeeCents, sym)} · add ${money(deliveryGap, sym)} for free`
                : <span className="text-brand">Free</span>}
            </dd>
          </div>
          <div className="flex justify-between"><dt className="text-muted">Taxes ({settings.taxPct}%)</dt><dd className="text-ink">Calculated at checkout</dd></div>
          <div className="divider mt-2 pt-2"><div className="flex items-baseline justify-between"><dt className="text-base font-extrabold text-ink">Total</dt><dd className="font-display text-2xl text-brand">{money(cart.subtotalCents - cart.discountCents, sym)}<span className="text-[11px] font-bold text-muted"> +taxes</span></dd></div></div>
        </dl>
        <button onClick={() => navigate('/checkout')} className="btn btn-primary mt-4 w-full">
          Proceed to checkout <Icon name="chevronRight" className="h-4 w-4" />
        </button>
        <p className="mt-2 text-center text-[11.5px] font-semibold text-muted">Final prices, taxes and discounts are confirmed by our kitchen system before you pay.</p>
      </section>
    </div>
  );
}
