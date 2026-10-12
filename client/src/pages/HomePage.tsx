import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useFetch } from '../lib/useFetch';
import { useSettings } from '../lib/settings';
import { useCart } from '../lib/cart';
import { useToast } from '../lib/toast';
import type { Category, Order, Product, PublicPromo } from '../lib/types';
import { money } from '../lib/format';
import { ProductCard } from '../components/ProductCard';
import { Section } from '../components/Section';
import { Badge, ErrorState, ProductCardSkeleton, Skeleton } from '../components/ui';
import { Icon } from '../components/icons';
import { useSelectedAddress } from '../components/AddressSelector';

export function HomePage() {
  const { settings } = useSettings();
  const sym = settings.currencySymbol;
  const navigate = useNavigate();
  const { addItem } = useCart();
  const { push } = useToast();
  const { selected } = useSelectedAddress();

  const cats = useFetch(() => api.get<{ categories: Category[] }>('/categories'), []);
  const prods = useFetch(() => api.get<{ products: Product[] }>('/products'), []);
  const promos = useFetch(() => api.get<{ promos: PublicPromo[] }>('/promos'), []);
  const orders = useFetch(() => api.get<{ orders: Order[] }>('/orders'), []);

  const products = prods.data?.products ?? [];
  const bestSellers = products.filter(p => p.badge === 'Bestseller');
  const specials = products.filter(p => p.badge === 'Chef\u2019s Pick');
  const combos = products.filter(p => p.isCombo).slice(0, 4);
  const addOns = products.filter(p => ['sides', 'drinks'].includes(p.category?.slug ?? '')).slice(0, 6);
  const heroPromo = promos.data?.promos.find(p => p.code === 'SAVE20') ?? promos.data?.promos[0];

  const lastOrderItems = orders.data?.orders[0]?.items.slice(0, 4) ?? [];

  const quickAdd = async (product: Product) => {
    try { await addItem({ productId: product.id }); push(`${product.name} added to cart`); }
    catch (err) { push(err instanceof Error ? err.message : 'Could not add item', 'error'); }
  };

  return (
    <div className="pb-2">
      {/* Hero */}
      <section className="px-4 pt-4 sm:px-0">
        <div className="relative mx-auto max-w-5xl overflow-hidden rounded-[28px] bg-charcoal text-white">
          <img
            src="/images/banner-feast.webp" alt="Freshly baked PizzaCut pizza with sides" width={1400} height={933}
            className="absolute inset-y-0 right-0 h-full w-[62%] object-cover opacity-90 sm:w-[52%]"
          />
          <div className="absolute inset-y-0 right-0 w-[75%] bg-gradient-to-r from-charcoal via-charcoal/70 to-transparent sm:w-[65%]" aria-hidden="true" />
          <div className="relative flex min-h-[320px] flex-col justify-center gap-4 p-6 sm:min-h-[360px] sm:p-10">
            <div className="animate-fade-up flex items-center gap-2">
              <Badge tone="brand">Hot &amp; fresh</Badge>
              <span className="flex items-center gap-1 text-[12px] font-extrabold text-white/80">
                <Icon name="star" filled className="h-3.5 w-3.5 text-brand" /> 4.8 · 12k+ happy foodies
              </span>
            </div>
            <h1 className="animate-fade-up max-w-md text-[34px] leading-[1.05] sm:text-5xl" style={{ animationDelay: '60ms' }}>
              Real pizza.<br />Ready in <span className="text-brand">{settings.etaDeliveryMinutes} minutes.</span>
            </h1>
            <p className="animate-fade-up max-w-sm text-[14px] font-semibold text-white/75" style={{ animationDelay: '120ms' }}>
              Hand-stretched dough, 100% mozzarella and toppings that don't hold back. {selected ? `Delivering to ${selected.label}.` : 'Delivered hot to your door.'}
            </p>
            <div className="animate-fade-up flex flex-wrap items-center gap-3" style={{ animationDelay: '180ms' }}>
              <button onClick={() => navigate('/menu')} className="btn btn-primary">Order Now</button>
              <Link to="/offers" className="btn btn-outline border-white/25 bg-white/10 text-white hover:border-white/50">Today's deals</Link>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="mt-7">
        <div className="mb-3 flex items-end justify-between px-4 sm:px-0">
          <h2 className="text-[21px] text-ink sm:text-2xl">What are you craving?</h2>
          <Link to="/menu" className="flex items-center gap-0.5 text-[13px] font-extrabold text-brand">Full menu <Icon name="chevronRight" className="h-4 w-4" /></Link>
        </div>
        {cats.loading ? (
          <div className="no-scrollbar flex gap-3 overflow-x-auto px-4 pb-1 sm:px-0">
            {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-[92px] w-[88px] shrink-0 rounded-2xl" />)}
          </div>
        ) : cats.error ? <ErrorState message={cats.error} onRetry={cats.retry} /> : (
          <div className="no-scrollbar flex gap-3 overflow-x-auto px-4 pb-1 sm:px-0">
            {cats.data!.categories.map(cat => (
              <Link key={cat.id} to={`/menu?category=${cat.slug}`}
                className="group flex w-[88px] shrink-0 flex-col items-center gap-2 text-center">
                <span className="relative h-[76px] w-[76px] overflow-hidden rounded-3xl border-2 border-transparent bg-surface transition-all duration-200 group-hover:border-brand group-hover:shadow-brand">
                  <img src={cat.image} alt="" width={200} height={200} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110" />
                </span>
                <span className="text-[11.5px] font-extrabold leading-tight text-charcoal">{cat.name}</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Best sellers */}
      <div className="mt-8">
        <Section title="Best sellers" subtitle="The pies everyone keeps ordering" to="/menu?sort=popular">
          {prods.loading ? (
            <div className="no-scrollbar flex gap-4 overflow-x-auto px-4 pb-1 sm:px-0">
              {Array.from({ length: 3 }).map((_, i) => <div key={i} className="w-56 shrink-0"><ProductCardSkeleton /></div>)}
            </div>
          ) : prods.error ? <ErrorState message={prods.error} onRetry={prods.retry} /> : (
            <div className="no-scrollbar flex gap-4 overflow-x-auto px-4 pb-2 sm:px-0" style={{ scrollSnapType: 'x mandatory' }}>
              {bestSellers.map(p => <ProductCard key={p.id} product={p} layout="rail" />)}
            </div>
          )}
        </Section>
      </div>

      {/* Today's special */}
      {specials[0] && (
        <div className="mt-8">
          <Section title="Today's special" subtitle="Chef-picked, limited batches">
            <Link to={`/product/${specials[0].slug}`} className="group relative mx-4 block max-w-5xl overflow-hidden rounded-[28px] bg-charcoal text-white sm:mx-0">
              <img src="/images/pizza-oven.webp" alt="Wood-fired pizza coming out of the oven" width={1400} height={933}
                className="absolute inset-0 h-full w-full object-cover opacity-55 transition-transform duration-500 group-hover:scale-105" />
              <div className="relative flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-9">
                <div>
                  <Badge tone="brand">{specials[0].badge}</Badge>
                  <h3 className="mt-2 text-3xl sm:text-4xl">{specials[0].name}</h3>
                  <p className="mt-1 max-w-md text-[13.5px] font-semibold text-white/75">{specials[0].description}</p>
                </div>
                <div className="flex shrink-0 items-center gap-4">
                  <div className="text-right">
                    <p className="font-display text-3xl text-brand">{money(specials[0].priceCents, sym)}</p>
                    <p className="text-[11px] font-bold text-white/60">Medium · fully customizable</p>
                  </div>
                  <span className="btn btn-primary">Customize</span>
                </div>
              </div>
            </Link>
          </Section>
        </div>
      )}

      {/* Combos */}
      <div className="mt-8">
        <Section title="Combo meal deals" subtitle="More food, less maths" to="/menu?category=special-deals">
          <div className="no-scrollbar flex gap-4 overflow-x-auto px-4 pb-2 sm:px-0" style={{ scrollSnapType: 'x mandatory' }}>
            {combos.map(p => (
              <Link key={p.id} to={`/product/${p.slug}`}
                className="card group flex w-64 shrink-0 flex-col overflow-hidden transition-shadow hover:shadow-pop" style={{ scrollSnapAlign: 'start' }}>
                <div className="h-32 overflow-hidden bg-surface">
                  <img src={p.image} alt={p.name} loading="lazy" width={720} height={540} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                </div>
                <div className="flex flex-1 flex-col gap-1 p-4">
                  {p.badge && <div><Badge tone="brand">{p.badge}</Badge></div>}
                  <h3 className="text-[15px] font-extrabold" style={{ fontFamily: 'var(--font-sans)' }}>{p.name}</h3>
                  <p className="line-clamp-2 text-[12px] font-semibold text-muted">{p.description}</p>
                  <div className="mt-auto flex items-center justify-between pt-2">
                    <span className="font-display text-[19px] text-brand">{money(p.priceCents, sym)}</span>
                    <button className="btn btn-dark btn-xs" onClick={e => { e.preventDefault(); void quickAdd(p); }}>Add</button>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </Section>
      </div>

      {/* Promo banners */}
      <section className="mt-8 grid gap-4 px-4 sm:px-0 md:grid-cols-2">
        <div className="animate-fade-up relative overflow-hidden rounded-[28px] bg-brand p-6 text-white">
          <Badge tone="light">Limited time</Badge>
          <h3 className="mt-3 text-[28px] leading-tight">{heroPromo ? heroPromo.description : 'Fresh deals every week'}</h3>
          <p className="mt-1 text-[13px] font-semibold text-white/85">Apply the code at checkout — discounts are verified by our kitchen system.</p>
          {heroPromo && (
            <button
              onClick={() => { navigator.clipboard?.writeText(heroPromo.code); push(`Code ${heroPromo.code} copied`); }}
              className="mt-4 inline-flex items-center gap-2 rounded-2xl border-2 border-dashed border-white/60 px-4 py-2 font-display text-xl tracking-wider transition-colors hover:bg-white/10"
              aria-label={`Copy promo code ${heroPromo.code}`}>
              {heroPromo.code} <Icon name="copy" className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="animate-fade-up rounded-[28px] bg-charcoal p-6 text-white" style={{ animationDelay: '80ms' }}>
          <Badge tone="brand">Free delivery</Badge>
          <h3 className="mt-3 text-[28px] leading-tight">Delivery is on us over {money(settings.freeDeliveryMinCents, sym)}</h3>
          <p className="mt-1 text-[13px] font-semibold text-white/75">
            Standard delivery is {money(settings.deliveryFeeCents, sym)}. Pickup is always free and ready in {settings.etaPickupMinutes} minutes.
          </p>
          <Link to="/menu" className="btn btn-outline mt-4 border-white/25 bg-white/10 text-white hover:border-white/50">Start an order</Link>
        </div>
      </section>

      {/* Popular add-ons */}
      <div className="mt-8">
        <Section title="Popular add-ons" subtitle="Because a pizza deserves backup">
          {prods.loading ? (
            <div className="no-scrollbar flex gap-4 overflow-x-auto px-4 sm:px-0">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40 w-44 shrink-0" />)}</div>
          ) : (
            <div className="no-scrollbar flex gap-3 overflow-x-auto px-4 pb-2 sm:px-0">
              {addOns.map(p => (
                <div key={p.id} className="card flex w-44 shrink-0 flex-col overflow-hidden">
                  <Link to={`/product/${p.slug}`} className="block h-24 overflow-hidden bg-surface">
                    <img src={p.image} alt={p.name} loading="lazy" width={720} height={540} className="h-full w-full object-cover" />
                  </Link>
                  <div className="flex flex-1 flex-col gap-1 p-3">
                    <h3 className="line-clamp-1 text-[13px] font-extrabold" style={{ fontFamily: 'var(--font-sans)' }}>{p.name}</h3>
                    <div className="mt-auto flex items-center justify-between">
                      <span className="font-display text-[15px] text-brand">{money(p.priceCents, sym)}</span>
                      <button onClick={() => void quickAdd(p)} className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-white transition-transform active:scale-90" aria-label={`Add ${p.name} to cart`}>
                        <Icon name="plus" className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>

      {/* Recently ordered */}
      <div className="mt-8">
        <Section title="Recently ordered" to={orders.data?.orders.length ? '/orders' : undefined}>
          {orders.loading ? (
            <div className="px-4 sm:px-0"><Skeleton className="h-24 w-full" /></div>
          ) : lastOrderItems.length ? (
            <div className="no-scrollbar flex gap-3 overflow-x-auto px-4 pb-2 sm:px-0">
              {lastOrderItems.map(item => (
                <button key={item.id} onClick={() => navigate(`/product/${item.productId}`)}
                  className="card flex w-60 shrink-0 items-center gap-3 p-3 text-left transition-shadow hover:shadow-pop">
                  <img src={item.image} alt={item.name} loading="lazy" className="h-14 w-14 shrink-0 rounded-2xl object-cover" />
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-extrabold">{item.name}</span>
                    <span className="block text-[12px] font-bold text-brand">{money(item.lineTotalCents, sym)}</span>
                  </span>
                  <span className="ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand"><Icon name="refresh" className="h-4 w-4" /></span>
                </button>
              ))}
            </div>
          ) : (
            <div className="px-4 sm:px-0">
              <div className="flex items-center gap-4 rounded-3xl border border-dashed border-line p-5">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand"><Icon name="clock" className="h-6 w-6" /></span>
                <div>
                  <p className="text-[14px] font-extrabold text-charcoal">No orders yet?</p>
                  <p className="text-[13px] font-semibold text-muted">Your recent orders will show up here for one-tap reordering.</p>
                </div>
                <Link to="/menu" className="btn btn-outline btn-sm ml-auto hidden sm:inline-flex">Browse menu</Link>
              </div>
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}
