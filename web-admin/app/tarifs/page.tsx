'use client';

import { useState, useEffect } from 'react';
import { Plane, Ship, Edit3, Save, X, Loader2, RefreshCw, CheckCircle2, Info, ArrowRight, ShieldCheck, Plus } from 'lucide-react';
import { API } from '@/lib/api';
function getToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('admin_token') ?? '' : '';
}

type Tarif = {
  id: string;
  mode: 'air' | 'sea';
  label: string;
  description: string;
  unit: string;
  price: number;
  category_key: string;
  updated_at?: string;
};

export default function TarifsPage() {
  const [tarifs, setTarifs] = useState<Tarif[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, { price: string; label: string; description: string }>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTarif, setNewTarif] = useState<Partial<Tarif>>({ mode: 'air', label: '', description: '', unit: 'kg', price: 0, category_key: 'standard' });

  const fetchTarifs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/tarifs/`, { headers: { Authorization: `Bearer ${getToken()}` } });
      if (res.ok) {
        const data: Tarif[] = await res.json();
        setTarifs(data);
        const vals: Record<string, any> = {};
        data.forEach(t => { vals[t.id] = { price: String(t.price), label: t.label, description: t.description }; });
        setEditValues(vals);
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchTarifs(); }, []);

  const createTarif = async () => {
    setCreating(true);
    try {
      const res = await fetch(`${API}/tarifs/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(newTarif),
      });
      if (res.ok) {
        setShowCreateModal(false);
        setNewTarif({ mode: 'air', label: '', description: '', unit: 'kg', price: 0, category_key: 'standard' });
        fetchTarifs();
      }
    } catch {}
    setCreating(false);
  };

  const saveTarif = async (id: string) => {
    setSaving(id);
    const vals = editValues[id];
    try {
      const res = await fetch(`${API}/tarifs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ price: parseFloat(vals.price), label: vals.label, description: vals.description }),
      });
      if (res.ok) {
        setSaved(id);
        setEditing(null);
        fetchTarifs();
        setTimeout(() => setSaved(null), 2000);
      }
    } catch {}
    setSaving(null);
  };

  const airTarifs = tarifs.filter(t => t.mode === 'air');
  const seaTarifs = tarifs.filter(t => t.mode === 'sea');

  const TarifCard = ({ t }: { t: Tarif }) => {
    const isEditing = editing === t.id;
    const vals = editValues[t.id] || { price: String(t.price), label: t.label, description: t.description };
    const isAir = t.mode === 'air';

    return (
      <div className={`relative bg-white rounded-[32px] border transition-all duration-300 overflow-hidden flex flex-col ${
        isEditing ? 'border-blue-400 shadow-2xl shadow-blue-500/20 scale-[1.02] z-10' : 'border-slate-200 hover:border-slate-300 shadow-sm hover:shadow-xl hover:-translate-y-1'
      }`}>
        {/* Color Accent Top */}
        <div className={`absolute top-0 left-0 w-full h-1.5 ${isAir ? 'bg-gradient-to-r from-sky-400 to-blue-500' : 'bg-gradient-to-r from-blue-700 to-indigo-800'}`} />
        
        <div className="p-8 flex-1 flex flex-col">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner ${isAir ? 'bg-gradient-to-br from-sky-50 to-blue-100' : 'bg-gradient-to-br from-blue-50 to-indigo-100'}`}>
                {isAir ? <Plane size={24} className="text-sky-600" /> : <Ship size={24} className="text-blue-700" />}
              </div>
              <div>
                {isEditing ? (
                  <input
                    value={vals.label}
                    onChange={e => setEditValues(p => ({ ...p, [t.id]: { ...p[t.id], label: e.target.value } }))}
                    className="font-black text-slate-900 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-base w-full focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  />
                ) : (
                  <h3 className="font-black text-slate-900 text-lg leading-tight">{t.label}</h3>
                )}
                <span className={`inline-block mt-2 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest ${isAir ? 'bg-sky-50 text-sky-700' : 'bg-blue-50 text-blue-700'}`}>
                  {isAir ? 'Transport Aérien' : 'Transport Maritime'}
                </span>
              </div>
            </div>

            {isEditing ? (
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => saveTarif(t.id)}
                  disabled={saving === t.id}
                  className="p-2.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition-all shadow-lg active:scale-95 disabled:opacity-50 flex items-center justify-center"
                  title="Enregistrer"
                >
                  {saving === t.id ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                </button>
                <button 
                  onClick={() => setEditing(null)} 
                  className="p-2.5 rounded-xl text-slate-500 border border-slate-200 hover:bg-slate-50 hover:text-slate-700 transition-all active:scale-95 flex items-center justify-center"
                  title="Annuler"
                >
                  <X size={18} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setEditing(t.id)}
                className="p-3 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all border border-transparent hover:border-blue-100"
              >
                <Edit3 size={18} />
              </button>
            )}
          </div>

          <div className="flex-1">
            {isEditing ? (
              <textarea
                value={vals.description}
                onChange={e => setEditValues(p => ({ ...p, [t.id]: { ...p[t.id], description: e.target.value } }))}
                rows={3}
                className="w-full text-sm font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-xl p-4 resize-none focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all mb-4"
              />
            ) : (
              <p className="text-sm font-medium text-slate-500 leading-relaxed mb-6">{t.description}</p>
            )}
          </div>

          <div className={`mt-auto rounded-2xl p-6 border ${isAir ? 'bg-sky-50/50 border-sky-100' : 'bg-blue-50/50 border-blue-100'}`}>
            {isEditing ? (
              <div className="flex items-center gap-3">
                <span className="text-slate-400 font-black text-xl">FCFA</span>
                <input
                  type="number"
                  value={vals.price}
                  onChange={e => setEditValues(p => ({ ...p, [t.id]: { ...p[t.id], price: e.target.value } }))}
                  className="text-3xl font-black text-slate-900 bg-white border border-slate-200 rounded-xl px-4 py-2 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 w-full transition-all"
                />
                <span className="text-sm font-bold text-slate-400 whitespace-nowrap">/ {t.unit}</span>
              </div>
            ) : (
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Tarif de base</p>
                  <p className={`text-3xl font-black ${isAir ? 'text-sky-700' : 'text-blue-800'}`}>
                    {t.price.toLocaleString('fr-FR')}
                    <span className="text-lg font-bold ml-1 opacity-70">FCFA</span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Unité</p>
                  <p className={`text-lg font-black ${isAir ? 'text-sky-600' : 'text-blue-700'}`}>/ {t.unit}</p>
                </div>
              </div>
            )}
            
            {!isEditing && saved === t.id && (
              <div className="mt-4 py-2 px-3 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-black flex items-center justify-center gap-2 animate-in fade-in zoom-in duration-300">
                <CheckCircle2 size={14} /> Tarif enregistré avec succès
              </div>
            )}
          </div>

          {!isEditing && t.updated_at && (
            <div className="mt-5 flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              <span>Dernière modification :</span>
              <span>{new Date(t.updated_at).toLocaleDateString('fr-FR')}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="p-8 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-4">
            <div className="p-3 bg-slate-900 text-white rounded-2xl shadow-lg">
              <ShieldCheck size={28} />
            </div>
            Grille Tarifaire B2B
          </h1>
          <p className="text-slate-500 font-medium mt-3 text-lg">
            Gérez vos tarifs de fret de référence. Ces tarifs s'appliquent automatiquement lors de la création de nouvelles expéditions.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowCreateModal(true)} 
            className="flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-all shadow-sm active:scale-95"
          >
            <Plus size={18} />
            Nouveau Tarif
          </button>
          <button 
            onClick={fetchTarifs} 
            className="flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-white border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 hover:text-blue-600 transition-all shadow-sm active:scale-95"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            Actualiser
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-32 space-y-4">
          <Loader2 className="animate-spin text-blue-600" size={48} />
          <p className="text-slate-400 font-bold tracking-widest uppercase text-sm">Chargement de la grille tarifaire...</p>
        </div>
      ) : (
        <div className="space-y-12">
          {/* Air Tarifs Section */}
          <section className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-sky-100 text-sky-600">
                <Plane size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-900">Aérien</h2>
                <p className="text-sm font-medium text-slate-500">Expéditions rapides · Facturation au Kilogramme</p>
              </div>
              <div className="hidden md:flex ml-auto items-center gap-3 px-5 py-2.5 bg-sky-50/50 rounded-full border border-sky-100">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Trajet Principal</span>
                <ArrowRight size={14} className="text-slate-300" />
                <span className="text-[10px] font-black text-sky-600 uppercase tracking-widest">Guangzhou (CN) → Douala (CM)</span>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
              {airTarifs.map(t => <TarifCard key={t.id} t={t} />)}
            </div>
          </section>

          <div className="h-px bg-slate-200 w-full" />

          {/* Sea Tarifs Section */}
          <section className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-100 text-blue-700">
                <Ship size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-900">Maritime</h2>
                <p className="text-sm font-medium text-slate-500">Volumes importants · Facturation au Mètre Cube (CBM)</p>
              </div>
              <div className="hidden md:flex ml-auto items-center gap-3 px-5 py-2.5 bg-blue-50/50 rounded-full border border-blue-100">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Trajet Principal</span>
                <ArrowRight size={14} className="text-slate-300" />
                <span className="text-[10px] font-black text-blue-700 uppercase tracking-widest">Port GZ (CN) → Port DLA (CM)</span>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {seaTarifs.map(t => <TarifCard key={t.id} t={t} />)}
            </div>
          </section>

          {/* Info Banner */}
          <div className="bg-slate-900 rounded-3xl p-8 flex flex-col md:flex-row items-center justify-between gap-6 text-white shadow-xl">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-white/10 rounded-2xl shrink-0">
                <Info size={24} className="text-blue-400" />
              </div>
              <div>
                <h3 className="text-lg font-black mb-1">Automatisation de la facturation</h3>
                <p className="text-slate-400 text-sm font-medium leading-relaxed max-w-2xl">
                  Ces tarifs sont intégrés au moteur de calcul de Cargo Tracker. Lors de l'enregistrement d'un colis, le système calculera automatiquement le montant final en se basant sur le poids/volume facturable et les tarifs configurés ici. Toute modification s'applique instantanément aux prochaines factures.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
            <h2 className="text-2xl font-black text-slate-900 mb-6">Créer un Tarif</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Mode de transport</label>
                <select 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  value={newTarif.mode} 
                  onChange={e => setNewTarif({ ...newTarif, mode: e.target.value as 'air' | 'sea', unit: e.target.value === 'air' ? 'kg' : 'cbm' })}
                >
                  <option value="air">Aérien (kg)</option>
                  <option value="sea">Maritime (CBM)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Clé Catégorie</label>
                <input 
                  type="text" 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  value={newTarif.category_key} 
                  onChange={e => setNewTarif({ ...newTarif, category_key: e.target.value })}
                  placeholder="ex: standard, sensitive, heavy"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Titre (Label)</label>
                <input 
                  type="text" 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  value={newTarif.label} 
                  onChange={e => setNewTarif({ ...newTarif, label: e.target.value })}
                  placeholder="ex: Colis Standard"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Prix (FCFA)</label>
                <input 
                  type="number" 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-black text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  value={newTarif.price || ''} 
                  onChange={e => setNewTarif({ ...newTarif, price: parseFloat(e.target.value) || 0 })}
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Description</label>
                <textarea 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
                  value={newTarif.description} 
                  onChange={e => setNewTarif({ ...newTarif, description: e.target.value })}
                  rows={3}
                  placeholder="Description détaillée..."
                />
              </div>
            </div>
            <div className="flex items-center gap-3 mt-8">
              <button 
                onClick={() => setShowCreateModal(false)}
                className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-all"
              >
                Annuler
              </button>
              <button 
                onClick={createTarif}
                disabled={creating}
                className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all flex justify-center"
              >
                {creating ? <Loader2 className="animate-spin" size={20} /> : 'Créer le Tarif'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
