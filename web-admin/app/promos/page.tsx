'use client';

import { useCallback, useEffect, useState } from 'react';
import { Percent, Plus, Loader2, Save, X, ToggleLeft, AlertCircle } from 'lucide-react';
import { API_BASE_URL } from '@/lib/api';

const headers = () => ({
  Authorization: `Bearer ${localStorage.getItem('admin_token') || ''}`,
  'Content-Type': 'application/json',
});

const fieldClass =
  'w-full px-4 py-3 rounded-2xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none font-semibold text-sm transition-all';

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
    <div className="p-8 max-w-6xl mx-auto space-y-6 text-slate-900">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
            <Percent className="text-emerald-600" /> Codes promo
          </h1>
          <p className="text-slate-500 font-medium mt-1">Réductions sur groupage et marketplace</p>
        </div>
        <button
          onClick={() => { setError(''); setShow(true); }}
          className="flex items-center gap-2 px-5 py-3 bg-slate-900 text-white rounded-2xl font-black text-sm hover:bg-slate-800 transition-colors"
        >
          <Plus size={16} /> Nouveau code
        </button>
      </div>

      {loading ? (
        <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-emerald-600" size={36} /></div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
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
                <tr key={p.id} className="hover:bg-slate-50/60">
                  <td className="p-4">
                    <div className="font-mono font-black text-slate-900">{p.code}</div>
                    <div className="text-xs text-slate-400 font-medium">{p.label}</div>
                  </td>
                  <td className="p-4 font-bold text-slate-800">
                    {p.discount_type === 'percent' ? `${p.discount_value}%` : `${Number(p.discount_value).toLocaleString()} XAF`}
                  </td>
                  <td className="p-4 font-bold text-slate-700">{p.used_count || 0}{p.max_uses ? ` / ${p.max_uses}` : ''}</td>
                  <td className="p-4 text-xs text-slate-500">
                    {p.valid_from ? new Date(p.valid_from).toLocaleDateString() : '—'} → {p.valid_until ? new Date(p.valid_until).toLocaleDateString() : '∞'}
                  </td>
                  <td className="p-4">
                    <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg ${p.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                      {p.active ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <button onClick={() => toggle(p.id, !!p.active)} className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600" title="Activer/désactiver">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-[28px] shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-slate-50/95 px-6 py-5 backdrop-blur">
              <div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight">Nouveau code promo</h2>
                <p className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-500">Réduction & validité</p>
              </div>
              <button
                type="button"
                onClick={() => setShow(false)}
                className="rounded-2xl border border-transparent p-2.5 text-slate-400 transition-all hover:border-slate-200 hover:bg-white hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-5 p-6">
              {error && (
                <div className="flex items-center gap-3 rounded-2xl border border-red-100 bg-red-50 p-3 text-sm font-bold text-red-600">
                  <AlertCircle size={18} className="shrink-0" />
                  {error}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 ml-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">Code</label>
                  <input
                    className={`${fieldClass} font-mono uppercase`}
                    placeholder="PROMO10"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-1.5 ml-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">Libellé</label>
                  <input
                    className={fieldClass}
                    placeholder="Promo de lancement"
                    value={form.label}
                    onChange={(e) => setForm({ ...form, label: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 ml-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">Type</label>
                  <select
                    className={fieldClass}
                    value={form.discount_type}
                    onChange={(e) => setForm({ ...form, discount_type: e.target.value })}
                  >
                    <option value="percent">Pourcentage (%)</option>
                    <option value="fixed">Montant fixe (XAF)</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 ml-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">Valeur</label>
                  <input
                    className={fieldClass}
                    type="number"
                    min="0"
                    placeholder={form.discount_type === 'percent' ? '10' : '5000'}
                    value={form.discount_value}
                    onChange={(e) => setForm({ ...form, discount_value: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 ml-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">Applicable à</label>
                  <select
                    className={fieldClass}
                    value={form.applicable_to}
                    onChange={(e) => setForm({ ...form, applicable_to: e.target.value })}
                  >
                    <option value="all">Tous</option>
                    <option value="groupage">Groupage</option>
                    <option value="marketplace">Marketplace</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 ml-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">Max utilisations</label>
                  <input
                    className={fieldClass}
                    type="number"
                    min="0"
                    placeholder="Illimité si vide"
                    value={form.max_uses}
                    onChange={(e) => setForm({ ...form, max_uses: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 ml-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">Montant minimum (XAF)</label>
                <input
                  className={fieldClass}
                  type="number"
                  min="0"
                  placeholder="0"
                  value={form.min_amount_xaf}
                  onChange={(e) => setForm({ ...form, min_amount_xaf: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 ml-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">Début</label>
                  <input
                    type="date"
                    className={fieldClass}
                    value={form.valid_from}
                    onChange={(e) => setForm({ ...form, valid_from: e.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-1.5 ml-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">Fin</label>
                  <input
                    type="date"
                    className={fieldClass}
                    value={form.valid_until}
                    onChange={(e) => setForm({ ...form, valid_until: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 flex justify-end gap-3 border-t border-slate-100 bg-white px-6 py-4">
              <button
                type="button"
                onClick={() => setShow(false)}
                className="rounded-2xl px-5 py-3 font-bold text-slate-500 transition-colors hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={create}
                disabled={submitting || !form.code || !form.discount_value}
                className="flex items-center gap-2 rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-black text-white shadow-lg shadow-emerald-600/20 transition-all hover:bg-emerald-700 disabled:opacity-40"
              >
                {submitting ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                Créer le code
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
