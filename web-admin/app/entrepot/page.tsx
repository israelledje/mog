'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Warehouse, Plus, Package, Search, Loader2, X, MapPin,
  Clock, CheckCircle2, Truck, Archive, ChevronRight,
  Building2, Edit3, Trash2, Save, AlertCircle, Calendar
} from 'lucide-react';

const API = 'http://127.0.0.1:8000/api';
const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('admin_token') ?? '' : '';

const PKG_STATUS: Record<string, { label: string; bg: string; text: string; icon: any }> = {
  draft:              { label: 'Brouillon',       bg: 'bg-slate-100',   text: 'text-slate-500',   icon: Clock },
  pending_reception:  { label: 'En Attente',      bg: 'bg-amber-50',    text: 'text-amber-700',   icon: AlertCircle },
  received:           { label: 'Réceptionné',     bg: 'bg-blue-50',     text: 'text-blue-700',    icon: Archive },
  loaded:             { label: 'En Groupage',     bg: 'bg-violet-50',   text: 'text-violet-700',  icon: Package },
  in_transit:         { label: 'En Transit',      bg: 'bg-sky-50',      text: 'text-sky-700',     icon: Truck },
  arrived:            { label: 'Arrivé',          bg: 'bg-emerald-50',  text: 'text-emerald-700', icon: CheckCircle2 },
  delivered:          { label: 'Livré',           bg: 'bg-emerald-100', text: 'text-emerald-800', icon: CheckCircle2 },
};

const STATUS_TABS = [
  { key: 'all',             label: 'Tous',          icon: Package },
  { key: 'pending_reception', label: 'En Attente',  icon: AlertCircle },
  { key: 'received',        label: 'Reçus',         icon: Archive },
  { key: 'loaded',          label: 'En Groupage',   icon: Package },
  { key: 'in_transit',      label: 'En Transit',    icon: Truck },
  { key: 'arrived',         label: 'Arrivés',       icon: CheckCircle2 },
  { key: 'delivered',       label: 'Livrés',        icon: CheckCircle2 },
];

const BLANK_ENTREPOT = {
  name: '', city: 'Guangzhou', country: 'Chine', type: 'origin', address: '', contact: ''
};

