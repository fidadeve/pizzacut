import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useFetch } from '../lib/useFetch';
import { useCart } from '../lib/cart';
import { useSettings } from '../lib/settings';
import { useToast } from '../lib/toast';
import type { ProductDetail } from '../lib/types';
import { money } from '../lib/format';
import { Badge, ErrorState, QtyStepper, Skeleton, SpiceLevel, VegMark } from '../components/ui';
import { Icon } from '../components/icons';

export function ProductPage() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const editId = params.get('edit');
  const navigate = useNavigate();
  const { settings } = useSettings();
  const { cart, addItem, updateItem, busy } = useCart();
  const { push } = useToast();

  const { data, loading, error, retry } = useFetch(
    () => api.get<{ product: ProductDetail }>(`/products/${encodeURIComponent(id)}`), [id],
  );
  const product = data?.product;

  const [size, setSize] = useState<string>('medium');
  const [crust, setCrust] = useState<string>('');
  const [toppings, setToppings] = useState<Set<string>>(new Set());
  const [extraCheese, setExtraCheese] = useState(false);
  const [qty, setQty] = useState(1);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!product || hydrated) return;
    const defaultSize = product.sizes.find(s => s.isDefault)?.size ?? product.sizes[0]?.size ?? 'medium';
    const defaultCrust = product.crusts.find(c => c.isDefault)?.name ?? product.crusts[0]?.name ?? '';
    setSize(defaultSize);
    setCrust(defaultCrust);
    if (editId && cart) {
      const item = cart.items.find(i => i.id === editId);
      if (item) {
        if (item.sizeKey) setSize(item.sizeKey);
        if (item.crust) setCrust(item.crust);
        setToppings(new Set(item.toppings.map(t => t.id)));
        setExtraCheese(item.extraCheese);
        setQty(item.qty);
      }
    }
    setHydrated(true);
  }, [product, hydrated, editId, cart]);

  const unitPrice = useMemo(() => {
    if (!product) return 0;
    const sizeDelta = product.sizes.find(s => s.size === size)?.deltaCents ?? 0;
    const crustDelta = product.crusts.find(c => c.name === crust)?.deltaCents ?? 0;
    const toppingsTotal = product.toppings.filter(t => toppings.has(t.id)).reduce((sum, t) => sum + t.priceCents, 0);
    // fromPriceCents is the base (small / as-served) price; size and crust deltas stack on top.
    return product.fromPriceCents + sizeDelta + crustDelta + toppingsTotal + (extraCheese ? product.extraCheeseCents : 0);
  }, [product, size, crust, toppings, extraCheese]);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 pt-5">
        <Skeleton className="h-72 w-full rounded-[28px] sm:h-96" />
        <Skeleton className="mt-5 h-7 w-2/3" />
        <Skeleton className="mt-2 h-4 w-full" />
        <Skeleton className="mt-6 h-40 w-full" />
        <Skeleton className="mt-4 h-40 w-full" />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="mx-auto max-w-3xl px-4 pt-6">
        <ErrorState message={error ?? 'That item could not be found.'} onRetry={error ? retry : undefined} />
        <div className="pb-6 text-center"><Link to="/menu" className="btn btn-outline btn-sm">Back to menu</Link></div>
      </div>
    );
  }

  const isPizza = product.sizes.length > 0 || product.crusts.length > 0;
  const toggleTopping = (tid: string) => {
    setToppings(prev => {
      const next = new Set(prev);
      if (next.has(tid)) next.delete(tid); else if (next.size < 8) next.add(tid);
      return next;
    });
  };

  const submit = async () => {
    try {
      if (editId) {
        await updateItem(editId, { size, crust, toppingIds: [...toppings], extraCheese, qty });
        push('Item updated');
        navigate('/cart');
      } else {
        await addItem({ productId: product.id, size: isPizza ? size : null, crust: isPizza ? crust : null, toppingIds: isPizza ? [...toppings] : [], extraCheese: isPizza ? extraCheese : false, qty });
        push(`${product.name} added to cart`);
        navigate('/cart');
      }
    } catch (err) {
      push(err instanceof Error ? err.message : 'Could not update your cart', 'error');
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 pb-40 pt-4 sm:pb-32">
      <button onClick={() => navigate(-1)} className="mb-3 flex items-center gap-1 text-[13px] font-extrabold text-muted hover:text-charcoal">
        <Icon name="chevronLeft" className="h-4 w-4" /> Back
      </button>

      {/* Hero image */}
      <div className="relative overflow-hidden rounded-[28px] bg-surface">
        <img src={product.image} alt={product.name} width={1400} height={1050} className="h-64 w-full object-cover sm:h-96" />
        <div className="absolute left-4 top-4 flex flex-col items-start gap-2">
          {product.discountPct > 0 && <Badge tone="brand">{product.discountPct}% off</Badge>}
          {product.badge && <Badge tone="dark">{product.badge}</Badge>}
        </div>
        {!product.available && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80"><Badge tone="dark">Currently unavailable</Badge></div>
        )}
      </div>

      {/* Title block */}
      <div className="mt-4">
        <div className="flex items-center gap-2.5">
          <VegMark isVeg={product.isVeg} />
          <SpiceLevel level={product.spiceLevel} />
          <Link to={`/menu?category=${product.category?.slug ?? ''}`} className="ml-auto text-[12px] font-extrabold text-brand hover:underline">
            {product.category?.name}
          </Link>
        </div>
        <h1 className="mt-1.5 text-[28px] leading-tight text-ink sm:text-[34px]">{product.name}</h1>
        <p className="mt-1.5 text-[14px] font-semibold leading-relaxed text-muted">{product.description}</p>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="font-display text-[26px] text-brand">{money(unitPrice, settings.currencySymbol)}</span>
          {product.comparePriceCents && product.comparePriceCents > unitPrice && (
            <span className="text-[15px] font-bold text-muted line-through">{money(product.comparePriceCents, settings.currencySymbol)}</span>
          )}
          <span className="text-[12.5px] font-bold text-muted">per item{isPizza ? ' · price updates with your picks' : ''}</span>
        </div>
      </div>

      {isPizza && (
        <>
          {/* Size */}
          <section className="mt-7">
            <div className="mb-2.5 flex items-center justify-between">
              <h2 className="text-lg text-ink">Choose your size <span className="ml-1 text-[11px] font-extrabold uppercase tracking-wide text-brand">Required</span></h2>
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              {product.sizes.map(s => {
                const active = size === s.size;
                return (
                  <button key={s.size} onClick={() => setSize(s.size)}
                    className={`rounded-2xl border-2 p-3 text-left transition-all ${active ? 'border-brand bg-brand-soft' : 'border-line bg-white hover:border-charcoal/30'}`}
                    aria-pressed={active}>
                    <span className="block text-[13.5px] font-extrabold text-ink">{s.name.split(' · ')[0]}</span>
                    <span className="block text-[11.5px] font-bold text-muted">{s.name.split(' · ')[1]}</span>
                    <span className={`mt-1 block font-display text-[15px] ${active ? 'text-brand' : 'text-charcoal'}`}>
                      {s.deltaCents === 0 ? 'Base' : `+${money(s.deltaCents, settings.currencySymbol)}`}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Crust */}
          <section className="mt-7">
            <h2 className="mb-2.5 text-lg text-ink">Pick your crust <span className="ml-1 text-[11px] font-extrabold uppercase tracking-wide text-brand">Required</span></h2>
            <div className="overflow-hidden rounded-2xl border border-line">
              {product.crusts.map((c, i) => {
                const active = crust === c.name;
                return (
                  <button key={c.name} onClick={() => setCrust(c.name)}
                    className={`flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors ${i > 0 ? 'border-t border-line' : ''} ${active ? 'bg-brand-soft' : 'bg-white hover:bg-surface'}`}
                    aria-pressed={active}>
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${active ? 'border-brand' : 'border-line'}`}>
                      {active && <span className="h-2.5 w-2.5 rounded-full bg-brand" />}
                    </span>
                    <span className="text-[14px] font-extrabold text-ink">{c.name}</span>
                    <span className="ml-auto text-[13px] font-bold text-muted">
                      {c.deltaCents === 0 ? 'Included' : `+${money(c.deltaCents, settings.currencySymbol)}`}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Toppings */}
          <section className="mt-7">
            <div className="mb-2.5 flex items-center justify-between">
              <h2 className="text-lg text-ink">Extra toppings <span className="ml-1 text-[11px] font-extrabold uppercase tracking-wide text-muted">Optional</span></h2>
              <span className="text-[12px] font-bold text-muted">{toppings.size}/8 chosen</span>
            </div>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {product.toppings.map(t => {
                const active = toppings.has(t.id);
                return (
                  <button key={t.id} onClick={() => t.available && toggleTopping(t.id)} disabled={!t.available}
                    aria-pressed={active}
                    className={`flex items-center gap-2 rounded-2xl border-2 p-3 text-left transition-all ${
                      !t.available ? 'cursor-not-allowed border-line bg-surface opacity-60'
                      : active ? 'border-brand bg-brand-soft' : 'border-line bg-white hover:border-charcoal/30'}`}>
                    <VegMark isVeg={t.isVeg} className="h-4 w-4" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-extrabold text-ink">{t.name}</span>
                      <span className="block text-[11.5px] font-bold text-muted">
                        {t.available ? `+${money(t.priceCents, settings.currencySymbol)}` : 'Unavailable'}
                      </span>
                    </span>
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 ${active ? 'border-brand bg-brand text-white' : 'border-line'}`}>
                      {active && <Icon name="check" className="h-3 w-3" strokeWidth={3.2} />}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Extra cheese */}
          <section className="mt-7">
            <h2 className="mb-2.5 text-lg text-ink">Make it extra cheesy <span className="ml-1 text-[11px] font-extrabold uppercase tracking-wide text-muted">Optional</span></h2>
            <button onClick={() => setExtraCheese(v => !v)} aria-pressed={extraCheese}
              className={`flex w-full items-center gap-3 rounded-2xl border-2 p-4 text-left transition-all ${extraCheese ? 'border-brand bg-brand-soft' : 'border-line bg-white hover:border-charcoal/30'}`}>
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 ${extraCheese ? 'border-brand bg-brand text-white' : 'border-line'}`}>
                {extraCheese && <Icon name="check" className="h-3 w-3" strokeWidth={3.2} />}
              </span>
              <span className="text-[14px] font-extrabold text-ink">Double mozzarella layer</span>
              <span className="ml-auto font-display text-[15px] text-brand">+{money(product.extraCheeseCents, settings.currencySymbol)}</span>
            </button>
          </section>
        </>
      )}

      {/* Quantity */}
      <section className="mt-7 flex items-center justify-between">
        <h2 className="text-lg text-ink">Quantity</h2>
        <QtyStepper value={qty} onChange={setQty} />
      </section>

      {/* Info rows */}
      <section className="mt-7 space-y-2 rounded-3xl bg-surface p-4 text-[13px] font-semibold text-muted">
        <p className="flex items-center gap-2"><Icon name="clock" className="h-4 w-4 text-brand" /> Ready in about {settings.etaDeliveryMinutes} min · pickup in {settings.etaPickupMinutes} min</p>
        <p className="flex items-center gap-2"><Icon name="bike" className="h-4 w-4 text-brand" /> Delivered hot, or free pickup from {settings.address}</p>
      </section>

      {/* Sticky action bar */}
      <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+4.25rem)] z-40 border-t border-line bg-white/95 px-4 py-3 backdrop-blur-md lg:bottom-0">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <div className="min-w-0">
            <p className="truncate text-[13px] font-extrabold text-ink">{qty} × {product.name}</p>
            <p className="font-display text-[20px] leading-tight text-brand">{money(unitPrice * qty, settings.currencySymbol)}</p>
          </div>
          <button onClick={() => void submit()} disabled={busy || !product.available} className="btn btn-primary ml-auto min-w-40">
            {busy ? 'Working…' : editId ? 'Update item' : 'Add to cart'}
          </button>
        </div>
      </div>
    </div>
  );
}
