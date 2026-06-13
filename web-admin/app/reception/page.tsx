'use client';

import { useState, useEffect } from 'react';
import { 
  PackageSearch, 
  Warehouse, 
  Box, 
  Scale, 
  Maximize, 
  ChevronRight, 
  Search,
  CheckCircle2,
  AlertCircle,
  Loader2,
  MapPin,
  Truck,
  Filter,
  Eye,
  ArrowRight
} from 'lucide-react';

const API_BASE_URL = 'http://127.0.0.1:8000/api';

const STATUS_CONFIG: any = {
  pending_reception: { label: 'En attente', color: 'bg-amber-100 text-amber-700' },
  received: { label: 'Stocké', color: 'bg-blue-100 text-blue-700' },
  loaded: { label: 'Chargé', color: 'bg-indigo-100 text-indigo-700' },
  in_transit: { label: 'En Transit', color: 'bg-purple-100 text-purple-700' },
  arrived: { label: 'Arrivé', color: 'bg-emerald-100 text-emerald-700' },
  delivered: { label: 'Livré', color: 'bg-slate-100 text-slate-500' }
};

export default function ReceptionPage() {
  const [allPackages, setAllPackages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedPackage, setSelectedPackage] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [containers, setContainers] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [receiveData, setReceiveData] = useState({
    weight_real: 0,
    dimensions: { l: 0, w: 0, h: 0 },
    nature: '',
    warehouse_location: 'Zone A-1',
    container_id: ''
  });

  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const token = localStorage.getItem('admin_token');
    try {
      // Fetch packages
      const resPkgs = await fetch(`${API_BASE_URL}/colis?limit=100`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (resPkgs.ok) {
        setAllPackages(await resPkgs.json());
      }

      // Fetch containers
      const resConts = await fetch(`${API_BASE_URL}/groupages/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (resConts.ok) {
        const data = await resConts.json();
        setContainers(data.filter((c: any) => c.status === 'open'));
      }
    } catch (err) {
      console.error("Failed to fetch data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleReceive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPackage) return;

    setSubmitting(true);
    setError(null);

    try {
      const token = localStorage.getItem('admin_token');
      
      const resReceive = await fetch(`${API_BASE_URL}/colis/${selectedPackage.id}/receive`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          weight_real: receiveData.weight_real,
          dimensions: receiveData.dimensions,
          nature: receiveData.nature,
          warehouse_location: receiveData.warehouse_location
        })
      });

      if (!resReceive.ok) throw new Error("Échec de la réception");

      if (receiveData.container_id) {
        const resAssign = await fetch(`${API_BASE_URL}/groupages/${receiveData.container_id}/add-package/${selectedPackage.id}`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!resAssign.ok) throw new Error("Échec de l'assignation au groupage");
      }

      setSuccess(`Colis ${selectedPackage.tracking_number} réceptionné avec succès !`);
      setShowForm(false);
      setSelectedPackage(null);
      fetchData();
    } catch (err: any) {
      setError(err.message || "Une erreur est survenue");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredPackages = allPackages.filter(p => {
    const matchSearch = p.tracking_number.toLowerCase().includes(searchTerm.toLowerCase()) || 
                      (p.owner_id && p.owner_id.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchStatus = statusFilter ? p.status === statusFilter : true;
    return matchSearch && matchStatus;
  });

  const openReception = (pkg: any) => {
    setSelectedPackage(pkg);
    setReceiveData({
      weight_real: pkg.weight_real || 0,
      dimensions: pkg.dimensions || { l: 0, w: 0, h: 0 },
      nature: pkg.description || '',
      warehouse_location: pkg.warehouse_location || 'Zone A-1',
      container_id: pkg.container_id || ''
    });
    setShowForm(true);
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 bg-blue-600 rounded-[22px] flex items-center justify-center text-white shadow-lg shadow-blue-200">
            <Warehouse size={28} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Réception & Stockage</h1>
            <p className="text-slate-500 font-medium">Gérez l'entrée des colis en entrepôt et leur assignation</p>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm mb-8 flex flex-wrap gap-4 items-center">
        <div className="flex-1 min-w-[300px] relative">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            type="text"
            placeholder="Rechercher par N° de suivi ou client..."
            className="w-full pl-14 pr-6 py-4 rounded-2xl border-2 border-slate-50 focus:border-blue-500 outline-none font-bold text-slate-800 transition-all bg-slate-50/50"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex items-center gap-2">
          <Filter size={18} className="text-slate-400" />
          <select 
            className="px-6 py-4 rounded-2xl border-2 border-slate-50 bg-slate-50/50 font-bold text-slate-800 outline-none focus:border-blue-500"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="">Tous les statuts</option>
            {Object.keys(STATUS_CONFIG).map(s => (
              <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
            ))}
          </select>
        </div>

        <button 
          onClick={fetchData}
          className="p-4 bg-slate-100 rounded-2xl text-slate-600 hover:bg-slate-200 transition-all"
        >
          <Loader2 className={loading ? 'animate-spin' : ''} size={24} />
        </button>
      </div>

      {success && (
        <div className="mb-8 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-3 text-emerald-600 font-bold animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 size={20} />
          {success}
          <button onClick={() => setSuccess(null)} className="ml-auto text-emerald-400 hover:text-emerald-600">×</button>
        </div>
      )}

      {/* Main Table */}
      <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50/50 text-[10px] font-black uppercase text-slate-400 tracking-widest">
            <tr>
              <th className="px-8 py-6">Colis / Suivi</th>
              <th className="px-6 py-6">Client</th>
              <th className="px-6 py-6">Transport</th>
              <th className="px-6 py-6">Statut</th>
              <th className="px-8 py-6 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredPackages.map((pkg) => (
              <tr key={pkg.id} className="hover:bg-slate-50/30 transition-colors group">
                <td className="px-8 py-5">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all">
                      <Box size={22} />
                    </div>
                    <div>
                      <p className="font-black text-slate-900">{pkg.tracking_number}</p>
                      <p className="text-[10px] font-bold text-slate-400 truncate max-w-[200px] uppercase tracking-tighter">{pkg.description}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-5">
                  <p className="text-sm font-bold text-slate-700">{pkg.owner_id}</p>
                </td>
                <td className="px-6 py-5">
                   <div className="flex items-center gap-2">
                     <Truck size={16} className={pkg.transport_mode === 'air' ? "text-orange-500" : "text-blue-500"} />
                     <span className="text-xs font-black uppercase text-slate-500">{pkg.transport_mode === 'air' ? 'Aérien' : 'Maritime'}</span>
                   </div>
                </td>
                <td className="px-6 py-5">
                  <span className={`inline-flex px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${STATUS_CONFIG[pkg.status]?.color || 'bg-slate-100'}`}>
                    {STATUS_CONFIG[pkg.status]?.label || pkg.status}
                  </span>
                </td>
                <td className="px-8 py-5 text-right">
                  <button 
                    onClick={() => openReception(pkg)}
                    className="inline-flex items-center gap-2 bg-slate-900 text-white px-4 py-2.5 rounded-xl font-bold text-xs hover:bg-blue-600 transition-all active:scale-95 shadow-lg shadow-slate-200"
                  >
                    Réceptionner <ArrowRight size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredPackages.length === 0 && !loading && (
          <div className="p-20 text-center">
             <div className="h-20 w-20 bg-slate-50 rounded-[32px] inline-flex items-center justify-center text-slate-200 mb-4">
                <Search size={40} />
             </div>
             <p className="text-slate-400 font-bold">Aucun colis trouvé</p>
          </div>
        )}
      </div>

      {/* Modal Reception Form */}
      {showForm && selectedPackage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md">
          <div className="bg-white w-full max-w-3xl rounded-[40px] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300 flex flex-col max-h-[90vh]">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                  <Box size={24} />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-slate-900">Audit & Réception</h2>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest mt-0.5">{selectedPackage.tracking_number} • {selectedPackage.owner_id}</p>
                </div>
              </div>
              <button onClick={() => setShowForm(false)} className="h-10 w-10 flex items-center justify-center hover:bg-slate-100 rounded-xl text-slate-400 transition-all text-2xl">×</button>
            </div>

            <form onSubmit={handleReceive} className="p-10 space-y-8 overflow-y-auto">
              {error && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 font-bold">
                  <AlertCircle size={20} />
                  {error}
                </div>
              )}

              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-6">
                   <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 ml-1">Poids Réel (kg)</label>
                    <div className="relative">
                      <Scale className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                      <input 
                        type="number" step="0.01" required
                        className="w-full pl-14 pr-6 py-4 rounded-2xl border-2 border-slate-100 focus:border-blue-500 outline-none font-bold text-slate-800 transition-all bg-slate-50/50"
                        value={receiveData.weight_real}
                        onChange={e => setReceiveData({...receiveData, weight_real: parseFloat(e.target.value)})}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 ml-1">Dimensions (L x W x H cm)</label>
                    <div className="flex gap-2">
                      <input type="number" placeholder="L" className="flex-1 px-4 py-4 rounded-2xl border-2 border-slate-100 focus:border-blue-500 outline-none font-bold text-slate-800 transition-all text-center bg-slate-50/50" value={receiveData.dimensions.l} onChange={e => setReceiveData({...receiveData, dimensions: {...receiveData.dimensions, l: parseInt(e.target.value)}})} />
                      <input type="number" placeholder="W" className="flex-1 px-4 py-4 rounded-2xl border-2 border-slate-100 focus:border-blue-500 outline-none font-bold text-slate-800 transition-all text-center bg-slate-50/50" value={receiveData.dimensions.w} onChange={e => setReceiveData({...receiveData, dimensions: {...receiveData.dimensions, w: parseInt(e.target.value)}})} />
                      <input type="number" placeholder="H" className="flex-1 px-4 py-4 rounded-2xl border-2 border-slate-100 focus:border-blue-500 outline-none font-bold text-slate-800 transition-all text-center bg-slate-50/50" value={receiveData.dimensions.h} onChange={e => setReceiveData({...receiveData, dimensions: {...receiveData.dimensions, h: parseInt(e.target.value)}})} />
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 ml-1">Emplacement Entrepôt</label>
                    <div className="relative">
                      <MapPin className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                      <input 
                        type="text" required
                        className="w-full pl-14 pr-6 py-4 rounded-2xl border-2 border-slate-100 focus:border-blue-500 outline-none font-bold text-slate-800 transition-all bg-slate-50/50"
                        placeholder="Ex: Rayon A-4"
                        value={receiveData.warehouse_location}
                        onChange={e => setReceiveData({...receiveData, warehouse_location: e.target.value})}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 ml-1">Assigner à un Groupage (Optionnel)</label>
                    <select 
                      className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 focus:border-blue-500 outline-none font-bold text-slate-800 transition-all bg-white shadow-sm"
                      value={receiveData.container_id}
                      onChange={e => setReceiveData({...receiveData, container_id: e.target.value})}
                    >
                      <option value="">-- Ne pas assigner --</option>
                      {containers.map(c => (
                        <option key={c.id} value={c.id}>{c.container_number} ({c.destination_city})</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <button 
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/30 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3"
                >
                  {submitting ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle2 size={20} />}
                  {submitting ? "Enregistrement..." : "Confirmer la réception"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
