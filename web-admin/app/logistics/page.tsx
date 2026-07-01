'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus, Ship, Plane, Calendar, CheckCircle2, Clock, Loader2, X,
  Edit3, Package, ChevronRight, Search, Filter, MoreHorizontal,
  MapPin, AlertCircle, ArrowRight, Save
} from 'lucide-react';
import { API } from '@/lib/api';
const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('admin_token') ?? '' : '';

const STATUS_CFG: Record<string, { label: string; dot: string; text: string; bg: string }> = {
  open:        { label: 'Ouvert',      dot: 'bg-emerald-400', text: 'text-emerald-700', bg: 'bg-emerald-50' },
  closed:      { label: 'Clôturé',     dot: 'bg-violet-400',  text: 'text-violet-700',  bg: 'bg-violet-50'  },
  in_transit:  { label: 'En Transit',  dot: 'bg-blue-400',    text: 'text-blue-700',    bg: 'bg-blue-50'    },
  arrived:     { label: 'Arrivé',      dot: 'bg-sky-400',     text: 'text-sky-700',     bg: 'bg-sky-50'     },
  distributed: { label: 'Distribué',   dot: 'bg-slate-400',   text: 'text-slate-600',   bg: 'bg-slate-100'  },
};

const STATUS_ORDER = ['open', 'closed', 'in_transit', 'arrived', 'distributed'];

const BLANK_CONTAINER = {
  container_number: '', destination_city: 'Douala',
  mode: 'sea', origin_port: 'Guangzhou',
  departure_date: '', estimated_arrival: '', vessel_name: ''
};

