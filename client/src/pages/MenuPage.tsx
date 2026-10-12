import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useFetch } from '../lib/useFetch';
import type { Category, Product } from '../lib/types';
import { ProductCard } from '../components/ProductCard';
import { EmptyState, ErrorState, ProductCardSkeleton } from '../components/ui';
import { Icon } from '../components/icons';

export function MenuPage() {
  const [params, setParams] = useSearchParams();
  const category = params.get('category') ?? '';
  const q = params.get('q') ?? '';
  const vegOnly = params.get('veg') === '1';
  const sort = params.get('sort') ?? 'recommended';

  const cats = useFetch(() => api.get<{ categories: Category[] }>('/categories'), []);
  const query = useMemo(() => {
    const sp = new URLSearchParams();
    if (category) sp.set('category', category);
    if (q) sp.set('q', q);
    if (vegOnly) sp.set('veg', '1');
    if (sort !== 'recommended') sp.set('sort', sort);
    const s = sp.toString();
    return s ? `?${s}` : '';
  }, [category, q, vegOnly, sort]);

  const prods = useFetch(() => api.get<{ products: Product[] }>(`/products${query}`), [query]);

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    setParams(next, { replace: true });
  };

  const activeCategory = cats.data?.categories.find(c => c.slug === category);
  const products = prods.data?.products ?? [];

  return (
    <div className="mx-auto max-w-5xl px-4 pt-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] leading-tight text-ink sm:text-3xl">
            {activeCategory ? activeCategory.name : q ? `Results for “${q}”` : 'Our menu'}
          </h1>
          <p className="mt-0.5 text-[13px] font-semibold text-muted">
            {prods.loading ? 'Loading…' : `${products.length} item${products.length === 1 ? '' : 's'} available`}
          </p>
        </div>
        <label className="flex cursor-pointer items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-2 text-[13px] font-extrabold text-charcoal transition-colors hover:border-brand/40">
          <input type="checkbox" checked={vegOnly} onChange={e => setParam('veg', e.target.checked ? '1' : null)} className="peer sr-only" />
          <span className={`flex h-4 w-4 items-center justify-center rounded-[4px] border-2 border-charcoal transition-colors ${vegOnly ? 'bg-charcoal' : 'bg-white'}`}>
            {vegOnly && <Icon name="check" className="h-3 w-3 text-white" strokeWidth={3} />}
          </span>
          Veg only
        </label>
      </div>

      {/* Category chips */}
      <div className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1">
        <button onClick={() => setParam('category', null)}
          className={`chip border ${!category ? 'border-brand bg-brand text-white' : 'border-line bg-white text-charcoal hover:border-charcoal/30'}`}>
          All
        </button>
        {(cats.data?.categories ?? []).map(cat => (
          <button key={cat.id} onClick={() => setParam('category', cat.slug)}
            className={`chip border ${category === cat.slug ? 'border-brand bg-brand text-white' : 'border-line bg-white text-charcoal hover:border-charcoal/30'}`}>
            {cat.name}
          </button>
        ))}
      </div>

      {/* Sort row */}
      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="flex gap-2">
          {([['recommended', 'Recommended'], ['price_asc', 'Price ↑'], ['price_desc', 'Price ↓']] as const).map(([key, label]) => (
            <button key={key} onClick={() => setParam('sort', key === 'recommended' ? null : key)}
              className={`text-[12.5px] font-extrabold transition-colors ${sort === key ? 'text-brand' : 'text-muted hover:text-charcoal'}`}>
              {label}
            </button>
          ))}
        </div>
        {(q || category || vegOnly) && (
          <button onClick={() => setParams(new URLSearchParams(), { replace: true })} className="flex items-center gap-1 text-[12.5px] font-extrabold text-charcoal hover:text-brand">
            <Icon name="close" className="h-3.5 w-3.5" /> Clear filters
          </button>
        )}
      </div>

      {/* Grid */}
      <div className="mt-4 pb-4">
        {prods.loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => <ProductCardSkeleton key={i} />)}
          </div>
        ) : prods.error ? (
          <ErrorState message={prods.error} onRetry={prods.retry} />
        ) : products.length === 0 ? (
          <EmptyState
            icon="search"
            title="Nothing matches that"
            body="Try a different search or clear your filters — the full menu is one tap away."
            action={<button onClick={() => setParams(new URLSearchParams(), { replace: true })} className="btn btn-primary btn-sm">Show everything</button>}
          />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {products.map(p => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </div>

      <p className="pb-2 text-center text-[12.5px] font-semibold text-muted">
        Prices include our signature sauce and cheese.{' '}
        <Link to="/offers" className="font-extrabold text-brand hover:underline">See active promo codes</Link>.
      </p>
    </div>
  );
}
