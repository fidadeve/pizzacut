import { useState } from 'react';
import { api } from '../../lib/api';
import { useFetch } from '../../lib/useFetch';
import { useToast } from '../../lib/toast';
import type { AdminProduct, Category, Topping } from '../../lib/types';
import { money } from '../../lib/format';
import { ErrorState, Sheet, Skeleton, VegMark } from '../../components/ui';
import { Icon } from '../../components/icons';

type AdminTopping = Topping & { productCount: number };

interface ProductForm {
  name: string; description: string; categoryId: string; price: string; image: string;
  isVeg: boolean; spiceLevel: number; badge: string; discountPct: string;
  available: boolean; isCombo: boolean;
  sizes: { size: 'small' | 'medium' | 'large'; name: string; delta: string; isDefault: boolean }[];
  crusts: { name: string; delta: string; isDefault: boolean }[];
  toppingIds: string[];
}

const EMPTY_FORM: ProductForm = {
  name: '', description: '', categoryId: '', price: '', image: '', isVeg: true, spiceLevel: 0,
  badge: '', discountPct: '0', available: true, isCombo: false,
  sizes: [
    { size: 'small', name: 'Small · 7"', delta: '0', isDefault: false },
    { size: 'medium', name: 'Medium · 10"', delta: '3', isDefault: true },
    { size: 'large', name: 'Large · 13"', delta: '5.5', isDefault: false },
  ],
  crusts: [{ name: 'Hand Tossed', delta: '0', isDefault: true }],
  toppingIds: [],
};

export function AdminMenu() {
  const [tab, setTab] = useState<'products' | 'toppings'>('products');
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl text-ink">Menu management</h1>
          <p className="text-[13px] font-semibold text-muted">Products, prices, availability and toppings.</p>
        </div>
        <div className="flex gap-2">
          {(['products', 'toppings'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`chip border capitalize ${tab === t ? 'border-brand bg-brand text-white' : 'border-line bg-white text-charcoal'}`}>{t}</button>
          ))}
        </div>
      </div>
      <div className="mt-4">{tab === 'products' ? <ProductsTab /> : <ToppingsTab />}</div>
    </div>
  );
}