export default function LogisticsPage() {
  const router = useRouter();
  const [containers, setContainers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

  // Modals
  const [showCreate, setShowCreate] = useState(false);
  const [editContainer, setEditContainer] = useState<any>(null);
  const [newForm, setNewForm] = useState({ ...BLANK_CONTAINER });
  const [submitting, setSubmitting] = useState(false);
  const [closeOtp, setCloseOtp] = useState<{ id: string; number: string } | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);

  const fetchContainers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/groupages/`, { headers: { Authorization: `Bearer ${getToken()}` } });
      if (res.status === 401) { window.location.href = '/login'; return; }
      if (res.ok) setContainers(await res.json());
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchContainers(); }, [fetchContainers]);

  const handleCreate = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/groupages/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(newForm),
      });
      if (res.ok) { setShowCreate(false); setNewForm({ ...BLANK_CONTAINER }); fetchContainers(); }
    } catch {}
    setSubmitting(false);
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    if (status === 'closed') {
      const c = containers.find(x => x.id === id);
      setCloseOtp({ id, number: c?.container_number || id });
      setOtpCode('');
      setOtpSent(false);
      return;
    }
    await fetch(`${API}/groupages/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ status }),
    });
    fetchContainers();
  };

  const sendCloseOtp = async () => {
    if (!closeOtp) return;
    setSubmitting(true);
    try {
      await fetch(`${API}/groupages/${closeOtp.id}/close/request-otp`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      setOtpSent(true);
    } catch {}
    setSubmitting(false);
  };

  const confirmClose = async () => {
    if (!closeOtp || otpCode.length < 6) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/groupages/${closeOtp.id}/close/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ otp_code: otpCode }),
      });
      if (res.ok) {
        setCloseOtp(null);
        fetchContainers();
      } else {
        const err = await res.json();
        alert(err.detail || 'OTP incorrect');
      }
    } catch {}
    setSubmitting(false);
  };

  const handleUpdateInfo = async () => {
    if (!editContainer) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/groupages/${editContainer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({
          container_number: editContainer.container_number,
          destination_city: editContainer.destination_city,
          origin_port: editContainer.origin_port,
          departure_date: editContainer.departure_date,
          estimated_arrival: editContainer.estimated_arrival,
          vessel_name: editContainer.vessel_name,
          mode: editContainer.mode,
        }),
      });
      if (res.ok) { setEditContainer(null); fetchContainers(); }
    } catch {}
    setSubmitting(false);
  };

  const filtered = containers.filter(c => {
    const matchStatus = statusFilter === 'all' || c.status === statusFilter;
    const matchSearch = !search || c.container_number.toLowerCase().includes(search.toLowerCase())
      || c.destination_city?.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  // Count by status
  const counts = STATUS_ORDER.reduce((acc, s) => {
    acc[s] = containers.filter(c => c.status === s).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="min-h-screen bg-slate-50/40">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-8 py-5 sticky top-0 z-20">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Gestion Logistique</h1>
            <p className="text-slate-400 text-sm font-medium">Groupages maritimes et aériens en cours</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white text-sm font-black rounded-xl hover:bg-blue-600 transition-all shadow-lg shadow-slate-900/10 hover:-translate-y-0.5"
          >
            <Plus size={16} /> Nouveau Groupage
          </button>
        </div>

        {/* Status filter pills + search */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              placeholder="Rechercher un groupage..."
              className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-blue-400 w-56 transition-all"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${statusFilter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-700'}`}
            >
              Tous ({containers.length})
            </button>
            {STATUS_ORDER.map(s => {
              const cfg = STATUS_CFG[s];
              return (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${statusFilter === s ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-700'}`}
                >
                  {cfg.label} ({counts[s] || 0})
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="px-8 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-32">
            <Loader2 className="animate-spin text-blue-600" size={40} />
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            {/* Column headers */}
            <div className="grid grid-cols-[auto_1fr_1fr_1fr_1fr_1fr_auto] px-6 py-3 bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest items-center gap-4">
              <span className="w-10" />
              <span>Groupage</span>
              <span>Route</span>
              <span>Colis</span>
              <span>Dates</span>
              <span>Statut</span>
              <span className="text-right pr-2">Actions</span>
            </div>

            <div className="divide-y divide-slate-50">
              {filtered.length === 0 ? (
                <div className="py-24 text-center">
                  <Package size={48} className="mx-auto text-slate-200 mb-4" />
                  <p className="text-slate-400 font-bold">Aucun groupage trouvé</p>
                </div>
              ) : filtered.map(c => {
                const cfg = STATUS_CFG[c.status] || STATUS_CFG.open;
                const isAir = c.mode === 'air';
                return (
                  <div key={c.id} className="grid grid-cols-[auto_1fr_1fr_1fr_1fr_1fr_auto] px-6 py-4 items-center gap-4 hover:bg-slate-50/50 transition-colors group">
                    {/* Mode icon */}
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${isAir ? 'bg-sky-100' : 'bg-blue-100'} group-hover:scale-110 transition-transform`}>
                      {isAir ? <Plane size={18} className="text-sky-600" /> : <Ship size={18} className="text-blue-600" />}
                    </div>

                    {/* Container ref */}
                    <div>
                      <p className="font-black text-slate-900 text-sm tracking-tight">{c.container_number}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">{isAir ? 'Aérien' : 'Maritime'}</p>
                    </div>

                    {/* Route */}
                    <div className="flex items-center gap-1.5 text-sm">
                      <span className="font-bold text-slate-500">{c.origin_port || '—'}</span>
                      <ArrowRight size={12} className="text-slate-300" />
                      <span className="font-bold text-slate-700">{c.destination_city}</span>
                    </div>

                    {/* Packages count */}
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 text-xs font-black">
                        {c.packages_ids?.length || 0}
                      </div>
                      <span className="text-xs text-slate-400 font-bold">colis</span>
                    </div>

                    {/* Dates */}
                    <div className="space-y-0.5">
                      <p className="text-[10px] text-slate-400 font-bold">
                        Départ: <span className="text-slate-700">{c.departure_date ? new Date(c.departure_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : '—'}</span>
                      </p>
                      <p className="text-[10px] text-slate-400 font-bold">
                        Arrivée: <span className="text-slate-700">{c.estimated_arrival ? new Date(c.estimated_arrival).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : '—'}</span>
                      </p>
                    </div>

                    {/* Status */}
                    <div>
                      <select
                        value={c.status}
                        onChange={e => handleUpdateStatus(c.id, e.target.value)}
                        className={`text-[10px] font-black uppercase px-3 py-1.5 rounded-xl border-0 cursor-pointer outline-none ${cfg.bg} ${cfg.text}`}
                      >
                        {STATUS_ORDER.map(s => (
                          <option key={s} value={s}>{STATUS_CFG[s].label}</option>
                        ))}
                      </select>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => setEditContainer({ ...c })}
                        title="Modifier"
                        className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-all"
                      >
                        <Edit3 size={16} />
                      </button>
                      <button
                        onClick={() => router.push(`/logistics/${c.id}/colis`)}
                        title="Voir les colis"
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 text-white text-[10px] font-black hover:bg-blue-700 transition-all"
                      >
                        <Package size={12} /> Colis <ChevronRight size={10} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Create Modal ── */}
      {showCreate && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-lg shadow-2xl animate-in fade-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black text-slate-900">Nouveau Groupage</h2>
              <button onClick={() => setShowCreate(false)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400"><X size={20} /></button>
            </div>

            <div className="space-y-4">
              <div className="flex gap-3">
                {(['sea', 'air'] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => setNewForm(f => ({ ...f, mode: m }))}
                    className={`flex-1 py-4 rounded-2xl border-2 flex flex-col items-center gap-1.5 transition-all font-bold text-sm ${
                      newForm.mode === m
                        ? m === 'sea' ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-sky-500 bg-sky-50 text-sky-600'
                        : 'border-slate-100 text-slate-400 hover:border-slate-200'
                    }`}
                  >
                    {m === 'sea' ? <Ship size={22} /> : <Plane size={22} />}
                    {m === 'sea' ? 'Maritime' : 'Aérien'}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Réf. Groupage" value={newForm.container_number} onChange={(v: string) => setNewForm(f => ({ ...f, container_number: v }))} placeholder="CONT-2024-XXX" />
                <Field label="Port d'origine" value={newForm.origin_port} onChange={(v: string) => setNewForm(f => ({ ...f, origin_port: v }))} placeholder="Guangzhou" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Destination</label>
                  <select className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 font-bold text-slate-800 outline-none focus:border-blue-400 text-sm"
                    value={newForm.destination_city} onChange={e => setNewForm(f => ({ ...f, destination_city: e.target.value }))}>
                    <option value="Douala">Douala</option>
                    <option value="Yaoundé">Yaoundé</option>
                    <option value="Bafoussam">Bafoussam</option>
                  </select>
                </div>
                <Field label="Nom du navire / vol" value={newForm.vessel_name} onChange={(v: string) => setNewForm(f => ({ ...f, vessel_name: v }))} placeholder="MSC Floriana..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field type="date" label="Départ prévu" value={newForm.departure_date} onChange={(v: string) => setNewForm(f => ({ ...f, departure_date: v }))} />
                <Field type="date" label="Arrivée prévue" value={newForm.estimated_arrival} onChange={(v: string) => setNewForm(f => ({ ...f, estimated_arrival: v }))} />
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowCreate(false)} className="flex-1 py-3 text-slate-400 font-bold hover:text-slate-600 transition-colors">Annuler</button>
                <button
                  onClick={handleCreate}
                  disabled={submitting || !newForm.container_number}
                  className="flex-[2] py-3 bg-slate-900 text-white rounded-2xl font-black text-sm hover:bg-blue-600 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                  Créer le groupage
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Modal ── */}
      {editContainer && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-lg shadow-2xl animate-in fade-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black text-slate-900">Modifier le groupage</h2>
              <button onClick={() => setEditContainer(null)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400"><X size={20} /></button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Réf. Groupage" value={editContainer.container_number} onChange={(v: string) => setEditContainer((c: any) => ({ ...c, container_number: v }))} />
                <Field label="Port d'origine" value={editContainer.origin_port || ''} onChange={(v: string) => setEditContainer((c: any) => ({ ...c, origin_port: v }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Destination</label>
                  <select className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 font-bold text-slate-800 outline-none focus:border-blue-400 text-sm"
                    value={editContainer.destination_city} onChange={e => setEditContainer((c: any) => ({ ...c, destination_city: e.target.value }))}>
                    <option value="Douala">Douala</option>
                    <option value="Yaoundé">Yaoundé</option>
                    <option value="Bafoussam">Bafoussam</option>
                  </select>
                </div>
                <Field label="Navire / Vol" value={editContainer.vessel_name || ''} onChange={(v: string) => setEditContainer((c: any) => ({ ...c, vessel_name: v }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field type="date" label="Départ prévu" value={editContainer.departure_date ? editContainer.departure_date.split('T')[0] : ''} onChange={(v: string) => setEditContainer((c: any) => ({ ...c, departure_date: v }))} />
                <Field type="date" label="Arrivée prévue" value={editContainer.estimated_arrival ? editContainer.estimated_arrival.split('T')[0] : ''} onChange={(v: string) => setEditContainer((c: any) => ({ ...c, estimated_arrival: v }))} />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setEditContainer(null)} className="flex-1 py-3 text-slate-400 font-bold hover:text-slate-600 transition-colors">Annuler</button>
                <button
                  onClick={handleUpdateInfo}
                  disabled={submitting}
                  className="flex-[2] py-3 bg-slate-900 text-white rounded-2xl font-black text-sm hover:bg-blue-600 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  Enregistrer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {closeOtp && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl">
            <h2 className="text-xl font-black text-slate-900 mb-2">Clôture PL — OTP requis</h2>
            <p className="text-sm text-slate-500 mb-6">Groupage <strong>{closeOtp.number}</strong>. Un code sera envoyé sur WhatsApp.</p>
            {!otpSent ? (
              <button onClick={sendCloseOtp} disabled={submitting} className="w-full py-3 bg-blue-600 text-white rounded-xl font-black">
                {submitting ? 'Envoi…' : 'Envoyer le code OTP'}
              </button>
            ) : (
              <>
                <input
                  className="w-full border border-slate-200 rounded-xl p-4 text-center text-2xl font-black tracking-widest mb-4"
                  placeholder="000000"
                  maxLength={6}
                  value={otpCode}
                  onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))}
                />
                <button onClick={confirmClose} disabled={submitting || otpCode.length < 6} className="w-full py-3 bg-violet-600 text-white rounded-xl font-black disabled:opacity-50">
                  Confirmer la clôture
                </button>
              </>
            )}
            <button onClick={() => setCloseOtp(null)} className="w-full mt-3 py-2 text-slate-400 font-bold">Annuler</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, placeholder = '', type = 'text' }: any) {
  return (
    <div>
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 font-bold text-slate-800 outline-none focus:border-blue-400 text-sm transition-all"
      />
    </div>
  );
}
