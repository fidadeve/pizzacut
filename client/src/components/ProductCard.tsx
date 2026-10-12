import { Link, useNavigate } from 'react-router-dom';
import type { Product } from '../lib/types';
import { money } from '../lib/format';
import { useCart } from '../lib/cart';
import { useToast } from '../lib/toast';
import { useSettings } from '../lib/settings';
import { Badge, Price, VegMark, SpiceLevel } from './ui';
import { Icon } from './icons';

export function ProductCard({ product, layout = 'grid' }: { product: Product; layout?: 'grid' | 'rail' }) {
  const { addItem } = useCart();
  const { push } = useToast();
  const { settings } = useSettings();
  const navigate = useNavigate();

  const rail = layout === 'rail';

  const handleAdd = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!product.available) return;
    if (product.customizable) { navigate(`/product/${product.slug}`); return; }
    try {
      await addItem({ productId: product.id });
      push(`${product.name} added to cart`);
    } catch (err) {
      push(err instanceof Error ? err.message : 'Could not add item', 'error');
    }
  };

  return (
    <Link
      to={`/product/${product.slug}`}
      className={`card group relative flex overflow-hidden transition-shadow duration-200 hover:shadow-pop ${rail ? 'w-56 shrink-0 flex-col snap-start sm:w-60' : 'flex-col'}`}
      aria-label={`${product.name}, ${money(product.priceCents, settings.currencySymbol)}`}
    >
      <div className={`relative overflow-hidden bg-surface ${rail ? 'h-36' : 'h-40 sm:h-44'}`}>
        <img
          src={product.image} alt={product.name} loading="lazy" width={720} height={540}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute left-2.5 top-2.5 flex flex-col items-start gap-1.5">
          {product.discountPct > 0 && <Badge tone="brand">{product.discountPct}% off</Badge>}
          {product.badge && <Badge tone="dark">{product.badge}</Badge>}
        </div>
        {!product.available && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/75">
            <Badge tone="dark">Currently unavailable</Badge>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3.5 text-left">
        <div className="flex items-center gap-2">
          <VegMark isVeg={product.isVeg} />
          <SpiceLevel level={product.spiceLevel} />
        </div>
        <h3 className="line-clamp-1 text-[15px] font-extrabold text-ink" style={{ fontFamily: 'var(--font-sans)' }}>{product.name}</h3>
        <p className="line-clamp-2 min-h-8 text-[12px] font-semibold leading-snug text-muted">{product.description}</p>
        <div className="mt-auto flex items-center justify-between gap-2 pt-1.5">
          <div>
            <Price cents={product.priceCents} symbol={settings.currencySymbol} compareCents={product.comparePriceCents} />
            {product.customizable && product.sizes.length > 0 && (
              <p className="text-[11px] font-bold text-muted">Medium · from {money(product.fromPriceCents, settings.currencySymbol)}</p>
            )}
          </div>
          {product.customizable ? (
            <button className="btn btn-primary btn-xs" onClick={handleAdd}>Customize</button>
          ) : (
            <button className="btn btn-primary btn-xs" onClick={handleAdd} aria-label={`Add ${product.name} to cart`}>
              <Icon name="plus" className="h-3.5 w-3.5" /> Add
            </button>
          )}
        </div>
      </div>
    </Link>
  );
}
