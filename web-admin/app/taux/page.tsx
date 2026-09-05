'use client';

import { useState, useEffect } from 'react';
import { 
  ArrowLeftRight, 
  Save, 
  Loader2, 
  CheckCircle2, 
  TrendingUp, 
  Calculator, 
  Coins, 
  Info,
  Clock,
  User,
  Sparkles,
  ShieldAlert
} from 'lucide-react';
import { API_BASE_URL } from '@/lib/api';

export default function TauxChangePage() {
  const [under1m, setUnder1m] = useState<number>(100.0);
  const [over1m, setOver1m] = useState<number>(85.0);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [updatedBy, setUpdatedBy] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live Simulator state
  const [simCny, setSimCny] = useState<string>('1000');
  const [simFcfa, setSimFcfa] = useState<string>('');
  const [simMode, setSimMode] = useState<'cny_to_fcfa' | 'fcfa_to_cny'>('cny_to_fcfa');

  useEffect(() => {
    fetchRates();
  }, []);

  const fetchRates = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`${API_BASE_URL}/settings`, {
        headers: { 
          'Authorization': `Bearer ${token}` 
        }
      });
      if (res.ok) {
        const data = await res.json();
        setUnder1m(data.exchange_rate_cny_xaf_under_1m ?? 100.0);
        setOver1m(data.exchange_rate_cny_xaf_over_1m ?? 85.0);
        setUpdatedAt(data.cny_rate_updated_at ?? null);
        setUpdatedBy(data.cny_rate_updated_by ?? null);
      } else {
        setError("Impossible de charger les paramètres de taux.");
      }
    } catch (err) {
      console.error(err);
      setError("Erreur réseau lors du chargement des taux.");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (under1m <= 0 || over1m <= 0) {
      setError("Les taux doivent être des nombres strictement positifs.");
      return;
    }

    setSaving(true);
    setSuccess(false);
    setError(null);

    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`${API_BASE_URL}/settings/exchange-rates`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          exchange_rate_cny_xaf_under_1m: Number(under1m),
          exchange_rate_cny_xaf_over_1m: Number(over1m),
        })
      });

      if (res.ok) {
        const data = await res.json();
        setUnder1m(data.exchange_rate_cny_xaf_under_1m);
        setOver1m(data.exchange_rate_cny_xaf_over_1m);
        setUpdatedAt(data.cny_rate_updated_at);
        setUpdatedBy(data.cny_rate_updated_by);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 4000);
      } else {
        const errData = await res.json().catch(() => ({}));
        setError(errData.detail || "Erreur lors de l'enregistrement des taux.");
      }
    } catch (err) {
      console.error(err);
      setError("Erreur de connexion au serveur.");
    } finally {
      setSaving(false);
    }
  };

  // Calculations for Simulator
  const cnyVal = parseFloat(simCny) || 0;
  const fcfaVal = parseFloat(simFcfa) || 0;

  let simResultUnder1m = 0;
  let simResultOver1m = 0;

  if (simMode === 'cny_to_fcfa') {
    simResultUnder1m = cnyVal * under1m;
    simResultOver1m = cnyVal * over1m;
  } else {
    simResultUnder1m = under1m > 0 ? fcfaVal / under1m : 0;
    simResultOver1m = over1m > 0 ? fcfaVal / over1m : 0;
  }

  const formatNumber = (num: number, maximumFractionDigits = 2) => {
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits }).format(num);
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return 'Non renseigné';
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return iso;
    }
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
            <div className="p-3 bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-2xl shadow-lg shadow-blue-500/20">
              <ArrowLeftRight size={28} />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-blue-600">Finance & Trésorerie</span>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">
                Taux de Change CNY (Yuan) ⇄ FCFA
              </h1>
            </div>
          </div>
          <p className="text-slate-500 font-medium mt-2 text-sm md:text-base">
            Configurez les cours officiels appliqués aux achats en Chine, conversions de factures et paiements fournisseurs.
          </p>
        </div>
        
        <button 
          onClick={() => handleSave()}
          disabled={saving}
          className="flex items-center justify-center gap-2.5 bg-blue-600 text-white px-7 py-3.5 rounded-xl font-bold hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-500/20 active:scale-95 transition-all disabled:opacity-50"
        >
          {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
          Enregistrer les taux
        </button>
      </div>

      {/* ── Alerts ── */}
      {success && (
        <div className="bg-emerald-50 border-2 border-emerald-500/20 text-emerald-800 p-5 rounded-2xl flex items-center gap-4 animate-in fade-in slide-in-from-top-3">
          <div className="bg-emerald-100 p-2 rounded-full text-emerald-600">
            <CheckCircle2 size={22} />
          </div>
          <div>
            <h3 className="font-bold text-base">Nouveaux taux enregistrés avec succès !</h3>
            <p className="text-sm text-emerald-700/80">Les applications mobiles et le backend utilisent désormais ces taux en temps réel.</p>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border-2 border-red-500/20 text-red-800 p-5 rounded-2xl flex items-center gap-4 animate-in fade-in slide-in-from-top-3">
          <div className="bg-red-100 p-2 rounded-full text-red-600">
            <ShieldAlert size={22} />
          </div>
          <div>
            <h3 className="font-bold text-base">Erreur</h3>
            <p className="text-sm text-red-700/80">{error}</p>
          </div>
        </div>
      )}

      {/* ── Active Rates Summary Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Tier 1 : Standard (< 1M FCFA) */}
        <div className="relative overflow-hidden rounded-3xl border border-blue-100 bg-gradient-to-br from-white to-blue-50/40 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white font-black text-sm shadow-md shadow-blue-500/20">
                ¥1
              </div>
              <div>
                <span className="inline-block rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-bold text-blue-700">
                  Palier Standard
                </span>
                <h3 className="font-black text-slate-800 text-base">Moins de 1 000 000 FCFA</h3>
              </div>
            </div>
            <TrendingUp size={22} className="text-blue-500" />
          </div>

          <div className="mt-5 flex items-baseline gap-2">
            <span className="text-4xl font-black tracking-tight text-blue-900">
              {formatNumber(under1m)}
            </span>
            <span className="text-base font-bold text-slate-500">FCFA / Yuan</span>
          </div>

          <div className="mt-4 rounded-xl bg-blue-50/80 p-3 text-xs text-blue-800 font-medium">
            💡 Applicable automatiquement à tous les petits et moyens achats fournisseurs.
          </div>
        </div>

        {/* Tier 2 : Gros Volume (≥ 1M FCFA) */}
        <div className="relative overflow-hidden rounded-3xl border border-emerald-100 bg-gradient-to-br from-white to-emerald-50/40 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white font-black text-sm shadow-md shadow-emerald-500/20">
                ¥1
              </div>
              <div>
                <span className="inline-block rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                  Palier Gros Volume
                </span>
                <h3 className="font-black text-slate-800 text-base">À partir de 1 000 000 FCFA</h3>
              </div>
            </div>
            <Sparkles size={22} className="text-emerald-500" />
          </div>

          <div className="mt-5 flex items-baseline gap-2">
            <span className="text-4xl font-black tracking-tight text-emerald-900">
              {formatNumber(over1m)}
            </span>
            <span className="text-base font-bold text-slate-500">FCFA / Yuan</span>
          </div>

          <div className="mt-4 rounded-xl bg-emerald-50/80 p-3 text-xs text-emerald-800 font-medium">
            ✨ Taux préférentiel dégressif accordé aux gros importateurs et commerçants.
          </div>
        </div>

      </div>

      {/* ── Configuration Form & Live Simulator ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left: Configuration Form (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 shadow-sm p-6 md:p-8 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <Coins className="text-blue-600" size={22} />
              <h2 className="text-lg font-black text-slate-900">Éditer les taux de change</h2>
            </div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">M.O.G Rules</span>
          </div>

          <form onSubmit={handleSave} className="space-y-6">
            
            {/* Input 1 */}
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-600 uppercase tracking-wider flex items-center justify-between">
                <span>Taux de change (&lt; 1 000 000 FCFA)</span>
                <span className="text-[11px] text-blue-600 lowercase font-medium">1 CNY = X FCFA</span>
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                  FCFA
                </div>
                <input 
                  type="number" 
                  step="0.01"
                  min="1"
                  required
                  value={under1m}
                  onChange={(e) => setUnder1m(parseFloat(e.target.value) || 0)}
                  className="w-full pl-16 pr-24 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-lg font-black text-slate-900 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all"
                  placeholder="100.00"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 bg-slate-200 text-slate-700 px-2.5 py-1 rounded-lg text-xs font-black">
                  CNY/XAF
                </div>
              </div>
              <p className="text-xs text-slate-500">
                Utilisé pour tous les montants inférieurs au seuil de 1 000 000 FCFA.
              </p>
            </div>

            {/* Input 2 */}
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-600 uppercase tracking-wider flex items-center justify-between">
                <span>Taux de change (≥ 1 000 000 FCFA)</span>
                <span className="text-[11px] text-emerald-600 lowercase font-medium">1 CNY = X FCFA</span>
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                  FCFA
                </div>
                <input 
                  type="number" 
                  step="0.01"
                  min="1"
                  required
                  value={over1m}
                  onChange={(e) => setOver1m(parseFloat(e.target.value) || 0)}
                  className="w-full pl-16 pr-24 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-lg font-black text-slate-900 focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all"
                  placeholder="85.00"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-lg text-xs font-black">
                  CNY/XAF
                </div>
              </div>
              <p className="text-xs text-slate-500">
                Taux préférentiel appliqué dès que le montant atteint ou dépasse 1 000 000 FCFA.
              </p>
            </div>

            {/* Audit info */}
            <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <Clock size={15} className="text-slate-400" />
                <span>Dernière modification : <strong className="text-slate-700">{formatDate(updatedAt)}</strong></span>
              </div>
              {updatedBy && (
                <div className="flex items-center gap-1.5">
                  <User size={15} className="text-slate-400" />
                  <span>Modifié par : <strong className="text-slate-700">{updatedBy}</strong></span>
                </div>
              )}
            </div>

            <button 
              type="submit"
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white py-4 rounded-2xl font-bold hover:bg-slate-800 active:scale-[0.99] transition-all disabled:opacity-50 shadow-md"
            >
              {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
              Appliquer les nouveaux taux
            </button>

          </form>
        </div>

        {/* Right: Live Conversion Simulator (5 cols) */}
        <div className="lg:col-span-5 bg-gradient-to-br from-slate-900 to-indigo-950 rounded-3xl text-white p-6 md:p-8 shadow-xl flex flex-col justify-between space-y-6">
          
          <div>
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2.5">
                <Calculator className="text-blue-400" size={22} />
                <h3 className="font-black text-lg">Simulateur en direct</h3>
              </div>
              <span className="rounded-full bg-blue-500/20 px-2.5 py-0.5 text-[11px] font-bold text-blue-300">
                Test en temps réel
              </span>
            </div>

            {/* Simulator Mode Switch */}
            <div className="mt-5 grid grid-cols-2 gap-1 rounded-xl bg-white/10 p-1">
              <button
                type="button"
                onClick={() => setSimMode('cny_to_fcfa')}
                className={`py-2 text-xs font-bold rounded-lg transition-all ${
                  simMode === 'cny_to_fcfa' 
                    ? 'bg-blue-600 text-white shadow-md' 
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Yuan (CNY) → FCFA
              </button>
              <button
                type="button"
                onClick={() => setSimMode('fcfa_to_cny')}
                className={`py-2 text-xs font-bold rounded-lg transition-all ${
                  simMode === 'fcfa_to_cny' 
                    ? 'bg-blue-600 text-white shadow-md' 
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                FCFA → Yuan (CNY)
              </button>
            </div>

            {/* Simulator Amount Input */}
            <div className="mt-5 space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                {simMode === 'cny_to_fcfa' ? 'Montant en Yuan (CNY ¥)' : 'Montant en FCFA'}
              </label>
              <div className="relative">
                <input 
                  type="number"
                  min="0"
                  step="any"
                  value={simMode === 'cny_to_fcfa' ? simCny : simFcfa}
                  onChange={(e) => {
                    if (simMode === 'cny_to_fcfa') {
                      setSimCny(e.target.value);
                    } else {
                      setSimFcfa(e.target.value);
                    }
                  }}
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3.5 text-xl font-black text-white focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all placeholder:text-slate-500"
                  placeholder={simMode === 'cny_to_fcfa' ? '1000' : '100000'}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                  {simMode === 'cny_to_fcfa' ? 'CNY ¥' : 'FCFA'}
                </span>
              </div>
            </div>

            {/* Simulator Results */}
            <div className="mt-6 space-y-3">
              <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Résultat Standard (&lt; 1M FCFA)</span>
                  <span className="font-bold text-blue-400">Taux : {under1m}</span>
                </div>
                <div className="text-2xl font-black text-white tracking-tight">
                  {formatNumber(simResultUnder1m)} {simMode === 'cny_to_fcfa' ? 'FCFA' : 'CNY'}
                </div>
              </div>

              <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-4 space-y-1">
                <div className="flex items-center justify-between text-xs text-emerald-300">
                  <span>Résultat Gros Volume (≥ 1M FCFA)</span>
                  <span className="font-bold text-emerald-400">Taux : {over1m}</span>
                </div>
                <div className="text-2xl font-black text-emerald-300 tracking-tight">
                  {formatNumber(simResultOver1m)} {simMode === 'cny_to_fcfa' ? 'FCFA' : 'CNY'}
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-white/10 pt-4 flex items-start gap-2.5 text-xs text-slate-400">
            <Info size={16} className="text-blue-400 shrink-0 mt-0.5" />
            <span>
              Les montants calculés ici correspondent exactement aux conversions appliquées sur l'application mobile et les fiches colis.
            </span>
          </div>

        </div>

      </div>

    </div>
  );
}
