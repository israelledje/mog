'use client';

import { useCallback, useEffect, useState } from 'react';
import { Handshake, Plus, Loader2, Save, X, Check, AlertCircle } from 'lucide-react';
import { API_BASE_URL } from '@/lib/api';

const headers = () => ({
  Authorization: `Bearer ${localStorage.getItem('admin_token') || ''}`,
  'Content-Type': 'application/json',
});

const fieldClass =
  'w-full px-4 py-3 rounded-2xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none font-semibold text-sm transition-all';

const DEFAULT_TIERS = [
  { id: 'bronze', name: 'Bronze', min_cbm: 0, points_per_cbm: 10, emoji: '🥉' },
  { id: 'silver', name: 'Silver', min_cbm: 20, points_per_cbm: 15, emoji: '🥈' },
  { id: 'gold', name: 'Gold', min_cbm: 50, points_per_cbm: 20, emoji: '🥇' },
  { id: 'vip', name: 'VIP', min_cbm: 100, points_per_cbm: 25, emoji: '🏆' },
];

export default function CommerciauxPage() {
  const [agents, setAgents] = useState<any[]>([]);
  const [commissions, setCommissions] = useState<any[]>([]);
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
    point_value_xaf: '20',
    vip_benefits: '',
    commission_on_groupage: true,
    commission_on_marketplace: true,
    commission_on_paid_packages: true,
    marketplace_enabled: true,
    loyalty_tiers: DEFAULT_TIERS,
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
        setSettingsForm({
          default_commission_rate_percent: String(data.default_commission_rate_percent ?? 5),
          referral_signup_bonus_points: String(data.referral_signup_bonus_points ?? 50),
          point_value_xaf: String(data.point_value_xaf ?? 20),
          vip_benefits: data.vip_benefits || '',
          commission_on_groupage: data.commission_on_groupage !== false,
          commission_on_marketplace: data.commission_on_marketplace !== false,
          commission_on_paid_packages: data.commission_on_paid_packages !== false,
          marketplace_enabled: data.marketplace_enabled !== false,
          loyalty_tiers: Array.isArray(data.loyalty_tiers) && data.loyalty_tiers.length
            ? data.loyalty_tiers
            : DEFAULT_TIERS,
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

  const toggleAgent = async (id: string, active: boolean) => {
    await fetch(`${API_BASE_URL}/growth/agents/${id}`, {
      method: 'PATCH',
      headers: headers(),
      body: JSON.stringify({ active: !active }),
    });
    load();
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
          point_value_xaf: Number(settingsForm.point_value_xaf),
          vip_benefits: settingsForm.vip_benefits,
          commission_on_groupage: settingsForm.commission_on_groupage,
          commission_on_marketplace: settingsForm.commission_on_marketplace,
          commission_on_paid_packages: settingsForm.commission_on_paid_packages,
          marketplace_enabled: settingsForm.marketplace_enabled,
          loyalty_tiers: settingsForm.loyalty_tiers.map((t) => ({
            ...t,
            min_cbm: Number(t.min_cbm),
            points_per_cbm: Number(t.points_per_cbm),
          })),
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
    <div className="p-8 max-w-7xl mx-auto space-y-6 text-slate-900">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
            <Handshake className="text-violet-600" /> M.O.G PARTNERS
          </h1>
          <p className="text-slate-500 font-medium mt-1">
            Commerciaux · codes · clients · CBM · commissions · {pendingTotal.toLocaleString()} XAF en attente
          </p>
        </div>
        {tab === 'agents' && (
          <button
            onClick={() => { setError(''); setShow(true); }}
            className="flex items-center gap-2 px-5 py-3 bg-slate-900 text-white rounded-2xl font-black text-sm hover:bg-slate-800 transition-colors"
          >
            <Plus size={16} /> Nouveau partenaire
          </button>
        )}
      </div>

      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit">
        {([
          ['agents', `Partenaires (${agents.length})`],
          ['commissions', `Commissions (${commissions.length})`],
          ['settings', 'M.O.G CLUB & règles'],
        ] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-4 py-2 rounded-lg text-xs font-black ${tab === k ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400'}`}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-violet-600" size={36} /></div>
      ) : tab === 'agents' ? (
        <div className="bg-white rounded-3xl border border-slate-100 overflow-x-auto shadow-sm">
          <table className="w-full text-sm min-w-[900px]">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-widest text-slate-400 font-black">
              <tr>
                <th className="p-4 text-left">Commercial</th>
                <th className="p-4 text-left">Code</th>
                <th className="p-4 text-left">Clients</th>
                <th className="p-4 text-left">Commandes</th>
                <th className="p-4 text-left">Volume CBM</th>
                <th className="p-4 text-left">Commission %</th>
                <th className="p-4 text-left">À payer</th>
                <th className="p-4 text-left">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {agents.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50/60">
                  <td className="p-4">
                    <div className="font-black text-slate-900">{a.full_name}</div>
                    <div className="text-xs text-slate-400">{a.phone || a.email || '—'}</div>
                  </td>
                  <td className="p-4 font-mono font-black text-violet-700">{a.referral_code}</td>
                  <td className="p-4 font-bold">{a.stats?.clients_count ?? 0}</td>
                  <td className="p-4 font-bold">{a.stats?.orders_count ?? 0}</td>
                  <td className="p-4 font-bold">{Number(a.stats?.total_cbm || 0).toLocaleString()}</td>
                  <td className="p-4 font-bold">{a.commission_rate_percent ?? 5}%</td>
                  <td className="p-4 font-black text-amber-700">
                    {Number(a.stats?.pending_commission_xaf || 0).toLocaleString()} XAF
                  </td>
                  <td className="p-4">
                    <button
                      onClick={() => toggleAgent(a.id, !!a.active)}
                      className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg ${a.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}
                    >
                      {a.active ? 'Actif' : 'Inactif'}
                    </button>
                  </td>
                </tr>
              ))}
              {!agents.length && (
                <tr><td colSpan={8} className="p-10 text-center text-slate-400 font-medium">Aucun partenaire</td></tr>
              )}
            </tbody>
          </table>
        </div>
      ) : tab === 'commissions' ? (
        <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
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
                <tr key={c.id} className="hover:bg-slate-50/60">
                  <td className="p-4 text-xs text-slate-500">{c.created_at ? new Date(c.created_at).toLocaleString() : '—'}</td>
                  <td className="p-4 font-bold text-slate-800">{c.agent_name || c.agent_code || c.agent_id}</td>
                  <td className="p-4 text-xs font-black uppercase text-slate-600">{c.source} · {c.reference_id}</td>
                  <td className="p-4 font-black text-slate-900">{Number(c.commission_xaf || 0).toLocaleString()} XAF</td>
                  <td className="p-4 text-xs font-black uppercase text-slate-600">{c.status}</td>
                  <td className="p-4 text-right">
                    {c.status === 'pending' && (
                      <button onClick={() => markPaid(c.id)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-black">
                        <Check size={12} /> Payer
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!commissions.length && (
                <tr><td colSpan={6} className="p-10 text-center text-slate-400 font-medium">Aucune commission</td></tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-3xl border border-slate-100 p-8 space-y-4 shadow-sm">
            <h2 className="font-black text-lg text-slate-900">Commissions partenaires</h2>
            <div>
              <label className="mb-1.5 ml-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">% commission par défaut</label>
              <input className={fieldClass} value={settingsForm.default_commission_rate_percent} onChange={(e) => setSettingsForm({ ...settingsForm, default_commission_rate_percent: e.target.value })} />
            </div>
            <div>
              <label className="mb-1.5 ml-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">Bonus points inscription</label>
              <input className={fieldClass} value={settingsForm.referral_signup_bonus_points} onChange={(e) => setSettingsForm({ ...settingsForm, referral_signup_bonus_points: e.target.value })} />
            </div>
            {([
              ['commission_on_groupage', 'Commission sur groupage'],
              ['commission_on_marketplace', 'Commission sur marketplace'],
              ['commission_on_paid_packages', 'Commission sur paiements colis'],
              ['marketplace_enabled', 'M.O.G MARKET activé'],
            ] as const).map(([k, label]) => (
              <label key={k} className="flex items-center gap-3 font-bold text-sm text-slate-800">
                <input type="checkbox" checked={!!settingsForm[k]} onChange={(e) => setSettingsForm({ ...settingsForm, [k]: e.target.checked })} />
                {label}
              </label>
            ))}
          </div>

          <div className="bg-white rounded-3xl border border-slate-100 p-8 space-y-4 shadow-sm">
            <h2 className="font-black text-lg text-slate-900">Règles M.O.G CLUB</h2>
            <p className="text-xs text-slate-500 font-medium">
              Points crédités automatiquement à l&apos;expédition (statut en transit). 1 pt = valeur FCFA ci-dessous.
            </p>
            <div>
              <label className="mb-1.5 ml-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">Valeur 1 point (FCFA)</label>
              <input className={fieldClass} value={settingsForm.point_value_xaf} onChange={(e) => setSettingsForm({ ...settingsForm, point_value_xaf: e.target.value })} />
            </div>
            <div>
              <label className="mb-1.5 ml-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">Avantages VIP</label>
              <textarea className={fieldClass} rows={2} value={settingsForm.vip_benefits} onChange={(e) => setSettingsForm({ ...settingsForm, vip_benefits: e.target.value })} />
            </div>
            <div className="space-y-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Paliers (seuil CBM → pts/CBM)</p>
              {settingsForm.loyalty_tiers.map((tier, idx) => (
                <div key={tier.id} className="grid grid-cols-4 gap-2 items-center">
                  <div className="font-bold text-sm">{tier.emoji} {tier.name}</div>
                  <input
                    className={fieldClass}
                    type="number"
                    value={tier.min_cbm}
                    onChange={(e) => {
                      const next = [...settingsForm.loyalty_tiers];
                      next[idx] = { ...tier, min_cbm: Number(e.target.value) };
                      setSettingsForm({ ...settingsForm, loyalty_tiers: next });
                    }}
                    title="Seuil CBM"
                  />
                  <input
                    className={fieldClass}
                    type="number"
                    value={tier.points_per_cbm}
                    onChange={(e) => {
                      const next = [...settingsForm.loyalty_tiers];
                      next[idx] = { ...tier, points_per_cbm: Number(e.target.value) };
                      setSettingsForm({ ...settingsForm, loyalty_tiers: next });
                    }}
                    title="Points / CBM"
                  />
                  <div className="text-xs text-slate-400 font-bold">pts/CBM</div>
                </div>
              ))}
            </div>
            <button onClick={saveSettings} disabled={submitting} className="flex items-center gap-2 px-5 py-3 bg-violet-600 text-white rounded-2xl font-black text-sm disabled:opacity-40">
              {submitting ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Enregistrer les règles
            </button>
          </div>
        </div>
      )}

      {show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-[28px] shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-slate-50/95 px-6 py-5 backdrop-blur">
              <div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight">Nouveau partenaire</h2>
                <p className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-500">M.O.G PARTNERS</p>
              </div>
              <button type="button" onClick={() => setShow(false)} className="rounded-2xl border border-transparent p-2.5 text-slate-400 transition-all hover:border-slate-200 hover:bg-white hover:text-slate-600">
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
              <div>
                <label className="mb-1.5 ml-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">Nom complet</label>
                <input className={fieldClass} placeholder="Jean Dupont" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
              </div>
              <div>
                <label className="mb-1.5 ml-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">Email</label>
                <input type="email" className={fieldClass} placeholder="jean@mog.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 ml-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">Téléphone</label>
                  <input className={fieldClass} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div>
                  <label className="mb-1.5 ml-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">Commission %</label>
                  <input type="number" className={fieldClass} value={form.commission_rate_percent} onChange={(e) => setForm({ ...form, commission_rate_percent: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="mb-1.5 ml-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">Code partenaire</label>
                <input className={`${fieldClass} font-mono uppercase`} placeholder="Auto si vide" value={form.referral_code} onChange={(e) => setForm({ ...form, referral_code: e.target.value })} />
              </div>
            </div>
            <div className="sticky bottom-0 flex justify-end gap-3 border-t border-slate-100 bg-white px-6 py-4">
              <button type="button" onClick={() => setShow(false)} className="rounded-2xl px-5 py-3 font-bold text-slate-500 hover:bg-slate-50">Annuler</button>
              <button type="button" onClick={createAgent} disabled={submitting || !form.full_name || !form.email} className="flex items-center gap-2 rounded-2xl bg-violet-600 px-6 py-3 text-sm font-black text-white disabled:opacity-40">
                {submitting ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Créer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
