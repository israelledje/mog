'use client';

import { useCallback, useEffect, useState } from 'react';
import { Percent, Plus, Loader2, Save, X, ToggleLeft } from 'lucide-react';
import { API_BASE_URL } from '@/lib/api';

const headers = () => ({
  Authorization: `Bearer ${localStorage.getItem('admin_token') || ''}`,
  'Content-Type': 'application/json',
});

export default function PromosPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    code: '', label: '', discount_type: 'percent', discount_value: '',
    max_uses: '', min_amount_xaf: '', applicable_to: 'all', valid_from: '', valid_until: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/growth/promos`, { headers: headers() });
      if (res.status === 401) { window.location.href = '/login'; return; }
      if (res.ok) setItems(await res.json());
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE_URL}/growth/promos`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          code: form.code.trim().toUpperCase(),
          label: form.label,
          discount_type: form.discount_type,
          discount_value: Number(form.discount_value),
          max_uses: form.max_uses ? Number(form.max_uses) : null,
          min_amount_xaf: Number(form.min_amount_xaf || 0),
          applicable_to: form.applicable_to,
          valid_from: form.valid_from ? `${form.valid_from}T00:00:00` : null,
          valid_until: form.valid_until ? `${form.valid_until}T23:59:59` : null,
          active: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(typeof data.detail === 'string' ? data.detail : 'Erreur'); return; }
      setShow(false);
      setForm({ code: '', label: '', discount_type: 'percent', discount_value: '', max_uses: '', min_amount_xaf: '', applicable_to: 'all', valid_from: '', valid_until: '' });
      load();
    } catch { setError('Erreur réseau'); }
    finally { setSubmitting(false); }
  };

  const toggle = async (id: string, active: boolean) => {
    await fetch(`${API_BASE_URL}/growth/promos/${id}`, {
      method: 'PATCH',
      headers: headers(),
      body: JSON.stringify({ active: !active }),
    });
    load();
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
            <Percent className="text-emerald-600" /> Codes promo
          </h1>
          <p className="text-slate-500 font-medium mt-1">Réductions sur les groupages (période limitée)</p>
        </div>
        <button onClick={() => setShow(true)} className="flex items-center gap-2 px-5 py-3 bg-slate-900 text-white rounded-2xl font-black text-sm">
          <Plus size={16} /> Nouveau code
        </button>
      </div>

      {loading ? (
        <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-emerald-600" size={36} /></div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-widest text-slate-400 font-black">
              <tr>
                <th className="p-4 text-left">Code</th>
                <th className="p-4 text-left">Réduction</th>
                <th className="p-4 text-left">Utilisations</th>
                <th className="p-4 text-left">Période</th>
                <th className="p-4 text-left">Statut</th>
                <th className="p-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {items.map((p) => (
                <tr key={p.id}>
                  <td className="p-4">
                    <div className="font-mono font-black text-slate-900">{p.code}</div>
                    <div className="text-xs text-slate-400 font-medium">{p.label}</div>
                  </td>
                  <td className="p-4 font-bold">
                    {p.discount_type === 'percent' ? `${p.discount_value}%` : `${Number(p.discount_value).toLocaleString()} XAF`}
                  </td>
                  <td className="p-4 font-bold">{p.used_count || 0}{p.max_uses ? ` / ${p.max_uses}` : ''}</td>
                  <td className="p-4 text-xs text-slate-500">
                    {p.valid_from ? new Date(p.valid_from).toLocaleDateString() : '—'} → {p.valid_until ? new Date(p.valid_until).toLocaleDateString() : '∞'}
                  </td>
                  <td className="p-4">
                    <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg ${p.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                      {p.active ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <button onClick={() => toggle(p.id, !!p.active)} className="p-2 rounded-xl border hover:bg-slate-50" title="Activer/désactiver">
                      <ToggleLeft size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {!items.length && (
                <tr><td colSpan={6} className="p-10 text-center text-slate-400 font-medium">Aucun code promo</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {show && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-black">Nouveau code promo</h2>
              <button onClick={() => setShow(false)}><X size={20} /></button>
            </div>
            {error && <p className="text-sm text-red-600 font-bold">{error}</p>}
            <input className="w-full border rounded-xl p-3 font-mono font-black uppercase" placeholder="CODE" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            <input className="w-full border rounded-xl p-3 font-bold" placeholder="Libellé" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <select className="border rounded-xl p-3 font-bold" value={form.discount_type} onChange={(e) => setForm({ ...form, discount_type: e.target.value })}>
                <option value="percent">Pourcentage</option>
                <option value="fixed">Montant fixe</option>
              </select>
              <input className="border rounded-xl p-3 font-bold" placeholder="Valeur" value={form.discount_value} onChange={(e) => setForm({ ...form, discount_value: e.target.value })} />
              <select className="border rounded-xl p-3 font-bold" value={form.applicable_to} onChange={(e) => setForm({ ...form, applicable_to: e.target.value })}>
                <option value="all">Tous</option>
                <option value="groupage">Groupage</option>
                <option value="marketplace">Marketplace</option>
              </select>
              <input className="border rounded-xl p-3 font-bold" placeholder="Max utilisations" value={form.max_uses} onChange={(e) => setForm({ ...form, max_uses: e.target.value })} />
              <input className="border rounded-xl p-3 font-bold" placeholder="Min XAF" value={form.min_amount_xaf} onChange={(e) => setForm({ ...form, min_amount_xaf: e.target.value })} />
              <input type="date" className="border rounded-xl p-3 font-bold" value={form.valid_from} onChange={(e) => setForm({ ...form, valid_from: e.target.value })} />
              <input type="date" className="border rounded-xl p-3 font-bold" value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} />
            </div>
            <button onClick={create} disabled={submitting || !form.code || !form.discount_value} className="w-full py-3 bg-emerald-600 text-white rounded-2xl font-black flex items-center justify-center gap-2 disabled:opacity-40">
              {submitting ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Créer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
