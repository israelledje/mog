'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus, ShoppingBag, Loader2, Archive, Pencil, X, Save, Search,
  Upload, Trash2, Minus, ImagePlus, Package, Layers,
} from 'lucide-react';
import { API_BASE_URL, mediaUrl } from '@/lib/api';

const token = () => localStorage.getItem('admin_token') || '';
const jsonHeaders = () => ({ Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' });
const authHeaders = () => ({ Authorization: `Bearer ${token()}` });

type Variant = {
  id?: string;
  name: string;
  sku: string;
  price_xaf: string;
  stock: string;
};

type FormState = {
  title: string;
  description: string;
  category: string;
  price_xaf: string;
  stock: string;
  transport_mode: string;
  origin_city: string;
  status: string;
  images: string[];
  variants: Variant[];
};

const blankForm = (): FormState => ({
  title: '',
  description: '',
  category: 'vehicle',
  price_xaf: '',
  stock: '1',
  transport_mode: 'sea',
  origin_city: 'Guangzhou',
  status: 'published',
  images: [],
  variants: [],
});

const CATEGORY_LABELS: Record<string, string> = {
  vehicle: 'Véhicule',
  electronics: 'Électronique',
  fashion: 'Mode',
  other: 'Autre',
};

const STATUS_STYLES: Record<string, string> = {
  published: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  draft: 'bg-amber-50 text-amber-700 border-amber-100',
  archived: 'bg-slate-100 text-slate-500 border-slate-200',
};

export default function MarketplaceAdminPage() {
  const [items, setItems] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'products' | 'orders'>('products');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [q, setQ] = useState('');
  const [form, setForm] = useState<FormState>(blankForm());
  const [editId, setEditId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [stockBusy, setStockBusy] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, o] = await Promise.all([
        fetch(`${API_BASE_URL}/marketplace/products`, { headers: authHeaders() }),
        fetch(`${API_BASE_URL}/marketplace/orders`, { headers: authHeaders() }),
      ]);
      if (p.status === 401) { window.location.href = '/login'; return; }
      if (p.ok) {
        const data = await p.json();
        setItems(Array.isArray(data) ? data : []);
      }
      if (o.ok) setOrders(await o.json());
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    return items.filter((it) => {
      if (statusFilter !== 'all' && it.status !== statusFilter) return false;
      if (categoryFilter !== 'all' && it.category !== categoryFilter) return false;
      if (q.trim()) {
        const hay = `${it.title || ''} ${it.description || ''}`.toLowerCase();
        if (!hay.includes(q.trim().toLowerCase())) return false;
      }
      return true;
    });
  }, [items, statusFilter, categoryFilter, q]);

  const stats = useMemo(() => {
    const active = items.filter((i) => i.status === 'published').length;
    const low = items.filter((i) => (i.stock ?? 0) <= 2 && i.status !== 'archived').length;
    const units = items.reduce((s, i) => s + Number(i.stock || 0), 0);
    return { active, low, units, orders: orders.length };
  }, [items, orders]);

  const openCreate = () => {
    setEditId(null);
    setForm(blankForm());
    setError('');
    setPanelOpen(true);
  };

  const openEdit = (it: any) => {
    setEditId(it.id);
    setForm({
      title: it.title || '',
      description: it.description || '',
      category: it.category || 'other',
      price_xaf: String(it.price_xaf || ''),
      stock: String(it.stock ?? 0),
      transport_mode: it.transport_mode || 'sea',
      origin_city: it.origin_city || 'Guangzhou',
      status: it.status || 'published',
      images: Array.isArray(it.images) ? [...it.images] : [],
      variants: (it.variants || []).map((v: any) => ({
        id: v.id,
        name: v.name || '',
        sku: v.sku || '',
        price_xaf: v.price_xaf != null ? String(v.price_xaf) : '',
        stock: String(v.stock ?? 0),
      })),
    });
    setError('');
    setPanelOpen(true);
  };

  const uploadImages = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    setError('');
    try {
      const urls: string[] = [];
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch(`${API_BASE_URL}/marketplace/products/upload-image`, {
          method: 'POST',
          headers: authHeaders(),
          body: fd,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.detail || 'Upload échoué');
        urls.push(data.url);
      }
      setForm((f) => ({ ...f, images: [...f.images, ...urls] }));
    } catch (e: any) {
      setError(e.message || 'Upload échoué');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const save = async () => {
    setSubmitting(true);
    setError('');
    const variants = form.variants
      .filter((v) => v.name.trim())
      .map((v) => ({
        id: v.id || undefined,
        name: v.name.trim(),
        sku: v.sku.trim() || null,
        price_xaf: v.price_xaf ? Number(v.price_xaf) : null,
        stock: Number(v.stock || 0),
        attributes: {},
      }));
    const payload = {
      title: form.title.trim(),
      description: form.description,
      category: form.category,
      price_xaf: Number(form.price_xaf),
      stock: variants.length ? variants.reduce((s, v) => s + v.stock, 0) : Number(form.stock || 0),
      transport_mode: form.transport_mode,
      origin_city: form.origin_city,
      status: form.status,
      images: form.images,
      variants,
    };
    try {
      const res = await fetch(
        editId ? `${API_BASE_URL}/marketplace/products/${editId}` : `${API_BASE_URL}/marketplace/products`,
        { method: editId ? 'PATCH' : 'POST', headers: jsonHeaders(), body: JSON.stringify(payload) },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.detail === 'string' ? data.detail : 'Erreur enregistrement');
        return;
      }
      setPanelOpen(false);
      load();
    } catch {
      setError('Erreur réseau');
    } finally {
      setSubmitting(false);
    }
  };

  const archive = async (id: string) => {
    if (!confirm('Archiver cet article ?')) return;
    await fetch(`${API_BASE_URL}/marketplace/products/${id}`, { method: 'DELETE', headers: authHeaders() });
    load();
  };

  const adjustStock = async (id: string, delta: number, variantId?: string) => {
    setStockBusy(id + (variantId || ''));
    try {
      await fetch(`${API_BASE_URL}/marketplace/products/${id}/stock`, {
        method: 'PATCH',
        headers: jsonHeaders(),
        body: JSON.stringify({ delta, variant_id: variantId || null }),
      });
      await load();
    } catch { /* ignore */ }
    finally { setStockBusy(null); }
  };

  const fieldClass =
    'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400';

  return (
    <div className="min-h-full bg-slate-50/80">
      <div className="border-b border-slate-200/80 bg-white px-8 py-6">
        <div className="mx-auto flex max-w-7xl flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-1 flex items-center gap-2 text-blue-600">
              <ShoppingBag size={18} />
              <span className="text-xs font-semibold uppercase tracking-[0.14em]">Catalogue</span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Marketplace</h1>
            <p className="mt-1 text-sm text-slate-500">
              Articles, stocks, images et variantes visibles dans l&apos;app mobile
            </p>
          </div>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
          >
            <Plus size={16} /> Nouvel article
          </button>
        </div>

        <div className="mx-auto mt-6 grid max-w-7xl grid-cols-2 gap-3 md:grid-cols-4">
          {[
            { label: 'Publiés', value: stats.active, icon: Package },
            { label: 'Unités en stock', value: stats.units, icon: Layers },
            { label: 'Stock bas (≤2)', value: stats.low, icon: Archive },
            { label: 'Commandes', value: stats.orders, icon: ShoppingBag },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">{s.label}</span>
                <s.icon size={14} className="text-slate-400" />
              </div>
              <div className="mt-1 text-xl font-semibold text-slate-900">{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-5 px-8 py-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-xl bg-white p-1 shadow-sm ring-1 ring-slate-200">
            {([
              ['products', `Articles (${filtered.length})`],
              ['orders', `Commandes (${orders.length})`],
            ] as const).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                  tab === k ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'products' && (
            <>
              <div className="relative min-w-[220px] flex-1">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  className={`${fieldClass} pl-9`}
                  placeholder="Rechercher un article…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
              <select className={`${fieldClass} w-auto`} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">Tous statuts</option>
                <option value="published">Publiés</option>
                <option value="draft">Brouillons</option>
                <option value="archived">Archivés</option>
              </select>
              <select className={`${fieldClass} w-auto`} value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                <option value="all">Toutes catégories</option>
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-24"><Loader2 className="animate-spin text-blue-600" size={32} /></div>
        ) : tab === 'products' ? (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[880px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-5 py-3.5">Article</th>
                    <th className="px-4 py-3.5">Catégorie</th>
                    <th className="px-4 py-3.5">Prix</th>
                    <th className="px-4 py-3.5">Stock</th>
                    <th className="px-4 py-3.5">Variantes</th>
                    <th className="px-4 py-3.5">Statut</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((it) => {
                    const thumb = it.images?.[0] ? mediaUrl(it.images[0]) : null;
                    const variantCount = (it.variants || []).length;
                    const busy = stockBusy === it.id;
                    return (
                      <tr key={it.id} className="hover:bg-slate-50/70">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200">
                              {thumb ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={thumb} alt="" className="h-full w-full object-cover" />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-slate-300">
                                  <ImagePlus size={18} />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="truncate font-semibold text-slate-900">{it.title}</div>
                              <div className="mt-0.5 truncate text-xs text-slate-500">
                                {it.origin_city || '—'} · {it.transport_mode === 'sea' ? 'Maritime' : 'Aérien'}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-slate-600">{CATEGORY_LABELS[it.category] || it.category}</td>
                        <td className="px-4 py-3.5 font-medium text-slate-800">
                          {Number(it.price_xaf || 0).toLocaleString('fr-FR')} <span className="text-xs text-slate-400">XAF</span>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
                            <button
                              disabled={busy || variantCount > 0}
                              onClick={() => adjustStock(it.id, -1)}
                              className="rounded-lg p-1.5 text-slate-600 hover:bg-white disabled:opacity-30"
                              title={variantCount > 0 ? 'Ajuster via les variantes' : 'Diminuer'}
                            >
                              <Minus size={14} />
                            </button>
                            <span className={`min-w-[2rem] text-center text-sm font-semibold ${(it.stock ?? 0) <= 2 ? 'text-amber-600' : 'text-slate-900'}`}>
                              {it.stock ?? 0}
                            </span>
                            <button
                              disabled={busy || variantCount > 0}
                              onClick={() => adjustStock(it.id, 1)}
                              className="rounded-lg p-1.5 text-slate-600 hover:bg-white disabled:opacity-30"
                              title={variantCount > 0 ? 'Ajuster via les variantes' : 'Augmenter'}
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-slate-600">
                          {variantCount ? `${variantCount} variante${variantCount > 1 ? 's' : ''}` : '—'}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex rounded-lg border px-2 py-1 text-xs font-medium capitalize ${STATUS_STYLES[it.status] || STATUS_STYLES.draft}`}>
                            {it.status}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="inline-flex gap-1.5">
                            <button onClick={() => openEdit(it)} className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-blue-50 hover:text-blue-700">
                              <Pencil size={15} />
                            </button>
                            <button onClick={() => archive(it.id)} className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-red-50 hover:text-red-600">
                              <Archive size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {!filtered.length && (
                    <tr>
                      <td colSpan={7} className="px-5 py-16 text-center text-slate-400">Aucun article pour ces filtres</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3.5">Tracking</th>
                  <th className="px-4 py-3.5">Article</th>
                  <th className="px-4 py-3.5">Client</th>
                  <th className="px-4 py-3.5">Total</th>
                  <th className="px-5 py-3.5">Paiement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3.5 font-mono text-sm font-semibold text-slate-800">{o.tracking_number}</td>
                    <td className="px-4 py-3.5 text-slate-700">{o.product_title} ×{o.quantity}</td>
                    <td className="px-4 py-3.5 text-slate-500">{o.owner_id}</td>
                    <td className="px-4 py-3.5 font-semibold text-slate-800">{Number(o.total_xaf || 0).toLocaleString('fr-FR')} XAF</td>
                    <td className="px-5 py-3.5 text-xs font-medium uppercase text-slate-500">{o.payment_status}</td>
                  </tr>
                ))}
                {!orders.length && (
                  <tr><td colSpan={5} className="px-5 py-16 text-center text-slate-400">Aucune commande</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Panneau latéral édition */}
      {panelOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]" onClick={() => setPanelOpen(false)} aria-label="Fermer" />
          <div className="relative flex h-full w-full max-w-xl flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{editId ? 'Modifier l’article' : 'Nouvel article'}</h2>
                <p className="text-sm text-slate-500">Images, stock, variantes et publication</p>
              </div>
              <button onClick={() => setPanelOpen(false)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
              {error && <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

              <section className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Informations</h3>
                <input className={fieldClass} placeholder="Titre de l’article" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                <textarea className={`${fieldClass} min-h-[90px]`} placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                <div className="grid grid-cols-2 gap-3">
                  <select className={fieldClass} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                    {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  <select className={fieldClass} value={form.transport_mode} onChange={(e) => setForm({ ...form, transport_mode: e.target.value })}>
                    <option value="sea">Maritime</option>
                    <option value="air">Aérien</option>
                    <option value="air_express">Air express</option>
                  </select>
                  <input className={fieldClass} placeholder="Prix de base (XAF)" value={form.price_xaf} onChange={(e) => setForm({ ...form, price_xaf: e.target.value })} />
                  <input className={fieldClass} placeholder="Ville d’origine" value={form.origin_city} onChange={(e) => setForm({ ...form, origin_city: e.target.value })} />
                  <select className={fieldClass} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                    <option value="published">Publié</option>
                    <option value="draft">Brouillon</option>
                    <option value="archived">Archivé</option>
                  </select>
                  {form.variants.length === 0 && (
                    <input className={fieldClass} placeholder="Stock global" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
                  )}
                </div>
              </section>

              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Images</h3>
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                  >
                    {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                    Ajouter
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => uploadImages(e.target.files)} />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {form.images.map((url, idx) => (
                    <div key={`${url}-${idx}`} className="group relative aspect-square overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={mediaUrl(url)} alt="" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, images: f.images.filter((_, i) => i !== idx) }))}
                        className="absolute right-1.5 top-1.5 rounded-lg bg-white/90 p-1 text-red-600 opacity-0 shadow group-hover:opacity-100"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                  {!form.images.length && (
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="col-span-3 flex aspect-[3/1] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500 hover:border-blue-300 hover:bg-blue-50/40"
                    >
                      <ImagePlus size={22} className="text-slate-400" />
                      Glisser ou cliquer pour ajouter des photos
                    </button>
                  )}
                </div>
              </section>

              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Variantes</h3>
                    <p className="text-xs text-slate-400">Couleur, taille, année… chaque variante a son stock</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({
                      ...f,
                      variants: [...f.variants, { name: '', sku: '', price_xaf: '', stock: '0' }],
                    }))}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    <Plus size={13} /> Variante
                  </button>
                </div>
                {form.variants.map((v, idx) => (
                  <div key={v.id || idx} className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-500">Variante {idx + 1}</span>
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, variants: f.variants.filter((_, i) => i !== idx) }))}
                        className="text-slate-400 hover:text-red-600"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input className={fieldClass} placeholder="Nom (ex. Rouge / XL)" value={v.name} onChange={(e) => {
                        const variants = [...form.variants];
                        variants[idx] = { ...v, name: e.target.value };
                        setForm({ ...form, variants });
                      }} />
                      <input className={fieldClass} placeholder="SKU" value={v.sku} onChange={(e) => {
                        const variants = [...form.variants];
                        variants[idx] = { ...v, sku: e.target.value };
                        setForm({ ...form, variants });
                      }} />
                      <input className={fieldClass} placeholder="Prix override XAF" value={v.price_xaf} onChange={(e) => {
                        const variants = [...form.variants];
                        variants[idx] = { ...v, price_xaf: e.target.value };
                        setForm({ ...form, variants });
                      }} />
                      <input className={fieldClass} placeholder="Stock" value={v.stock} onChange={(e) => {
                        const variants = [...form.variants];
                        variants[idx] = { ...v, stock: e.target.value };
                        setForm({ ...form, variants });
                      }} />
                    </div>
                  </div>
                ))}
                {!form.variants.length && (
                  <p className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-400">
                    Sans variante, le stock global de l’article est utilisé.
                  </p>
                )}
              </section>
            </div>

            <div className="border-t border-slate-100 px-6 py-4">
              <button
                onClick={save}
                disabled={submitting || !form.title.trim() || !form.price_xaf}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
              >
                {submitting ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                {editId ? 'Enregistrer les modifications' : 'Créer l’article'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
