'use client';

import { useState, useEffect } from 'react';
import { Settings, Save, Loader2, DollarSign, Clock, CheckCircle2, TrendingUp, Anchor, Plane, ShieldCheck } from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api';

export default function SettingsPage() {
  const [config, setConfig] = useState({
    exchange_rate_cny_xaf_under_1m: 100.0,
    exchange_rate_cny_xaf_over_1m: 85.0,
    storage_free_days: 7,
    storage_daily_fee: 1000.0,
    air_delay_days: 7,
    air_express_delay_days: 3,
    sea_delay_days: 45,
    support_phone: "237694581150"
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`${API_BASE_URL}/settings`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSuccess(false);
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`${API_BASE_URL}/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(config)
      });
      if (res.ok) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="animate-spin text-emerald-600" size={48} />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-10 max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-4">
            <div className="p-3 bg-slate-900 text-white rounded-2xl shadow-lg">
              <Settings size={28} />
            </div>
            Configuration Globale
          </h1>
          <p className="text-slate-500 font-medium mt-3 text-lg">
            Pilotez les paramètres financiers et logistiques de l'entreprise.
          </p>
        </div>
        
        <button 
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-3 bg-emerald-600 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-emerald-700 hover:shadow-xl hover:shadow-emerald-500/20 active:scale-95 transition-all disabled:opacity-50"
        >
          {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
          Enregistrer
        </button>
      </div>

      {success && (
        <div className="bg-emerald-50 border-2 border-emerald-500/20 text-emerald-700 p-6 rounded-3xl flex items-center gap-4 animate-in fade-in slide-in-from-top-4">
          <div className="bg-emerald-100 p-2 rounded-full">
            <CheckCircle2 size={24} className="text-emerald-600" />
          </div>
          <div>
            <h3 className="font-black text-lg">Modifications appliquées</h3>
            <p className="font-medium text-emerald-600/80">La configuration a été mise à jour avec succès dans le système.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Finance & Tarification */}
        <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden group hover:border-blue-300 transition-colors">
          <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-8 flex items-center gap-4">
            <div className="p-3 bg-white/10 rounded-2xl text-white backdrop-blur-md">
              <TrendingUp size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">Finance & Change</h2>
              <p className="text-slate-400 font-medium text-sm">Taux de change et conversions</p>
            </div>
          </div>
          <div className="p-8 space-y-6">
            <div className="space-y-4">
              <div>
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Taux de Change (&lt; 1M FCFA)</label>
                <div className="relative mt-2">
                  <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                  <input 
                    type="number" 
                    step="0.01"
                    className="w-full pl-12 pr-20 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-lg font-black text-slate-900 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all"
                    value={config.exchange_rate_cny_xaf_under_1m}
                    onChange={e => setConfig({...config, exchange_rate_cny_xaf_under_1m: parseFloat(e.target.value) || 0})}
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 bg-slate-200 text-slate-600 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider">
                    CNY/FCFA
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Taux de Change (≥ 1M FCFA)</label>
                <div className="relative mt-2">
                  <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                  <input 
                    type="number" 
                    step="0.01"
                    className="w-full pl-12 pr-20 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-lg font-black text-slate-900 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all"
                    value={config.exchange_rate_cny_xaf_over_1m}
                    onChange={e => setConfig({...config, exchange_rate_cny_xaf_over_1m: parseFloat(e.target.value) || 0})}
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 bg-slate-200 text-slate-600 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider">
                    CNY/FCFA
                  </div>
                </div>
              </div>
              <p className="text-sm font-medium text-slate-500">Ces taux s'appliqueront en fonction du montant total du paiement fournisseur.</p>
            </div>
          </div>
        </div>

        {/* Stockage & Entrepôt */}
        <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden group hover:border-emerald-300 transition-colors">
          <div className="bg-gradient-to-r from-emerald-600 to-emerald-800 p-8 flex items-center gap-4">
            <div className="p-3 bg-white/20 rounded-2xl text-white backdrop-blur-md">
              <ShieldCheck size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">Stockage & Magasinage</h2>
              <p className="text-emerald-100 font-medium text-sm">Frais de retard et délais de grâce</p>
            </div>
          </div>
          <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Franchise (Jours)</label>
              <input 
                type="number" 
                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-lg font-black text-slate-900 focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all"
                value={config.storage_free_days}
                onChange={e => setConfig({...config, storage_free_days: parseInt(e.target.value) || 0})}
              />
              <p className="text-xs font-medium text-slate-500">Jours de gratuité avant facturation.</p>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Pénalité (Jour/U)</label>
              <input 
                type="number" 
                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-lg font-black text-slate-900 focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all"
                value={config.storage_daily_fee}
                onChange={e => setConfig({...config, storage_daily_fee: parseFloat(e.target.value) || 0})}
              />
              <p className="text-xs font-medium text-slate-500">Tarif par jour de retard en FCFA.</p>
            </div>
          </div>
        </div>

        {/* Délais Logistiques */}
        <div className="lg:col-span-2 bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-slate-50 p-8 border-b border-slate-100 flex items-center gap-4">
            <div className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-700 shadow-sm">
              <Clock size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900">Temps de Transit Estimés</h2>
              <p className="text-slate-500 font-medium text-sm">Délais de livraison standards annoncés aux clients</p>
            </div>
          </div>
          
          <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-slate-50/50 p-6 rounded-3xl border border-slate-100 space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <Plane className="text-blue-500" size={24} />
                <h3 className="font-black text-slate-900">Aérien Normal</h3>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Durée (Jours)</label>
                <input 
                  type="number" 
                  className="w-full mt-2 px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:border-blue-500 transition-all shadow-sm"
                  value={config.air_delay_days}
                  onChange={e => setConfig({...config, air_delay_days: parseInt(e.target.value) || 0})}
                />
              </div>
            </div>

            <div className="bg-slate-50/50 p-6 rounded-3xl border border-slate-100 space-y-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-gradient-to-l from-orange-100 to-transparent w-32 h-full opacity-50 pointer-events-none"></div>
              <div className="flex items-center gap-3 mb-2 relative">
                <Plane className="text-orange-500" size={24} />
                <h3 className="font-black text-slate-900">Aérien Express</h3>
              </div>
              <div className="relative">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Durée (Jours)</label>
                <input 
                  type="number" 
                  className="w-full mt-2 px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:border-orange-500 transition-all shadow-sm"
                  value={config.air_express_delay_days}
                  onChange={e => setConfig({...config, air_express_delay_days: parseInt(e.target.value) || 0})}
                />
              </div>
            </div>

            <div className="bg-slate-50/50 p-6 rounded-3xl border border-slate-100 space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <Anchor className="text-teal-600" size={24} />
                <h3 className="font-black text-slate-900">Fret Maritime</h3>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Durée (Jours)</label>
                <input 
                  type="number" 
                  className="w-full mt-2 px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:border-teal-500 transition-all shadow-sm"
                  value={config.sea_delay_days}
                  onChange={e => setConfig({...config, sea_delay_days: parseInt(e.target.value) || 0})}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Support Client */}
        <div className="lg:col-span-2 bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden group hover:border-blue-300 transition-colors">
          <div className="bg-gradient-to-r from-blue-600 to-blue-800 p-8 flex items-center gap-4">
            <div className="p-3 bg-white/20 rounded-2xl text-white backdrop-blur-md">
              <ShieldCheck size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">Support Client</h2>
              <p className="text-blue-100 font-medium text-sm">Paramètres de contact pour l'application mobile</p>
            </div>
          </div>
          <div className="p-8 grid grid-cols-1 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Numéro WhatsApp du Support</label>
              <div className="relative mt-2">
                <input 
                  type="text" 
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-lg font-black text-slate-900 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all"
                  value={config.support_phone}
                  onChange={e => setConfig({...config, support_phone: e.target.value})}
                  placeholder="Ex: 237694581150"
                />
              </div>
              <p className="text-xs font-medium text-slate-500">Ce numéro sera utilisé dans toute l'application mobile pour les boutons "Contacter le support". Format international sans le '+' recommandé.</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
