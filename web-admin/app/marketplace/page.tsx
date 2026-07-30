'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, ShoppingBag, Loader2, Archive, Pencil, X, Save } from 'lucide-react';
import { API_BASE_URL } from '@/lib/api';

const token = () => localStorage.getItem('admin_token') || '';
const headers = () => ({ Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' });

const BLANK = {
  title: '', description: '', category: 'vehicle', price_xaf: '', stock: '1',
  transport_mode: 'sea', origin_city: 'Guangzhou', status: 'published', images: '',
};

export default function MarketplaceAdminPage() {
  const [items, setItems] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'products' | 'orders'>('products');
  const [form, setForm] = useState({ ...BLANK });
  const [editId, setEditId] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, o] = await Promise.all([
        fetch(`${API_BASE_URL}/marketplace/products`, { headers: headers() }),
        fetch(`${API_BASE_URL}/marketplace/orders`, { headers: headers() }),
      ]);
      if (p.status === 401) { window.location.href = '/login'; return; }
      if (p.ok) {
        const data = await p.json();
        setItems(Array.isArray(data) ? data : []);
      }
      if (o.ok) setOrders(await o.json());
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditId(null); setForm({ ...BLANK }); setShow(true); setError(''); };
  const openEdit = (it: any) => {
    setEditId(it.id);
    setForm({
      title: it.title || '',
      description: it.description || '',
      category: it.category || 'other',
      price_xaf: String(it.price_xaf || ''),
      stock: String(it.stock ?? 1),
      transport_mode: it.transport_mode || 'sea',
      origin_city: it.origin_city || 'Guangzhou',
      status: it.status || 'published',
      images: (it.images || []).join('\n'),
    });
    setShow(true);
    setError('');
  };

  const save = async () => {
    setSubmitting(true);
    setError('');
    const payload = {
      title: form.title,
      description: form.description,
      category: form.category,
      price_xaf: Number(form.price_xaf),
      stock: Number(form.stock || 0),
      transport_mode: form.transport_mode,
      origin_city: form.origin_city,
      status: form.status,
      images: form.images.split(/[\n,]/).map((s) => s.trim()).filter(Boolean),
    };
    try {
      const res = await fetch(
        editId ? `${API_BASE_URL}/marketplace/products/${editId}` : `${API_BASE_URL}/marketplace/products`,
        { method: editId ? 'PATCH' : 'POST', headers: headers(), body: JSON.stringify(payload) }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.detail || 'Erreur'); return; }
      setShow(false);
      load();
    } catch { setError('Erreur réseau'); }
    finally { setSubmitting(false); }
  };

  const archive = async (id: string) => {
    if (!confirm('Archiver cet article ?')) return;
    await fetch(`${API_BASE_URL}/marketplace/products/${id}`, { method: 'DELETE', headers: headers() });
    load();
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
            <ShoppingBag className="text-blue-600" /> Marketplace
          </h1>
          <p className="text-slate-500 font-medium mt-1">Véhicules & articles visibles dans l&apos;app mobile</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-5 py-3 bg-slate-900 text-white rounded-2xl font-black text-sm">
          <Plus size={16} /> Nouvel article
        </button>
      </div>

      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit">
        {(['products', 'orders'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg text-xs font-black ${tab === t ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400'}`}>
            {t === 'products' ? `Articles (${items.length})` : `Commandes (${orders.length})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-blue-600" size={36} /></div>
      ) : tab === 'products' ? (
        <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-widest text-slate-400 font-black">
              <tr>
                <th className="p-4 text-left">Article</th>
                <th className="p-4 text-left">Catégorie</th>
                <th className="p-4 text-left">Prix</th>
                <th className="p-4 text-left">Stock</th>
                <th className="p-4 text-left">Statut</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {items.map((it) => (
                <tr key={it.id} className="hover:bg-slate-50/50">
                  <td className="p-4 font-black text-slate-900">{it.title}</td>
                  <td className="p-4 text-slate-500 font-bold uppercase text-xs">{it.category}</td>
                  <td className="p-4 font-bold">{Number(it.price_xaf || 0).toLocaleString()} XAF</td>
                  <td className="p-4 font-bold">{it.stock}</td>
                  <td className="p-4"><span className="text-[10px] font-black uppercase px-2 py-1 rounded-lg bg-slate-100">{it.status}</span></td>
                  <td className="p-4 text-right space-x-2">
                    <button onClick={() => openEdit(it)} className="p-2 rounded-xl border hover:bg-blue-50"><Pencil size={14} /></button>
                    <button onClick={() => archive(it.id)} className="p-2 rounded-xl border hover:bg-red-50"><Archive size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-widest text-slate-400 font-black">
              <tr>
                <th className="p-4 text-left">Tracking</th>
                <th className="p-4 text-left">Article</th>
                <th className="p-4 text-left">Client</th>
                <th className="p-4 text-left">Total</th>
                <th className="p-4 text-left">Paiement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {orders.map((o) => (
                <tr key={o.id}>
                  <td className="p-4 font-mono font-black">{o.tracking_number}</td>
                  <td className="p-4 font-bold">{o.product_title} ×{o.quantity}</td>
                  <td className="p-4 text-slate-500">{o.owner_id}</td>
                  <td className="p-4 font-black">{Number(o.total_xaf || 0).toLocaleString()} XAF</td>
                  <td className="p-4 text-xs font-black uppercase">{o.payment_status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {show && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-lg space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-black">{editId ? 'Modifier' : 'Nouvel article'}</h2>
              <button onClick={() => setShow(false)}><X size={20} /></button>
            </div>
            {error && <p className="text-sm text-red-600 font-bold">{error}</p>}
            <input className="w-full border rounded-xl p-3 font-bold" placeholder="Titre" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <textarea className="w-full border rounded-xl p-3 font-medium" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <select className="border rounded-xl p-3 font-bold" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                <option value="vehicle">Véhicule</option>
                <option value="electronics">Électronique</option>
                <option value="fashion">Mode</option>
                <option value="other">Autre</option>
              </select>
              <select className="border rounded-xl p-3 font-bold" value={form.transport_mode} onChange={(e) => setForm({ ...form, transport_mode: e.target.value })}>
                <option value="sea">Maritime</option>
                <option value="air">Aérien</option>
                <option value="air_express">Air express</option>
              </select>
              <input className="border rounded-xl p-3 font-bold" placeholder="Prix XAF" value={form.price_xaf} onChange={(e) => setForm({ ...form, price_xaf: e.target.value })} />
              <input className="border rounded-xl p-3 font-bold" placeholder="Stock" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
            </div>
            <textarea className="w-full border rounded-xl p-3 text-xs" placeholder="URLs images (une par ligne)" value={form.images} onChange={(e) => setForm({ ...form, images: e.target.value })} />
            <select className="w-full border rounded-xl p-3 font-bold" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="published">Publié</option>
              <option value="draft">Brouillon</option>
              <option value="archived">Archivé</option>
            </select>
            <button onClick={save} disabled={submitting || !form.title || !form.price_xaf} className="w-full py-3 bg-blue-600 text-white rounded-2xl font-black flex items-center justify-center gap-2 disabled:opacity-40">
              {submitting ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Enregistrer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
