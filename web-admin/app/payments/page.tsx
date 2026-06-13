'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  CreditCard, Plus, FileText, CheckCircle2, Clock, 
  Loader2, XCircle, ChevronRight, User, Package,
  Download, BadgeCheck, AlertCircle, CircleDot,
  Pencil, Trash2
} from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api';

function getToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('admin_token') ?? '' : '';
}

const STATUS_MAP: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  draft:   { label: 'Brouillon',    color: 'text-amber-700', bg: 'bg-amber-50',  dot: 'bg-amber-400' },
  final:   { label: 'Confirmée',    color: 'text-emerald-700', bg: 'bg-emerald-50', dot: 'bg-emerald-500' },
};

const PAY_MAP: Record<string, { label: string; color: string; bg: string }> = {
  pending:            { label: 'Non payé',      color: 'text-slate-500',   bg: 'bg-slate-100' },
  waiting_validation: { label: 'Preuve reçue',  color: 'text-blue-700',    bg: 'bg-blue-50' },
  paid:               { label: 'Payé',           color: 'text-emerald-700', bg: 'bg-emerald-50' },
  payment_rejected:   { label: 'Rejeté',         color: 'text-red-700',     bg: 'bg-red-50' },
};

export default function PaymentsPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'draft' | 'final' | 'paid'>('all');
  const [finalizing, setFinalizing] = useState<string | null>(null);

  const fetch_data = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/invoices/`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        const data = await res.json();
        setInvoices(data);
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetch_data(); }, []);

  const finalize = async (id: string) => {
    setFinalizing(id);
    try {
      await fetch(`${API}/invoices/${id}/finalize`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      fetch_data();
    } catch {} finally {
      setFinalizing(null);
    }
  };

  const deleteInvoice = async (id: string) => {
    if (!confirm("Supprimer cette facture ?")) return;
    try {
      const res = await fetch(`${API}/invoices/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) fetch_data();
    } catch {}
  };

  const filtered = invoices.filter(inv => {
    if (filter === 'all') return true;
    if (filter === 'draft') return inv.status === 'draft';
    if (filter === 'final') return inv.status === 'final';
    if (filter === 'paid') return inv.payment_status === 'paid';
    return true;
  });

  // Stats
  const drafts = invoices.filter(inv => inv.status === 'draft').length;
  const confirmed = invoices.filter(inv => inv.status === 'final').length;
  const waitingPayment = invoices.filter(inv => inv.status === 'final' && inv.payment_status !== 'paid').length;
  const totalRevenue = invoices
    .filter(inv => inv.payment_status === 'paid')
    .reduce((sum, inv) => sum + (inv.total_price * (inv.include_vat ? 1.1925 : 1)), 0);

  const FILTERS = [
    { key: 'all',   label: 'Toutes' },
    { key: 'draft', label: `Brouillons (${drafts})` },
    { key: 'final', label: `Confirmées (${confirmed})` },
    { key: 'paid',  label: 'Payées' },
  ];

  return (
    <div className="min-h-screen bg-slate-50/50">
      {/* Page Header */}
      <div className="bg-white border-b border-slate-100 px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Factures & Paiements</h1>
            <p className="text-slate-400 text-sm font-medium mt-0.5">Gestion des factures clients</p>
          </div>
          <button
            onClick={() => router.push('/payments/create')}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-black rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 hover:-translate-y-0.5 active:translate-y-0"
          >
            <Plus size={16} />
            Nouvelle facture
          </button>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-4 gap-4 mt-6">
          {[
            { label: 'Brouillons', value: drafts, color: 'text-amber-600', icon: Clock },
            { label: 'Confirmées', value: confirmed, color: 'text-blue-600', icon: BadgeCheck },
            { label: 'En attente paiement', value: waitingPayment, color: 'text-orange-600', icon: AlertCircle },
            { label: 'Revenu Total', value: `${totalRevenue.toLocaleString('fr-FR')} FCFA`, color: 'text-emerald-600', icon: CreditCard },
          ].map(({ label, value, color, icon: Icon }) => (
            <div key={label} className="bg-slate-50 rounded-2xl p-4 flex items-center gap-3 border border-slate-100">
              <div className={`w-9 h-9 rounded-xl bg-white flex items-center justify-center shadow-sm ${color}`}>
                <Icon size={16} />
              </div>
              <div>
                <p className={`text-lg font-black ${color}`}>{value}</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 mt-5 p-1 bg-slate-100 rounded-xl w-fit">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key as any)}
              className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${
                filter === f.key 
                  ? 'bg-white text-slate-900 shadow-sm' 
                  : 'text-slate-400 hover:text-slate-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Invoice list — Odoo-style table */}
      <div className="px-8 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-32">
            <Loader2 className="animate-spin text-blue-600" size={40} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center shadow-sm mb-4 border border-slate-100">
              <FileText size={36} className="text-slate-200" />
            </div>
            <p className="text-slate-400 font-bold">Aucune facture dans cette catégorie</p>
            <button onClick={() => router.push('/payments/create')} className="mt-4 text-blue-600 font-black text-sm hover:underline">
              Créer la première facture →
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            {/* Column headers */}
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] px-6 py-3 bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <span>Facture / Client</span>
              <span>Montant HT</span>
              <span>TVA</span>
              <span>Total TTC</span>
              <span>Statuts</span>
              <span></span>
            </div>

            <div className="divide-y divide-slate-50">
              {filtered.map((inv) => {
                const ht = inv.total_price || 0;
                const vat = inv.include_vat ? ht * 0.1925 : 0;
                const ttc = ht + vat;
                const invStatus = STATUS_MAP[inv.status || 'draft'];
                const payStatus = PAY_MAP[inv.payment_status || 'pending'];

                return (
                  <div key={inv.id} className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] px-6 py-5 items-center hover:bg-slate-50/50 transition-colors group">
                    {/* Invoice info */}
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-sm bg-blue-100">
                        <FileText size={18} className="text-blue-600" />
                      </div>
                      <div>
                        <p className="font-black text-slate-900 text-sm">{inv.invoice_number}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                          {inv.customer_name || inv.customer_id} · {inv.packages?.length || 0} colis
                        </p>
                      </div>
                    </div>

                    {/* HT */}
                    <div>
                      <p className="text-sm font-bold text-slate-700">{ht.toLocaleString('fr-FR')} FCFA</p>
                    </div>

                    {/* TVA */}
                    <div>
                      {inv.include_vat ? (
                        <p className="text-sm font-bold text-blue-600">+{vat.toLocaleString('fr-FR')} FCFA</p>
                      ) : (
                        <p className="text-xs text-slate-300 font-bold">—</p>
                      )}
                    </div>

                    {/* TTC */}
                    <div>
                      <p className="text-sm font-black text-slate-900">{ttc.toLocaleString('fr-FR')} FCFA</p>
                    </div>

                    {/* Status badges */}
                    <div className="flex flex-col gap-1.5">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider ${invStatus?.bg} ${invStatus?.color} w-fit`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${invStatus?.dot}`} />
                        {invStatus?.label}
                      </span>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider ${payStatus?.bg} ${payStatus?.color} w-fit`}>
                        {payStatus?.label}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {inv.status === 'draft' && (
                        <button
                          onClick={() => finalize(inv.id)}
                          disabled={finalizing === inv.id}
                          className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-[10px] font-black rounded-lg hover:bg-emerald-700 transition-all disabled:opacity-50"
                        >
                          {finalizing === inv.id ? <Loader2 size={12} className="animate-spin" /> : <BadgeCheck size={12} />}
                          Confirmer
                        </button>
                      )}
                      
                      {inv.status === 'final' && (
                        <button
                          onClick={() => window.open(`${API}/invoices/${inv.id}/pdf?token=${getToken()}`, '_blank')}
                          className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 text-white text-[10px] font-black rounded-lg hover:bg-blue-600 transition-all"
                        >
                          <Download size={12} />
                          PDF
                        </button>
                      )}

                      {inv.status === 'draft' && (
                        <button
                          onClick={() => router.push(`/payments/create?edit=${inv.id}`)}
                          className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
                          title="Modifier"
                        >
                          <Pencil size={14} />
                        </button>
                      )}
                      
                      <button
                        onClick={() => deleteInvoice(inv.id)}
                        className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all"
                        title="Supprimer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
