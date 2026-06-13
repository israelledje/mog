'use client';

import { useState, useEffect } from 'react';
import { Store, Search, PackageCheck, CreditCard, Loader2, CheckCircle2 } from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api';

export default function GuichetPage() {
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [allColis, setAllColis] = useState<any[]>([]);
  const [selectedColis, setSelectedColis] = useState<any>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchPackages();
  }, []);

  const fetchPackages = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`${API_BASE_URL}/colis?limit=1000`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        // Only show packages that are delivered to destination or pending reception (for demo purposes)
        const available = data.filter((c: any) => 
          c.status === 'delivered_destination' || c.status === 'pending_reception' || c.status === 'arrived'
        );
        setAllColis(available);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckout = async () => {
    if (!selectedColis) return;
    setCheckoutLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`${API_BASE_URL}/colis/${selectedColis.id}/checkout`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        setSuccess(true);
        setTimeout(() => {
          setSuccess(false);
          setSelectedColis(null);
          fetchPackages(); // refresh list
        }, 3000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCheckoutLoading(false);
    }
  };

  const filteredColis = allColis.filter(c => {
    const q = search.toLowerCase();
    const trackMatch = c.tracking_number?.toLowerCase().includes(q);
    const clientMatch = c.client_name?.toLowerCase().includes(q);
    return trackMatch || clientMatch;
  });

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
          <Store size={32} className="text-emerald-600" /> Guichet Client
        </h1>
        <p className="text-slate-500 font-medium mt-1">Recherchez et encaissez les colis disponibles à l'entrepôt.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left: Search & Table (Spans 2 columns) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text" 
              placeholder="Rechercher par N° de colis ou Nom du client..."
              className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-bold shadow-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 uppercase tracking-wider font-black text-[10px]">
                  <tr>
                    <th className="p-4">N° Colis</th>
                    <th className="p-4">Client</th>
                    <th className="p-4">Origine</th>
                    <th className="p-4">Date d'Arrivée</th>
                    <th className="p-4 text-right">Statut Paiement</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center">
                        <Loader2 className="animate-spin text-emerald-600 mx-auto" size={30} />
                      </td>
                    </tr>
                  ) : filteredColis.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-400 font-bold">
                        Aucun colis disponible dans l'entrepôt.
                      </td>
                    </tr>
                  ) : (
                    filteredColis.map(c => (
                      <tr 
                        key={c.id} 
                        onClick={() => setSelectedColis(c)}
                        className={`cursor-pointer transition-colors ${selectedColis?.id === c.id ? 'bg-emerald-50/50' : 'hover:bg-slate-50'}`}
                      >
                        <td className="p-4 font-black text-slate-900">{c.tracking_number}</td>
                        <td className="p-4 font-bold text-slate-600">{c.client_name || 'Inconnu'}</td>
                        <td className="p-4 text-slate-500 font-medium">
                          {c.transport_mode === 'air' ? 'Guangzhou (Aérien)' : 'Guangzhou (Maritime)'}
                        </td>
                        <td className="p-4 text-slate-500 font-medium">
                          {c.arrived_at ? new Date(c.arrived_at).toLocaleDateString('fr-FR') : 'En attente'}
                        </td>
                        <td className="p-4 text-right">
                          <span className={`text-[10px] uppercase font-black tracking-widest px-2 py-1 rounded ${
                            c.payment_status === 'paid' ? 'bg-emerald-100 text-emerald-600' : 'bg-orange-100 text-orange-600'
                          }`}>
                            {c.payment_status === 'paid' ? 'Payé' : 'À Encaisser'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right: Checkout Panel (Spans 1 column) */}
        <div className="lg:col-span-1">
          {selectedColis ? (
            <div className="bg-white rounded-[32px] border border-slate-100 shadow-xl overflow-hidden relative sticky top-8">
              {/* Receipt Header */}
              <div className="bg-slate-900 p-8 text-white">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-emerald-400 font-black text-[10px] uppercase tracking-widest mb-1">Détails du Retrait</p>
                    <h2 className="text-xl font-black tracking-tight">{selectedColis.tracking_number}</h2>
                  </div>
                  <PackageCheck size={32} className="text-emerald-400 opacity-50" />
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Client Info */}
                <div className="pb-6 border-b border-slate-100">
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Client</p>
                  <p className="font-bold text-slate-900 text-lg">{selectedColis.client_name || 'Inconnu'}</p>
                </div>

                {/* Package Info */}
                <div className="grid grid-cols-2 gap-4 pb-6 border-b border-slate-100">
                  <div>
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Description</p>
                    <p className="font-bold text-slate-900 text-sm">{selectedColis.description}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Poids/Vol</p>
                    <p className="font-bold text-slate-900 text-sm">
                      {selectedColis.transport_mode === 'air' ? `${selectedColis.chargeable_qty || selectedColis.weight_real} Kg` : `${selectedColis.chargeable_qty} CBM`}
                    </p>
                  </div>
                </div>

                {/* Financials */}
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center text-slate-600 font-medium">
                    <span>Frais de Transport</span>
                    <span>{(selectedColis.shipping_cost || 0).toLocaleString()} FCFA</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-600 font-medium">
                    <span>Frais de Stockage</span>
                    <span className="text-red-500 font-bold">+ {(selectedColis.storage_fee || 0).toLocaleString()} FCFA</span>
                  </div>
                  
                  <div className="pt-4 border-t border-slate-200 border-dashed flex justify-between items-end">
                    <div>
                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Net à Payer</p>
                      <p className="text-3xl font-black text-slate-900">
                        {((selectedColis.shipping_cost || 0) + (selectedColis.storage_fee || 0)).toLocaleString()} 
                        <span className="text-lg ml-1">FCFA</span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-4">
                  {success ? (
                    <div className="bg-emerald-50 text-emerald-600 p-4 rounded-2xl flex flex-col items-center justify-center gap-2 font-black text-sm text-center">
                      <CheckCircle2 size={32} className="mb-1" /> Encaissé et Retiré avec succès !
                    </div>
                  ) : (
                    <button 
                      onClick={handleCheckout}
                      disabled={checkoutLoading || selectedColis.payment_status === 'paid'}
                      className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-500/30 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {checkoutLoading ? <Loader2 className="animate-spin" size={18} /> : <CreditCard size={18} />}
                      {selectedColis.payment_status === 'paid' ? 'Déjà Payé' : 'Valider & Remettre'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full min-h-[400px] flex flex-col justify-center items-center text-slate-300 border-2 border-dashed border-slate-200 rounded-[32px] bg-white sticky top-8">
              <PackageCheck size={64} className="mb-4 opacity-50" />
              <p className="font-bold text-slate-400">Sélectionnez un colis dans le tableau</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