function ProductsTab() {
  const { push } = useToast();
  const products = useFetch(() => api.get<{ products: AdminProduct[] }>('/admin/products'), []);
  const cats = useFetch(() => api.get<{ categories: Category[] }>('/categories'), []);
  const toppings = useFetch(() => api.get<{ toppings: AdminTopping[] }>('/admin/toppings'), []);

  const [form, setForm] = useState<ProductForm | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const startNew = () => {
    const catId = cats.data?.categories[0]?.id ?? '';
    setForm({ ...EMPTY_FORM, categoryId: catId, crusts: [{ name: 'Hand Tossed', delta: '0', isDefault: true }, { name: 'Thin & Crispy', delta: '0', isDefault: false }, { name: 'Cheese Burst', delta: '2', isDefault: false }], toppingIds: toppings.data?.toppings.filter(t => t.available).slice(0, 6).map(t => t.id) ?? [] });
    setEditingId(null); setFormError(null);
  };

  const startEdit = (p: AdminProduct) => {
    setForm({
      name: p.name, description: p.description, categoryId: p.categoryId, price: (p.priceCents / 100).toFixed(2),
      image: p.image ?? '', isVeg: p.isVeg, spiceLevel: p.spiceLevel, badge: p.badge ?? '', discountPct: String(p.discountPct),
      available: p.available, isCombo: p.isCombo,
      sizes: p.options.sizes.length
        ? p.options.sizes.map(s => ({ size: s.size, name: s.name, delta: (s.deltaCents / 100).toFixed(2), isDefault: s.isDefault }))
        : EMPTY_FORM.sizes,
      crusts: p.options.crusts.map(c => ({ name: c.name, delta: (c.deltaCents / 100).toFixed(2), isDefault: c.isDefault })),
      toppingIds: p.options.toppings.map(t => t.id),
    });
    setEditingId(p.id); setFormError(null);
  };

  const uploadImage = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await api.upload<{ url: string }>('/admin/upload', fd);
      setForm(f => (f ? { ...f, image: res.url } : f));
      push('Image uploaded');
    } catch (err) {
      push(err instanceof Error ? err.message : 'Upload failed', 'error');
    } finally { setUploading(false); }
  };

  const save = async () => {
    if (!form) return;
    setSaving(true); setFormError(null);
    const isPizza = !form.isCombo;
    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      categoryId: form.categoryId,
      priceCents: Math.round(Number(form.price || 0) * 100),
      image: form.image,
      isVeg: form.isVeg,
      spiceLevel: form.spiceLevel,
      badge: form.badge || null,
      discountPct: Math.round(Number(form.discountPct || 0)),
      available: form.available,
      isCombo: form.isCombo,
      ...(isPizza ? {
        sizes: form.sizes.map(s => ({ size: s.size, name: s.name, deltaCents: Math.round(Number(s.delta || 0) * 100), isDefault: s.isDefault })),
        crusts: form.crusts.filter(c => c.name.trim()).map(c => ({ name: c.name.trim(), deltaCents: Math.round(Number(c.delta || 0) * 100), isDefault: c.isDefault })),
        toppingIds: form.toppingIds,
      } : {}),
    };
    try {
      if (editingId) { await api.patch(`/admin/products/${editingId}`, payload); push('Product updated'); }
      else { await api.post('/admin/products', payload); push('Product created'); }
      setForm(null);
      products.retry();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save the product');
    } finally { setSaving(false); }
  };

  const toggleAvailable = async (p: AdminProduct) => {
    try {
      await api.patch(`/admin/products/${p.id}`, { available: !p.available });
      products.retry();
      push(p.available ? `${p.name} hidden from the menu` : `${p.name} is back on the menu`);
    } catch (err) { push(err instanceof Error ? err.message : 'Could not update', 'error'); }
  };

  const remove = async (p: AdminProduct) => {
    if (!window.confirm(`Delete “${p.name}” from the menu? Existing orders keep their snapshot.`)) return;
    try { await api.del(`/admin/products/${p.id}`); products.retry(); push('Product deleted'); }
    catch (err) { push(err instanceof Error ? err.message : 'Could not delete', 'error'); }
  };

  const set = <K extends keyof ProductForm>(key: K, value: ProductForm[K]) => setForm(f => (f ? { ...f, [key]: value } : f));

  return (
    <div>
      <div className="flex justify-end">
        <button onClick={startNew} className="btn btn-primary btn-sm"><Icon name="plus" className="h-4 w-4" /> Add product</button>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {products.loading ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)
          : products.error ? <div className="md:col-span-2"><ErrorState message={products.error} onRetry={products.retry} /></div>
          : products.data!.products.map(p => (
            <article key={p.id} className={`card flex gap-3 p-3 ${!p.available ? 'opacity-60' : ''}`}>
              <img src={p.image || '/images/pizza-margherita.webp'} alt="" className="h-20 w-20 shrink-0 rounded-2xl object-cover" />
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-start gap-2">
                  <VegMark isVeg={p.isVeg} className="mt-0.5 h-4 w-4" />
                  <h3 className="line-clamp-1 flex-1 text-[14px] font-extrabold text-ink" style={{ fontFamily: 'var(--font-sans)' }}>{p.name}</h3>
                </div>
                <p className="text-[11.5px] font-bold text-muted">{p.category.name} · {money(p.priceCents)} base{p.discountPct ? ` · ${p.discountPct}% off` : ''}{p.badge ? ` · ${p.badge}` : ''}</p>
                <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1.5">
                  <button onClick={() => void toggleAvailable(p)} disabled={saving}
                    className={`btn btn-xs ${p.available ? 'btn-outline' : 'btn-dark'}`}>{p.available ? 'Available' : 'Hidden'}</button>
                  <button onClick={() => startEdit(p)} className="btn btn-outline btn-xs">Edit</button>
                  <button onClick={() => void remove(p)} className="btn btn-ghost btn-xs text-brand hover:bg-brand-soft">Delete</button>
                </div>
              </div>
            </article>
          ))}
      </div>

      <Sheet open={!!form} onClose={() => setForm(null)} title={editingId ? 'Edit product' : 'New product'}
        footer={
          <button onClick={() => void save()} disabled={saving || !form?.name.trim() || Number(form?.price ?? 0) <= 0}
            className="btn btn-primary w-full">{saving ? 'Saving…' : editingId ? 'Save changes' : 'Create product'}</button>
        }>
        {form && (
          <div className="space-y-3 pb-2">
            <label><span className="label">Name</span>
              <input className="field" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Spicy Supreme Pizza" /></label>
            <label><span className="label">Description</span>
              <textarea className="field min-h-16 resize-none py-2.5" value={form.description} onChange={e => set('description', e.target.value)} maxLength={400} /></label>
            <div className="grid grid-cols-2 gap-3">
              <label><span className="label">Category</span>
                <select className="field" value={form.categoryId} onChange={e => set('categoryId', e.target.value)}>
                  {(cats.data?.categories ?? []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select></label>
              <label><span className="label">Base price ($) — small / as served</span>
                <input className="field" type="number" min={0} step={0.5} value={form.price} onChange={e => set('price', e.target.value)} placeholder="9.99" /></label>
            </div>

            <div>
              <span className="label">Photo</span>
              <div className="flex items-center gap-3">
                {form.image && <img src={form.image} alt="" className="h-16 w-16 rounded-2xl object-cover" />}
                <label className="btn btn-outline btn-sm cursor-pointer">
                  <Icon name="upload" className="h-4 w-4" /> {uploading ? 'Uploading…' : 'Upload image'}
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only"
                    onChange={e => { const f = e.target.files?.[0]; if (f) void uploadImage(f); }} />
                </label>
                <input className="field h-10 min-h-10 flex-1 text-[12px]" value={form.image} onChange={e => set('image', e.target.value)} placeholder="/images/… or uploaded URL" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label><span className="label">Badge</span>
                <select className="field" value={form.badge} onChange={e => set('badge', e.target.value)}>
                  <option value="">None</option>
                  <option value="Bestseller">Bestseller</option>
                  <option value="Chef’s Pick">Chef's Pick</option>
                </select></label>
              <label><span className="label">Discount %</span>
                <input className="field" type="number" min={0} max={90} value={form.discountPct} onChange={e => set('discountPct', e.target.value)} /></label>
              <label><span className="label">Spice level</span>
                <select className="field" value={form.spiceLevel} onChange={e => set('spiceLevel', Number(e.target.value))}>
                  <option value={0}>Not spicy</option><option value={1}>Mild</option><option value={2}>Medium</option><option value={3}>Hot</option>
                </select></label>
            </div>

            <div className="flex flex-wrap gap-3 text-[13px] font-extrabold text-ink">
              {([['isVeg', 'Vegetarian'], ['available', 'Available now'], ['isCombo', 'Combo / deal (no customization)']] as const).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2">
                  <input type="checkbox" checked={form[key] as boolean} onChange={e => set(key, e.target.checked as never)} className="h-4 w-4 accent-[#FF0018]" />
                  {label}
                </label>
              ))}
            </div>

            {!form.isCombo && (
              <>
                <div>
                  <span className="label">Sizes (deltas on top of base price)</span>
                  <div className="space-y-2">
                    {form.sizes.map((s, i) => (
                      <div key={s.size} className="flex items-center gap-2">
                        <button type="button" onClick={() => set('sizes', form.sizes.map((x, j) => ({ ...x, isDefault: j === i })))}
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${s.isDefault ? 'border-brand' : 'border-line'}`}
                          aria-label={`Make ${s.name} the default size`}>
                          {s.isDefault && <span className="h-2.5 w-2.5 rounded-full bg-brand" />}
                        </button>
                        <span className="w-24 shrink-0 text-[13px] font-bold text-ink">{s.name.split(' · ')[0]}</span>
                        <span className="flex-1 text-[11.5px] font-semibold text-muted">{s.name.split(' · ')[1]}</span>
                        <input className="field h-9 min-h-9 w-20 text-center text-[13px]" type="number" min={0} step={0.5} value={s.delta}
                          onChange={e => set('sizes', form.sizes.map((x, j) => j === i ? { ...x, delta: e.target.value } : x))} aria-label={`${s.name} price delta`} />
                      </div>
                    ))}
                  </div>
                  <p className="mt-1 text-[11.5px] font-semibold text-muted">Default size is pre-selected for customers.</p>
                </div>

                <div>
                  <span className="label">Crusts</span>
                  <div className="space-y-2">
                    {form.crusts.map((c, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <button type="button" onClick={() => set('crusts', form.crusts.map((x, j) => ({ ...x, isDefault: j === i })))}
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${c.isDefault ? 'border-brand' : 'border-line'}`}
                          aria-label="Make default crust">
                          {c.isDefault && <span className="h-2.5 w-2.5 rounded-full bg-brand" />}
                        </button>
                        <input className="field h-9 min-h-9 flex-1 text-[13px]" value={c.name}
                          onChange={e => set('crusts', form.crusts.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} placeholder="Crust name" />
                        <input className="field h-9 min-h-9 w-20 text-center text-[13px]" type="number" min={0} step={0.5} value={c.delta}
                          onChange={e => set('crusts', form.crusts.map((x, j) => j === i ? { ...x, delta: e.target.value } : x))} aria-label="Crust price delta" />
                        <button type="button" onClick={() => set('crusts', form.crusts.filter((_, j) => j !== i))}
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted hover:bg-brand-soft hover:text-brand" aria-label="Remove crust">
                          <Icon name="trash" className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={() => set('crusts', [...form.crusts, { name: '', delta: '0', isDefault: false }])}
                    className="btn btn-outline btn-xs mt-2"><Icon name="plus" className="h-3.5 w-3.5" /> Add crust</button>
                </div>

                <div>
                  <span className="label">Available toppings</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(toppings.data?.toppings ?? []).map(t => {
                      const checked = form.toppingIds.includes(t.id);
                      return (
                        <label key={t.id} className={`flex items-center gap-2 rounded-xl border p-2 text-[12.5px] font-bold ${checked ? 'border-brand bg-brand-soft' : 'border-line'}`}>
                          <input type="checkbox" className="h-3.5 w-3.5 accent-[#FF0018]" checked={checked}
                            onChange={() => set('toppingIds', checked ? form.toppingIds.filter(x => x !== t.id) : [...form.toppingIds, t.id])} />
                          <span className="min-w-0 truncate text-ink">{t.name}</span>
                          <span className="ml-auto shrink-0 text-muted">{money(t.priceCents)}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {formError && <p className="rounded-2xl bg-brand-soft p-3 text-[13px] font-bold text-brand" role="alert">{formError}</p>}
          </div>
        )}
      </Sheet>
    </div>
  );
}

function ToppingsTab() {
  const { push } = useToast();
  const toppings = useFetch(() => api.get<{ toppings: AdminTopping[] }>('/admin/toppings'), []);
  const [form, setForm] = useState<{ id?: string; name: string; price: string; isVeg: boolean; available: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const save = async () => {
    if (!form) return;
    setSaving(true); setFormError(null);
    const payload = { name: form.name.trim(), priceCents: Math.round(Number(form.price || 0) * 100), isVeg: form.isVeg, available: form.available };
    try {
      if (form.id) await api.patch(`/admin/toppings/${form.id}`, payload);
      else await api.post('/admin/toppings', payload);
      push(form.id ? 'Topping updated' : 'Topping added');
      setForm(null);
      toppings.retry();
    } catch (err) { setFormError(err instanceof Error ? err.message : 'Could not save topping'); }
    finally { setSaving(false); }
  };

  const remove = async (t: AdminTopping) => {
    if (!window.confirm(`Remove “${t.name}”? It disappears from every pizza.`)) return;
    try { await api.del(`/admin/toppings/${t.id}`); toppings.retry(); push('Topping removed'); }
    catch (err) { push(err instanceof Error ? err.message : 'Could not remove', 'error'); }
  };

  return (
    <div>
      <div className="flex justify-end">
        <button onClick={() => setForm({ name: '', price: '1.5', isVeg: true, available: true })} className="btn btn-primary btn-sm">
          <Icon name="plus" className="h-4 w-4" /> Add topping
        </button>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {toppings.loading ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
          : toppings.error ? <div className="sm:col-span-2"><ErrorState message={toppings.error} onRetry={toppings.retry} /></div>
          : toppings.data!.toppings.map(t => (
            <div key={t.id} className={`card flex items-center gap-3 p-3 ${!t.available ? 'opacity-60' : ''}`}>
              <VegMark isVeg={t.isVeg} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-extrabold text-ink">{t.name}</p>
                <p className="text-[11.5px] font-bold text-muted">{money(t.priceCents)} · on {t.productCount} item{t.productCount === 1 ? '' : 's'}</p>
              </div>
              <button onClick={() => void api.patch(`/admin/toppings/${t.id}`, { available: !t.available }).then(() => toppings.retry())}
                className={`btn btn-xs ${t.available ? 'btn-outline' : 'btn-dark'}`}>{t.available ? 'On' : 'Off'}</button>
              <button onClick={() => setForm({ id: t.id, name: t.name, price: (t.priceCents / 100).toFixed(2), isVeg: t.isVeg, available: t.available })}
                className="btn btn-outline btn-xs">Edit</button>
              <button onClick={() => void remove(t)} className="btn btn-ghost btn-xs text-brand hover:bg-brand-soft">Del</button>
            </div>
          ))}
      </div>

      <Sheet open={!!form} onClose={() => setForm(null)} title={form?.id ? 'Edit topping' : 'New topping'}
        footer={<button onClick={() => void save()} disabled={saving || !form?.name.trim()} className="btn btn-primary w-full">{saving ? 'Saving…' : 'Save topping'}</button>}>
        {form && (
          <div className="space-y-3 pb-2">
            <label><span className="label">Name</span>
              <input className="field" value={form.name} onChange={e => setForm(f => (f ? { ...f, name: e.target.value } : f))} placeholder="Jalapeños" /></label>
            <label><span className="label">Price ($)</span>
              <input className="field" type="number" min={0} step={0.5} value={form.price} onChange={e => setForm(f => (f ? { ...f, price: e.target.value } : f))} /></label>
            <div className="flex gap-4 text-[13px] font-extrabold text-ink">
              <label className="flex items-center gap-2">
                <input type="checkbox" className="h-4 w-4 accent-[#FF0018]" checked={form.isVeg} onChange={e => setForm(f => (f ? { ...f, isVeg: e.target.checked } : f))} />
                Vegetarian
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" className="h-4 w-4 accent-[#FF0018]" checked={form.available} onChange={e => setForm(f => (f ? { ...f, available: e.target.checked } : f))} />
                Available
              </label>
            </div>
            {formError && <p className="rounded-2xl bg-brand-soft p-3 text-[13px] font-bold text-brand" role="alert">{formError}</p>}
          </div>
        )}
      </Sheet>
    </div>
  );
}
