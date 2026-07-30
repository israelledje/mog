'use client';

import { useCallback, useEffect, useState } from 'react';
import { Handshake, Plus, Loader2, Save, X, Check } from 'lucide-react';
import { API_BASE_URL } from '@/lib/api';

const headers = () => ({
  Authorization: `Bearer ${localStorage.getItem('admin_token') || ''}`,
  'Content-Type': 'application/json',
});

export default function CommerciauxPage() {
  const [agents, setAgents] = useState<any[]>([]);
  const [commissions, setCommissions] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>({});
  const [tab, setTab] = useState<'agents' | 'commissions' | 'settings'>('agents');
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    full_name: '', phone: '', email: '', referral_code: '', commission_rate_percent: '5',
  });
  const [settingsForm, setSettingsForm] = useState({
    default_commission_rate_percent: '5',
    referral_signup_bonus_points: '50',
    commission_on_groupage: true,
    commission_on_marketplace: true,
    commission_on_paid_packages: true,
    marketplace_enabled: true,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, c, s] = await Promise.all([
        fetch(`${API_BASE_URL}/growth/agents`, { headers: headers() }),
        fetch(`${API_BASE_URL}/growth/commissions`, { headers: headers() }),
        fetch(`${API_BASE_URL}/growth/settings`, { headers: headers() }),
      ]);
      if (a.status === 401) { window.location.href = '/login'; return; }
      if (a.ok) setAgents(await a.json());
      if (c.ok) setCommissions(await c.json());
      if (s.ok) {
        const data = await s.json();
        setSettings(data);
        setSettingsForm({
          default_commission_rate_percent: String(data.default_commission_rate_percent ?? 5),
          referral_signup_bonus_points: String(data.referral_signup_bonus_points ?? 50),
          commission_on_groupage: data.commission_on_groupage !== false,
          commission_on_marketplace: data.commission_on_marketplace !== false,
          commission_on_paid_packages: data.commission_on_paid_packages !== false,
          marketplace_enabled: data.marketplace_enabled !== false,
        });
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const createAgent = async () => {
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE_URL}/growth/agents`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          full_name: form.full_name,
          phone: form.phone || null,
          email: form.email,
          referral_code: form.referral_code.trim().toUpperCase() || null,
          commission_rate_percent: Number(form.commission_rate_percent),
          active: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(typeof data.detail === 'string' ? data.detail : 'Erreur'); return; }
      setShow(false);
      setForm({ full_name: '', phone: '', email: '', referral_code: '', commission_rate_percent: '5' });
      load();
    } catch { setError('Erreur réseau'); }
    finally { setSubmitting(false); }
  };

  const saveSettings = async () => {
    setSubmitting(true);
    try {
      await fetch(`${API_BASE_URL}/growth/settings`, {
        method: 'PATCH',
        headers: headers(),
        body: JSON.stringify({
          default_commission_rate_percent: Number(settingsForm.default_commission_rate_percent),
          referral_signup_bonus_points: Number(settingsForm.referral_signup_bonus_points),
          commission_on_groupage: settingsForm.commission_on_groupage,
          commission_on_marketplace: settingsForm.commission_on_marketplace,
          commission_on_paid_packages: settingsForm.commission_on_paid_packages,
          marketplace_enabled: settingsForm.marketplace_enabled,
        }),
      });
      load();
    } catch {}
    finally { setSubmitting(false); }
  };

  const markPaid = async (id: string) => {
    await fetch(`${API_BASE_URL}/growth/commissions/${id}/pay`, { method: 'POST', headers: headers() });
    load();
  };

  const pendingTotal = commissions
    .filter((c) => c.status === 'pending')
    .reduce((s, c) => s + Number(c.commission_xaf || 0), 0);

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
            <Handshake className="text-violet-600" /> Commerciaux & commissions
          </h1>
          <p className="text-slate-500 font-medium mt-1">
            Codes de parrainage · commissions automatiques · {pendingTotal.toLocaleString()} XAF en attente
          </p>
        </div>
        {tab === 'agents' && (
          <button onClick={() => setShow(true)} className="flex items-center gap-2 px-5 py-3 bg-slate-900 text-white rounded-2xl font-black text-sm">
            <Plus size={16} /> Nouveau commercial
          </button>
        )}
      </div>

      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit">
        {([
          ['agents', `Commerciaux (${agents.length})`],
          ['commissions', `Commissions (${commissions.length})`],
          ['settings', 'Paramètres'],
        ] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-4 py-2 rounded-lg text-xs font-black ${tab === k ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400'}`}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-violet-600" size={36} /></div>
      ) : tab === 'agents' ? (
        <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-widest text-slate-400 font-black">
              <tr>
                <th className="p-4 text-left">Commercial</th>
                <th className="p-4 text-left">Code parrainage</th>
                <th className="p-4 text-left">Commission</th>
                <th className="p-4 text-left">Contact</th>
                <th className="p-4 text-left">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {agents.map((a) => (
                <tr key={a.id}>
                  <td className="p-4 font-black text-slate-900">{a.full_name}</td>
                  <td className="p-4 font-mono font-black text-violet-700">{a.referral_code}</td>
                  <td className="p-4 font-bold">{a.commission_rate_percent ?? settings.default_commission_rate_percent ?? 5}%</td>
                  <td className="p-4 text-slate-500 text-xs">{a.phone || a.email || '—'}</td>
                  <td className="p-4">
                    <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg ${a.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100'}`}>
                      {a.active ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : tab === 'commissions' ? (
        <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-widest text-slate-400 font-black">
              <tr>
                <th className="p-4 text-left">Date</th>
                <th className="p-4 text-left">Commercial</th>
                <th className="p-4 text-left">Source</th>
                <th className="p-4 text-left">Montant</th>
                <th className="p-4 text-left">Statut</th>
                <th className="p-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {commissions.map((c) => (
                <tr key={c.id}>
                  <td className="p-4 text-xs text-slate-500">{c.created_at ? new Date(c.created_at).toLocaleString() : '—'}</td>
                  <td className="p-4 font-bold">{c.agent_name || c.agent_code || c.agent_id}</td>
                  <td className="p-4 text-xs font-black uppercase">{c.source} · {c.reference_id}</td>
                  <td className="p-4 font-black">{Number(c.commission_xaf || 0).toLocaleString()} XAF</td>
                  <td className="p-4 text-xs font-black uppercase">{c.status}</td>
                  <td className="p-4 text-right">
                    {c.status === 'pending' && (
                      <button onClick={() => markPaid(c.id)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-black">
                        <Check size={12} /> Payer
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-100 p-8 space-y-4 max-w-lg">
          <h2 className="font-black text-lg">Paramètres de commission</h2>
          <label className="block text-xs font-black uppercase text-slate-400">% commission par défaut</label>
          <input className="w-full border rounded-xl p-3 font-bold" value={settingsForm.default_commission_rate_percent} onChange={(e) => setSettingsForm({ ...settingsForm, default_commission_rate_percent: e.target.value })} />
          <label className="block text-xs font-black uppercase text-slate-400">Bonus points inscription (parrainage)</label>
          <input className="w-full border rounded-xl p-3 font-bold" value={settingsForm.referral_signup_bonus_points} onChange={(e) => setSettingsForm({ ...settingsForm, referral_signup_bonus_points: e.target.value })} />
          {([
            ['commission_on_groupage', 'Commission sur groupage'],
            ['commission_on_marketplace', 'Commission sur marketplace'],
            ['commission_on_paid_packages', 'Commission sur paiements colis'],
            ['marketplace_enabled', 'Marketplace activée'],
          ] as const).map(([k, label]) => (
            <label key={k} className="flex items-center gap-3 font-bold text-sm">
              <input type="checkbox" checked={!!settingsForm[k]} onChange={(e) => setSettingsForm({ ...settingsForm, [k]: e.target.checked })} />
              {label}
            </label>
          ))}
          <button onClick={saveSettings} disabled={submitting} className="flex items-center gap-2 px-5 py-3 bg-violet-600 text-white rounded-2xl font-black text-sm disabled:opacity-40">
            {submitting ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Enregistrer
          </button>
        </div>
      )}

      {show && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-black">Nouveau commercial</h2>
              <button onClick={() => setShow(false)}><X size={20} /></button>
            </div>
            {error && <p className="text-sm text-red-600 font-bold">{error}</p>}
            <input className="w-full border rounded-xl p-3 font-bold" placeholder="Nom complet" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            <input className="w-full border rounded-xl p-3 font-bold" placeholder="Email (obligatoire)" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <input className="w-full border rounded-xl p-3 font-mono font-black uppercase" placeholder="Code parrainage (auto si vide)" value={form.referral_code} onChange={(e) => setForm({ ...form, referral_code: e.target.value })} />
            <input className="w-full border rounded-xl p-3 font-bold" placeholder="Téléphone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <input className="w-full border rounded-xl p-3 font-bold" placeholder="% commission" value={form.commission_rate_percent} onChange={(e) => setForm({ ...form, commission_rate_percent: e.target.value })} />
            <button onClick={createAgent} disabled={submitting || !form.full_name || !form.email} className="w-full py-3 bg-violet-600 text-white rounded-2xl font-black flex items-center justify-center gap-2 disabled:opacity-40">
              {submitting ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Créer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
