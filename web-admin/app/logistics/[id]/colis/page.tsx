'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ChevronLeft, Ship, Plane, Package, Plus, Search, Loader2, X,
  Eye, CheckCircle, Clock, AlertCircle, Box, User, Calendar,
  DollarSign, CreditCard, BadgeCheck, ArrowRight, Filter,
  Download, Trash2
} from 'lucide-react';

const API = 'http://127.0.0.1:8000/api';
const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('admin_token') ?? '' : '';

const PAY_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  pending:            { label: 'Non payé',     color: 'text-slate-500',   bg: 'bg-slate-100' },
  waiting_validation: { label: 'Preuve reçue', color: 'text-blue-700',    bg: 'bg-blue-50' },
  paid:               { label: 'Payé',          color: 'text-emerald-700', bg: 'bg-emerald-50' },
  payment_rejected:   { label: 'Rejeté',        color: 'text-red-700',     bg: 'bg-red-50' },
};

const INV_STATUS: Record<string, { label: string; color: string; icon: any }> = {
  none:  { label: 'Pas de facture', color: 'text-slate-400', icon: Clock },
  draft: { label: 'Brouillon',      color: 'text-amber-600', icon: AlertCircle },
  final: { label: 'Émise',          color: 'text-emerald-600', icon: BadgeCheck },
};

