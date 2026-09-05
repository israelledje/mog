'use client';

import { useState, useEffect } from 'react';
import { 
  FileText, 
  Download, 
  Loader2, 
  TrendingUp, 
  Package, 
  DollarSign, 
  Calendar, 
  CheckCircle2,
  FileSpreadsheet,
  AlertCircle
} from 'lucide-react';
import { API_BASE_URL } from '@/lib/api';

export default function ReportsPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`${API_BASE_URL}/admin/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      } else {
        setError("Impossible de charger les statistiques.");
      }
    } catch (err) {
      console.error(err);
      setError("Erreur réseau lors de la récupération des données.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadExcel = async () => {
    setDownloading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`${API_BASE_URL}/admin/export/packages`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Rapport_Colis_${new Date().toISOString().slice(0, 10)}.xlsx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      } else {
        alert("Erreur lors de la génération de l'export Excel.");
      }
    } catch (err) {
      console.error(err);
      alert("Erreur de connexion lors du téléchargement.");
    } finally {
      setDownloading(false);
    }
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('fr-FR').format(num || 0);
  };

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="animate-spin text-blue-600" size={48} />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-indigo-600 to-blue-700 text-white rounded-2xl shadow-lg shadow-indigo-500/20">
              <FileText size={28} />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-indigo-600">Analytique & Exports</span>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">
                Rapports d'Activité
              </h1>
            </div>
          </div>
          <p className="text-slate-500 font-medium mt-2 text-sm md:text-base">
            Consultez les synthèses logistiques et téléchargez les rapports complets au format Excel.
          </p>
        </div>
        
        <button 
          onClick={handleDownloadExcel}
          disabled={downloading}
          className="flex items-center justify-center gap-2.5 bg-emerald-600 text-white px-7 py-3.5 rounded-xl font-bold hover:bg-emerald-700 hover:shadow-lg hover:shadow-emerald-500/20 active:scale-95 transition-all disabled:opacity-50"
        >
          {downloading ? <Loader2 className="animate-spin" size={18} /> : <FileSpreadsheet size={18} />}
          Exporter les Colis (.xlsx)
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border-2 border-red-500/20 text-red-800 p-5 rounded-2xl flex items-center gap-3">
          <AlertCircle size={20} className="text-red-600 shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {/* ── KPI Summary Cards ── */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Colis</span>
              <div className="rounded-xl bg-blue-50 p-2 text-blue-600">
                <Package size={20} />
              </div>
            </div>
            <div className="mt-4 text-3xl font-black text-slate-900">
              {formatNumber(stats.total_packages)}
            </div>
            <p className="mt-1 text-xs font-medium text-slate-500">
              {formatNumber(stats.packages_received)} réceptionnés en entrepôt
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Chiffre d'Affaires</span>
              <div className="rounded-xl bg-emerald-50 p-2 text-emerald-600">
                <DollarSign size={20} />
              </div>
            </div>
            <div className="mt-4 text-3xl font-black text-emerald-600">
              {formatNumber(stats.total_revenue)} <span className="text-sm font-bold text-slate-400">FCFA</span>
            </div>
            <p className="mt-1 text-xs font-medium text-slate-500">
              Factures réglées
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Volume Global</span>
              <div className="rounded-xl bg-indigo-50 p-2 text-indigo-600">
                <TrendingUp size={20} />
              </div>
            </div>
            <div className="mt-4 text-3xl font-black text-slate-900">
              {stats.total_volume_cbm} <span className="text-sm font-bold text-slate-400">CBM</span>
            </div>
            <p className="mt-1 text-xs font-medium text-slate-500">
              Maritime & Aérien cumulés
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Cette Semaine</span>
              <div className="rounded-xl bg-purple-50 p-2 text-purple-600">
                <Calendar size={20} />
              </div>
            </div>
            <div className="mt-4 text-3xl font-black text-slate-900">
              {formatNumber(stats.packages_this_week)}
            </div>
            <p className="mt-1 text-xs font-medium text-purple-600 font-bold">
              {stats.packages_week_change_pct !== null ? `${stats.packages_week_change_pct > 0 ? '+' : ''}${stats.packages_week_change_pct}% vs sem. passée` : 'Nouvelle activité'}
            </p>
          </div>
        </div>
      )}

      {/* ── Export Section ── */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm space-y-6">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <FileSpreadsheet className="text-emerald-600" size={24} />
          <div>
            <h2 className="text-lg font-black text-slate-900">Exports de Données</h2>
            <p className="text-xs text-slate-500">Téléchargement instantané des données de production</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 flex items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-slate-900">Rapport complet des Colis</h3>
              <p className="text-xs text-slate-500 mt-1">
                Fichier Excel (.xlsx) comprenant le tracking, expéditeur, destinataire, statut, poids, et dates.
              </p>
            </div>
            <button
              onClick={handleDownloadExcel}
              disabled={downloading}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-sm shrink-0 disabled:opacity-50"
            >
              {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              Télécharger
            </button>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 flex items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-slate-900">Rapport Sauvegardes BD</h3>
              <p className="text-xs text-slate-500 mt-1">
                Accédez aux sauvegardes compressées MongoDB (mongodump) depuis l'onglet Configuration.
              </p>
            </div>
            <a
              href="/settings"
              className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline shrink-0"
            >
              Voir Sauvegardes →
            </a>
          </div>
        </div>
      </div>

    </div>
  );
}