export default function EntrepotPage() {
  const [packages, setPackages] = useState<any[]>([]);
  const [entrepots, setEntrepots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'packages' | 'entrepots'>('packages');

  // Modals
  const [showCreateEntrepot, setShowCreateEntrepot] = useState(false);
  const [editEntrepot, setEditEntrepot] = useState<any>(null);
  const [newEntrepot, setNewEntrepot] = useState({ ...BLANK_ENTREPOT });
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const headers = { Authorization: `Bearer ${getToken()}` };
    try {
      const [pRes, eRes] = await Promise.all([
        fetch(`${API}/colis/?limit=1000&skip=0`, { headers }),
        fetch(`${API}/entrepots/`, { headers }),
      ]);
      if (pRes.ok) setPackages(await pRes.json());
      if (eRes.ok) setEntrepots(await eRes.json());
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const createEntrepot = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/entrepots/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(newEntrepot),
      });
      if (res.ok) {
        setShowCreateEntrepot(false);
        setNewEntrepot({ ...BLANK_ENTREPOT });
        loadData();
      }
    } catch {}
    setSubmitting(false);
  };

  const updateEntrepot = async () => {
    if (!editEntrepot) return;
    setSubmitting(true);
    try {
      await fetch(`${API}/entrepots/${editEntrepot.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ name: editEntrepot.name, address: editEntrepot.address, contact: editEntrepot.contact }),
      });
      setEditEntrepot(null);
      loadData();
    } catch {}
    setSubmitting(false);
  };

  const deleteEntrepot = async (id: string) => {
    if (!confirm('Supprimer cet entrepôt ?')) return;
    await fetch(`${API}/entrepots/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    loadData();
  };

  const dwellDays = (pkg: any) => {
    if (!pkg.dest_warehouse_entry) return null;
    const entry = new Date(pkg.dest_warehouse_entry);
    return Math.floor((Date.now() - entry.getTime()) / 86400000);
  };

  const filtered = packages.filter(p => {
    const matchStatus = statusFilter === 'all' || p.status === statusFilter;
    const matchSearch = !search ||
      p.tracking_number?.toLowerCase().includes(search.toLowerCase()) ||
      p.owner_id?.toLowerCase().includes(search.toLowerCase()) ||
      p.current_entrepot_name?.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const countByStatus = (s: string) => packages.filter(p => p.status === s).length;

  const originEntrepots = entrepots.filter(e => e.type === 'origin');
  const destEntrepots = entrepots.filter(e => e.type === 'destination');

  return (
    <div className="min-h-screen bg-slate-50/40">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-8 py-5 sticky top-0 z-20">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Entrepôts & Stocks</h1>
            <p className="text-slate-400 text-sm font-medium">Gestion des entrepôts et suivi des colis</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCreateEntrepot(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-700 text-xs font-black rounded-xl hover:bg-slate-200 transition-all"
            >
              <Building2 size={14} /> Nouvel Entrepôt
            </button>
          </div>
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-3">
          <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
            <button onClick={() => setView('packages')} className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${view === 'packages' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}>
              📦 Colis ({packages.length})
            </button>
            <button onClick={() => setView('entrepots')} className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${view === 'entrepots' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}>
              🏭 Entrepôts ({entrepots.length})
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-32"><Loader2 className="animate-spin text-blue-600" size={40} /></div>
      ) : view === 'packages' ? (
        // ── Packages View ──
        <div className="px-8 py-6 space-y-4">
          {/* Status KPI strip */}
          <div className="grid grid-cols-6 gap-3">
            {STATUS_TABS.slice(1).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setStatusFilter(statusFilter === key ? 'all' : key)}
                className={`p-4 rounded-2xl border-2 text-left transition-all hover:-translate-y-0.5 ${
                  statusFilter === key ? 'border-blue-400 bg-blue-50' : 'bg-white border-slate-100 hover:border-slate-200'
                }`}
              >
                <Icon size={18} className={statusFilter === key ? 'text-blue-600' : 'text-slate-400'} />
                <p className={`text-xl font-black mt-2 ${statusFilter === key ? 'text-blue-700' : 'text-slate-900'}`}>{countByStatus(key)}</p>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{label}</p>
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                placeholder="Rechercher un colis, client, entrepôt..."
                className="pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-blue-400 w-80 transition-all shadow-sm"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <p className="text-sm text-slate-400 font-bold">{filtered.length} résultats</p>
          </div>

          {/* Table */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="grid grid-cols-[1fr_1fr_1fr_1fr_1fr_1fr] px-6 py-3 bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest gap-4">
              <span>Colis</span>
              <span>Client</span>
              <span>Statut</span>
              <span>Entrepôt Actuel</span>
              <span>Jours en Stock</span>
              <span>Entrepôt Destination</span>
            </div>
            <div className="divide-y divide-slate-50">
              {filtered.length === 0 ? (
                <div className="py-20 text-center">
                  <Package size={40} className="mx-auto text-slate-200 mb-3" />
                  <p className="text-slate-400 font-bold text-sm">Aucun colis trouvé</p>
                </div>
              ) : filtered.map(pkg => {
                const statusCfg = PKG_STATUS[pkg.status] || PKG_STATUS.draft;
                const StatusIcon = statusCfg.icon;
                const dwell = dwellDays(pkg);

                return (
                  <div key={pkg.id} className="grid grid-cols-[1fr_1fr_1fr_1fr_1fr_1fr] px-6 py-4 items-center gap-4 hover:bg-slate-50/50 transition-colors">
                    <div>
                      <p className="text-sm font-black text-slate-900">{pkg.tracking_number}</p>
                      <p className="text-[10px] text-slate-400 font-bold truncate max-w-[140px]">{pkg.description}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-700 truncate">{pkg.owner_id}</p>
                    </div>
                    <div>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-black uppercase ${statusCfg.bg} ${statusCfg.text}`}>
                        <StatusIcon size={10} />
                        {statusCfg.label}
                      </span>
                    </div>
                    <div>
                      {pkg.current_entrepot_name ? (
                        <div className="flex items-center gap-1.5">
                          <Building2 size={12} className="text-slate-400 shrink-0" />
                          <span className="text-xs font-bold text-slate-700 truncate">{pkg.current_entrepot_name}</span>
                        </div>
                      ) : <span className="text-slate-300 text-xs">—</span>}
                    </div>
                    <div>
                      {dwell !== null ? (
                        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black ${dwell > 7 ? 'bg-red-50 text-red-700' : dwell > 3 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                          <Clock size={10} />
                          {dwell}j
                        </div>
                      ) : <span className="text-slate-300 text-xs">—</span>}
                    </div>
                    <div>
                      {pkg.dest_warehouse_entry ? (
                        <div>
                          <p className="text-[10px] text-slate-400 font-bold">Arrivé le</p>
                          <p className="text-xs font-black text-slate-700">
                            {new Date(pkg.dest_warehouse_entry).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                          </p>
                        </div>
                      ) : <span className="text-slate-300 text-xs">En route</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        // ── Entrepôts View ──
        <div className="px-8 py-6 space-y-8">
          {[
            { label: 'Entrepôts d\'Origine (Chine)', list: originEntrepots, type: 'origin' as const },
            { label: 'Entrepôts de Destination (Cameroun)', list: destEntrepots, type: 'destination' as const },
          ].map(({ label, list, type }) => (
            <section key={type}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-black text-slate-700">{label}</h2>
                <button
                  onClick={() => { setNewEntrepot({ ...BLANK_ENTREPOT, type, country: type === 'origin' ? 'Chine' : 'Cameroun', city: type === 'origin' ? 'Guangzhou' : 'Douala' }); setShowCreateEntrepot(true); }}
                  className="flex items-center gap-1.5 text-[10px] font-black text-blue-600 hover:underline uppercase tracking-wider"
                >
                  <Plus size={12} /> Ajouter
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {list.length === 0 ? (
                  <div className="col-span-full py-12 border-2 border-dashed border-slate-200 rounded-3xl text-center">
                    <Building2 size={32} className="mx-auto text-slate-300 mb-2" />
                    <p className="text-slate-400 font-bold text-sm">Aucun entrepôt enregistré</p>
                  </div>
                ) : list.map(e => (
                  <div key={e.id} className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 hover:border-blue-200 transition-all group">
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                        <Building2 size={22} className="text-slate-400 group-hover:text-blue-600" />
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => setEditEntrepot({ ...e })} className="p-2 rounded-xl text-slate-300 hover:text-blue-600 hover:bg-blue-50 transition-all">
                          <Edit3 size={14} />
                        </button>
                        <button onClick={() => deleteEntrepot(e.id)} className="p-2 rounded-xl text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <p className="font-black text-slate-900 text-sm mb-0.5">{e.name}</p>
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <MapPin size={12} />
                      <p className="text-xs font-bold">{e.city}, {e.country}</p>
                    </div>
                    {e.address && <p className="text-[10px] text-slate-400 mt-2 font-medium">{e.address}</p>}
                    {e.contact && <p className="text-[10px] text-blue-500 mt-1 font-bold">{e.contact}</p>}
                    <div className="mt-4 pt-4 border-t border-slate-50">
                      <p className="text-[10px] text-slate-400 font-bold uppercase">
                        {packages.filter(p => p.current_entrepot_id === e.id).length} colis actuellement
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* ── Create Entrepot Modal ── */}
      {showCreateEntrepot && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-lg shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black text-slate-900">Nouvel Entrepôt</h2>
              <button onClick={() => setShowCreateEntrepot(false)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div className="flex gap-3">
                {(['origin', 'destination'] as const).map(t => (
                  <button key={t} onClick={() => setNewEntrepot(f => ({ ...f, type: t }))}
                    className={`flex-1 py-3 rounded-2xl border-2 font-black text-sm transition-all ${newEntrepot.type === t ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-slate-100 text-slate-400 hover:border-slate-200'}`}
                  >
                    {t === 'origin' ? '🇨🇳 Origine' : '🇨🇲 Destination'}
                  </button>
                ))}
              </div>
              <WField label="Nom de l'entrepôt" value={newEntrepot.name} onChange={(v: string) => setNewEntrepot(f => ({ ...f, name: v }))} placeholder="Ex: Entrepôt MOG Guangzhou A" />
              <div className="grid grid-cols-2 gap-3">
                <WField label="Ville" value={newEntrepot.city} onChange={(v: string) => setNewEntrepot(f => ({ ...f, city: v }))} />
                <WField label="Pays" value={newEntrepot.country} onChange={(v: string) => setNewEntrepot(f => ({ ...f, country: v }))} />
              </div>
              <WField label="Adresse complète" value={newEntrepot.address} onChange={(v: string) => setNewEntrepot(f => ({ ...f, address: v }))} placeholder="Ex: 23 Guangzhou Rd..." />
              <WField label="Contact" value={newEntrepot.contact} onChange={(v: string) => setNewEntrepot(f => ({ ...f, contact: v }))} placeholder="+86 xxx xxx xxxx" />
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowCreateEntrepot(false)} className="flex-1 py-3 text-slate-400 font-bold hover:text-slate-600">Annuler</button>
                <button onClick={createEntrepot} disabled={submitting || !newEntrepot.name}
                  className="flex-[2] py-3 bg-slate-900 text-white rounded-2xl font-black text-sm hover:bg-blue-600 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                  Créer l'entrepôt
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Entrepot Modal ── */}
      {editEntrepot && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-lg shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black text-slate-900">Modifier l'entrepôt</h2>
              <button onClick={() => setEditEntrepot(null)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <WField label="Nom" value={editEntrepot.name} onChange={(v: string) => setEditEntrepot((e: any) => ({ ...e, name: v }))} />
              <WField label="Adresse" value={editEntrepot.address || ''} onChange={(v: string) => setEditEntrepot((e: any) => ({ ...e, address: v }))} />
              <WField label="Contact" value={editEntrepot.contact || ''} onChange={(v: string) => setEditEntrepot((e: any) => ({ ...e, contact: v }))} />
              <div className="flex gap-3 pt-2">
                <button onClick={() => setEditEntrepot(null)} className="flex-1 py-3 text-slate-400 font-bold hover:text-slate-600">Annuler</button>
                <button onClick={updateEntrepot} disabled={submitting}
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
    </div>
  );
}

function WField({ label, value, onChange, placeholder = '' }: any) {
  return (
    <div>
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 font-bold text-slate-800 outline-none focus:border-blue-400 text-sm transition-all" />
    </div>
  );
}