export default function GroupageColisPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [groupage, setGroupage] = useState<any>(null);
  const [packages, setPackages] = useState<any[]>([]);
  const [availablePkgs, setAvailablePkgs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [showDetail, setShowDetail] = useState<any>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addSearch, setAddSearch] = useState('');
  const [adding, setAdding] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    const headers = { Authorization: `Bearer ${getToken()}` };
    try {
      const [gRes, pRes] = await Promise.all([
        fetch(`${API}/groupages/`, { headers }),
        fetch(`${API}/colis/?limit=1000&skip=0`, { headers }),
      ]);

      if (gRes.ok) {
        const groupages = await gRes.json();
        const g = groupages.find((x: any) => x.id === id);
        setGroupage(g || null);

        if (g && pRes.ok) {
          const allPkgs = await pRes.json();
          const pkgIds = g.packages_ids || [];
          // Match by packages_ids list OR by container_id field (legacy packages)
          setPackages(allPkgs.filter((p: any) =>
            pkgIds.includes(p.id) ||
            pkgIds.includes(p._id) ||
            p.container_id === id
          ));
          // Available = received/pending packages not yet in any groupage
          setAvailablePkgs(allPkgs.filter((p: any) =>
            ['received', 'pending_reception', 'draft'].includes(p.status) &&
            !p.container_id &&
            !pkgIds.includes(p.id)
          ));
        }
      }
    } catch {}
    setLoading(false);
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);

  const addPackage = async (pkgId: string) => {
    setAdding(pkgId);
    try {
      const res = await fetch(`${API}/groupages/${id}/add-package/${pkgId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) loadData();
    } catch {}
    setAdding(null);
  };

  const deleteInvoice = async (pkgId: string) => {
    if (!confirm("Supprimer la facture de ce colis ?")) return;
    try {
      const res = await fetch(`${API}/colis/${pkgId}/invoice`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) loadData();
    } catch {}
  };

  const filtered = packages.filter(p =>
    !search ||
    p.tracking_number?.toLowerCase().includes(search.toLowerCase()) ||
    p.supplier_name?.toLowerCase().includes(search.toLowerCase()) ||
    p.owner_id?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredAvailable = availablePkgs.filter(p =>
    !addSearch ||
    p.tracking_number?.toLowerCase().includes(addSearch.toLowerCase()) ||
    p.owner_id?.toLowerCase().includes(addSearch.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin text-blue-600" size={40} />
      </div>
    );
  }

  if (!groupage) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center">
        <p className="text-slate-400 font-bold">Groupage introuvable</p>
        <button onClick={() => router.back()} className="mt-4 text-blue-600 font-bold">← Retour</button>
      </div>
    );
  }

  const isAir = groupage.mode === 'air';

  return (
    <div className="min-h-screen bg-slate-50/40">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-8 py-5 sticky top-0 z-10">
        <div className="flex items-center gap-4 mb-1">
          <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 transition-colors">
            <ChevronLeft size={20} />
          </button>
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${isAir ? 'bg-sky-100' : 'bg-blue-100'}`}>
            {isAir ? <Plane size={18} className="text-sky-600" /> : <Ship size={18} className="text-blue-600" />}
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900">{groupage.container_number}</h1>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">
              {groupage.origin_port} → {groupage.destination_city} · {groupage.packages_ids?.length || 0} colis
            </p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="ml-auto flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white text-xs font-black rounded-xl hover:bg-blue-600 transition-all"
          >
            <Plus size={14} /> Ajouter un colis
          </button>
        </div>

        {/* Search */}
        <div className="flex items-center gap-3 mt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              placeholder="Rechercher dans ce groupage..."
              className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-blue-400 w-72"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <p className="text-sm text-slate-400 font-bold">{filtered.length} colis</p>
        </div>
      </div>

      {/* Table */}
      <div className="px-8 py-6">
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="grid grid-cols-[1fr_1fr_1fr_1fr_1fr_auto] px-6 py-3 bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest gap-4">
            <span>Colis / Suivi</span>
            <span>Client / Fournisseur</span>
            <span>Réception</span>
            <span>Valeur</span>
            <span>Facturation</span>
            <span className="text-right pr-2">Détail</span>
          </div>

          <div className="divide-y divide-slate-50">
            {filtered.length === 0 ? (
              <div className="py-20 text-center">
                <Package size={40} className="mx-auto text-slate-200 mb-3" />
                <p className="text-slate-400 font-bold text-sm">Aucun colis dans ce groupage</p>
                <button onClick={() => setShowAdd(true)} className="mt-3 text-blue-600 font-black text-sm hover:underline">
                  + Ajouter le premier colis
                </button>
              </div>
            ) : filtered.map(pkg => {
              const payS = PAY_STATUS[pkg.payment_status] || PAY_STATUS.pending;
              const invS = INV_STATUS[pkg.invoice_status || 'none'];
              const InvIcon = invS.icon;

              return (
                <div key={pkg.id} className="grid grid-cols-[1fr_1fr_1fr_1fr_1fr_auto] px-6 py-4 items-center gap-4 hover:bg-slate-50/50 transition-colors group">
                  {/* Colis */}
                  <div>
                    <p className="text-sm font-black text-slate-900">{pkg.tracking_number}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase truncate max-w-[160px]">{pkg.description}</p>
                  </div>

                  {/* Client / Fournisseur */}
                  <div>
                    <p className="text-xs font-bold text-slate-700 truncate">{pkg.owner_id}</p>
                    {pkg.supplier_name && <p className="text-[10px] text-slate-400 font-bold truncate">{pkg.supplier_name}</p>}
                  </div>

                  {/* Date de réception + opérateur */}
                  <div>
                    {pkg.updated_at ? (
                      <>
                        <p className="text-xs font-bold text-slate-700">
                          {new Date(pkg.updated_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' })}
                        </p>
                        {pkg.received_by && <p className="text-[10px] text-slate-400 font-bold">Par {pkg.received_by}</p>}
                      </>
                    ) : <span className="text-slate-300 text-xs">—</span>}
                  </div>

                  {/* Valeur */}
                  <div>
                    <p className="text-sm font-black text-slate-900">
                      {pkg.declared_value?.toLocaleString('fr-FR') || '—'} {pkg.currency}
                    </p>
                    {pkg.weight_real > 0 && (
                      <p className="text-[10px] text-slate-400 font-bold">{pkg.weight_real} kg</p>
                    )}
                  </div>

                  {/* Facturation */}
                  <div className="space-y-1">
                    {pkg.invoice_status && pkg.invoice_status !== 'none' ? (
                      <span className={`inline-flex items-center gap-1 text-[10px] font-black ${invS.color}`}>
                        <InvIcon size={10} /> {invS.label}
                      </span>
                    ) : groupage?.invoice_status && groupage.invoice_status !== 'none' ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-black text-blue-600">
                        <BadgeCheck size={10} /> {groupage.invoice_status === 'final' ? 'Facturé (Groupage)' : 'Brouillon (Groupage)'}
                      </span>
                    ) : (
                      <span className={`inline-flex items-center gap-1 text-[10px] font-black ${invS.color}`}>
                        <InvIcon size={10} /> {invS.label}
                      </span>
                    )}
                    <div>
                      <span className={`inline-flex px-2 py-0.5 rounded-lg text-[9px] font-black uppercase ${payS.bg} ${payS.color}`}>
                        {payS.label}
                      </span>
                    </div>
                  </div>

                  {/* Détail */}
                    <div className="flex justify-end gap-1">
                      {pkg.invoice_status === 'final' && (
                        <button
                          onClick={() => window.open(`${API}/colis/${pkg.id}/invoice?token=${getToken()}`, '_blank')}
                          className="p-2 rounded-xl text-slate-300 hover:text-blue-600 hover:bg-blue-50 transition-all"
                          title="Télécharger la facture"
                        >
                          <Download size={18} />
                        </button>
                      )}
                      <button
                        onClick={() => setShowDetail(pkg)}
                        className="p-2 rounded-xl text-slate-300 hover:text-blue-600 hover:bg-blue-50 transition-all"
                        title="Voir le détail"
                      >
                        <Eye size={18} />
                      </button>
                      {pkg.invoice_status && pkg.invoice_status !== 'none' && (
                        <button
                          onClick={() => deleteInvoice(pkg.id)}
                          className="p-2 rounded-xl text-slate-300 hover:text-red-600 hover:bg-red-50 transition-all"
                          title="Supprimer la facture"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Package Detail Modal ── */}
      {showDetail && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-[2.5rem] w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            {/* Header */}
            <div className={`p-6 ${isAir ? 'bg-sky-600' : 'bg-blue-700'} text-white relative overflow-hidden`}>
              <div className="absolute right-0 top-0 opacity-10">
                <Package size={120} className="-mr-6 -mt-6" />
              </div>
              <div className="flex items-start justify-between relative z-10">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/50 mb-1">Détail du colis</p>
                  <h3 className="text-2xl font-black">{showDetail.tracking_number}</h3>
                  <p className="text-white/70 text-sm font-bold mt-0.5">{showDetail.description}</p>
                </div>
                <button onClick={() => setShowDetail(null)} className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors">
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              {/* Info grid */}
              <div className="grid grid-cols-2 gap-3">
                <InfoBox label="Client" value={showDetail.owner_id} icon={User} />
                <InfoBox label="Fournisseur" value={showDetail.supplier_name || '—'} icon={Package} />
                <InfoBox label="Poids réel" value={`${showDetail.weight_real || 0} kg`} icon={Box} />
                <InfoBox label="Dimensions" value={showDetail.dimensions ? `${showDetail.dimensions.l}×${showDetail.dimensions.w}×${showDetail.dimensions.h}` : '—'} icon={Box} />
                <InfoBox label="Valeur déclarée" value={`${showDetail.declared_value?.toLocaleString() || 0} ${showDetail.currency}`} icon={DollarSign} />
                <InfoBox label="Assurance" value={showDetail.insurance_enabled ? 'Oui' : 'Non'} icon={CheckCircle} />
              </div>

              {/* Status section */}
              <div className="bg-slate-50 rounded-2xl p-4 space-y-3">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Statut Financier</p>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-700">Facture</span>
                  <span className={`text-xs font-black ${INV_STATUS[showDetail.invoice_status || 'none'].color}`}>
                    {INV_STATUS[showDetail.invoice_status || 'none'].label}
                  </span>
                </div>
                {showDetail.total_price > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-700">Montant TTC</span>
                    <span className="text-sm font-black text-slate-900">
                      {(showDetail.total_price * (showDetail.include_vat ? 1.1925 : 1)).toLocaleString('fr-FR')} FCFA
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-700">Paiement</span>
                  <span className={`text-xs font-black px-2 py-1 rounded-lg ${PAY_STATUS[showDetail.payment_status || 'pending'].bg} ${PAY_STATUS[showDetail.payment_status || 'pending'].color}`}>
                    {PAY_STATUS[showDetail.payment_status || 'pending'].label}
                  </span>
                </div>
              </div>

              {/* Warehouse */}
              {showDetail.current_entrepot_name && (
                <div className="bg-blue-50 rounded-2xl p-4">
                  <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1">Entrepôt actuel</p>
                  <p className="font-black text-slate-900">{showDetail.current_entrepot_name}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Add Package — Premium Slide Panel ── */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-slate-950/50 backdrop-blur-sm" onClick={() => setShowAdd(false)} />
          <div className="w-full max-w-md bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-6 text-white">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center">
                    <Plus size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black">Ajouter des colis</h3>
                    <p className="text-[10px] text-white/50 font-bold uppercase tracking-widest">au groupage {groupage.container_number}</p>
                  </div>
                </div>
                <button onClick={() => setShowAdd(false)} className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors">
                  <X size={18} />
                </button>
              </div>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" size={16} />
                <input
                  placeholder="Numéro de suivi, client..."
                  className="w-full pl-11 pr-4 py-3 bg-white/10 border border-white/10 rounded-2xl text-white placeholder-white/30 font-bold text-sm outline-none focus:bg-white/15 focus:border-white/30 transition-all"
                  value={addSearch}
                  onChange={e => setAddSearch(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            <div className="px-6 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                {filteredAvailable.length} colis disponibles
              </p>
              {filteredAvailable.length > 0 && (
                <p className="text-[10px] text-blue-600 font-bold">Cliquez sur un colis pour l'ajouter</p>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {filteredAvailable.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="w-16 h-16 bg-slate-100 rounded-3xl flex items-center justify-center mb-4">
                    <Package size={28} className="text-slate-300" />
                  </div>
                  <p className="font-black text-slate-400 text-sm">Aucun colis disponible</p>
                  <p className="text-[11px] text-slate-300 font-medium mt-1 leading-relaxed">
                    Les colis doivent être réceptionnés<br />et ne pas être dans un autre groupage
                  </p>
                </div>
              ) : filteredAvailable.map(pkg => {
                const isAdding = adding === pkg.id;
                return (
                  <div
                    key={pkg.id}
                    className={`group relative p-4 rounded-2xl border-2 transition-all cursor-pointer ${isAdding ? 'border-blue-400 bg-blue-50' : 'border-slate-100 bg-white hover:border-blue-300 hover:bg-blue-50/30 hover:shadow-md'}`}
                    onClick={() => !isAdding && addPackage(pkg.id)}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-all ${isAdding ? 'bg-blue-600' : 'bg-slate-100 group-hover:bg-blue-100'}`}>
                        {isAdding ? <Loader2 size={20} className="animate-spin text-white" /> : <Package size={20} className="text-slate-400 group-hover:text-blue-600" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-slate-900 text-sm">{pkg.tracking_number}</p>
                        <p className="text-[10px] text-slate-400 font-bold truncate">{pkg.description}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-[9px] bg-slate-100 text-slate-500 font-black px-2 py-0.5 rounded-full uppercase">{pkg.owner_id?.split('@')[0]}</span>
                          {pkg.weight_real > 0 && <span className="text-[9px] text-slate-400 font-bold">{pkg.weight_real} kg</span>}
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${pkg.status === 'received' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{pkg.status}</span>
                        </div>
                      </div>
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all shrink-0 ${isAdding ? 'bg-blue-200 text-blue-600' : 'bg-slate-50 text-slate-300 group-hover:bg-blue-600 group-hover:text-white'}`}>
                        <Plus size={16} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoBox({ label, value, icon: Icon }: { label: string; value: string; icon: any }) {
  return (
    <div className="bg-slate-50 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon size={12} className="text-slate-400" />
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{label}</p>
      </div>
      <p className="text-sm font-black text-slate-900 truncate">{value || '—'}</p>
    </div>
  );
}
