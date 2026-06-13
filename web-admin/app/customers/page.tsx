'use client';

import { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  Filter, 
  Edit2, 
  Trash2, 
  MapPin, 
  Phone, 
  Mail, 
  Loader2, 
  X, 
  AlertCircle,
  Building2,
  CalendarDays
} from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api';

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`${API_BASE_URL}/admin/customers`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCustomers(data);
      } else if (res.status === 401) {
        window.location.href = '/login';
      }
    } catch (err) {
      console.error("Failed to fetch customers", err);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (customer: any) => {
    setSelectedCustomer({ ...customer });
    setShowEditModal(true);
    setError(null);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`${API_BASE_URL}/admin/users/${selectedCustomer.id}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          full_name: selectedCustomer.full_name,
          phone: selectedCustomer.phone,
          city: selectedCustomer.city,
          email: selectedCustomer.email
        })
      });

      if (res.ok) {
        setShowEditModal(false);
        fetchCustomers();
      } else {
        const errData = await res.json();
        setError(errData.detail || "Erreur lors de la mise à jour");
      }
    } catch (err) {
      setError("Impossible de contacter le serveur");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredCustomers = customers.filter(c => {
    const s = search.toLowerCase();
    const name = c.full_name?.toLowerCase() || '';
    const email = c.email?.toLowerCase() || '';
    const phone = c.phone?.toLowerCase() || '';
    const code = c.client_code?.toLowerCase() || '';
    return name.includes(s) || email.includes(s) || phone.includes(s) || code.includes(s);
  });

  return (
    <div className="p-8 space-y-10 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-4">
            <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-500/20">
              <Users size={28} />
            </div>
            Portefeuille Clients
          </h1>
          <p className="text-slate-500 font-medium mt-3 text-lg">
            Gérez vos clients, consultez leurs informations et mettez à jour leurs dossiers.
          </p>
        </div>
      </div>

      {/* Stats Board */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-blue-900 to-indigo-900 p-8 rounded-[32px] shadow-lg text-white relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
            <Users size={80} />
          </div>
          <p className="text-blue-200 font-black uppercase tracking-widest text-xs mb-2">Total Clients</p>
          <p className="text-5xl font-black">{customers.length}</p>
        </div>
        
        <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5 text-emerald-600">
            <Building2 size={80} />
          </div>
          <p className="text-slate-400 font-black uppercase tracking-widest text-xs mb-2">Villes Couvertes</p>
          <p className="text-5xl font-black text-slate-900">{new Set(customers.map(c => c.city).filter(Boolean)).size}</p>
        </div>

        <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5 text-orange-600">
            <CalendarDays size={80} />
          </div>
          <p className="text-slate-400 font-black uppercase tracking-widest text-xs mb-2">Nouveaux (30 Jours)</p>
          <p className="text-5xl font-black text-emerald-500">
            +{customers.filter(c => new Date(c.created_at || Date.now()) > new Date(Date.now() - 30*24*60*60*1000)).length}
          </p>
        </div>
      </div>

      {/* Main Board */}
      <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4 bg-slate-50/50">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text" 
              placeholder="Rechercher (Nom, Email, Tél, Code)..."
              className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold text-slate-700 shadow-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button className="flex items-center gap-2 px-6 py-3.5 bg-white border border-slate-200 rounded-2xl text-slate-600 font-bold hover:bg-slate-50 hover:text-blue-600 transition-all shadow-sm">
            <Filter size={18} /> Filtrer
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-white border-b border-slate-100">
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Client & Code</th>
                <th className="px-6 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Contact</th>
                <th className="px-6 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Localisation</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={4} className="p-20 text-center">
                    <Loader2 className="animate-spin text-blue-600 mx-auto mb-4" size={40} />
                    <p className="font-bold text-slate-400 tracking-wide">Chargement des données...</p>
                  </td>
                </tr>
              ) : filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-20 text-center">
                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Users size={32} className="text-slate-300" />
                    </div>
                    <p className="font-bold text-slate-500 text-lg">Aucun client trouvé</p>
                    <p className="text-slate-400 font-medium mt-1">Essayez d'ajuster vos filtres de recherche.</p>
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 flex items-center justify-center text-blue-600 font-black text-xl shadow-inner">
                          {customer.full_name ? customer.full_name.charAt(0).toUpperCase() : '?'}
                        </div>
                        <div>
                          <p className="font-black text-slate-900 text-base">{customer.full_name || 'Sans Nom'}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded uppercase tracking-widest">
                              {customer.client_code || 'N/A'}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono uppercase">ID: {customer.id.slice(0, 8)}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-6">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm text-slate-600 font-bold">
                          <Phone size={14} className="text-slate-400" />
                          {customer.phone || 'Non renseigné'}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
                          <Mail size={14} className="text-slate-400" />
                          {customer.email || 'Non renseigné'}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-6">
                      <div className="flex items-center gap-2 text-sm font-bold text-slate-700 bg-slate-100/50 border border-slate-200 self-start px-3 py-1.5 rounded-xl">
                        <MapPin size={14} className="text-emerald-500" />
                        {customer.city || 'Inconnue'}
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleEdit(customer)}
                          className="p-3 rounded-xl bg-white border border-slate-200 hover:border-blue-200 hover:bg-blue-50 text-slate-500 hover:text-blue-600 transition-all shadow-sm"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button className="p-3 rounded-xl bg-white border border-slate-200 hover:border-red-200 hover:bg-red-50 text-slate-500 hover:text-red-600 transition-all shadow-sm">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Modifier le profil</h2>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Mise à jour client</p>
              </div>
              <button 
                onClick={() => setShowEditModal(false)} 
                className="p-3 hover:bg-white border border-transparent hover:border-slate-200 rounded-2xl text-slate-400 hover:text-slate-600 shadow-none hover:shadow-sm transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="p-8 space-y-6">
              {error && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-sm font-bold">
                  <AlertCircle size={20} />
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Nom Complet</label>
                  <input 
                    type="text"
                    required
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 font-bold text-slate-900 transition-all"
                    value={selectedCustomer.full_name || ''}
                    onChange={e => setSelectedCustomer({...selectedCustomer, full_name: e.target.value})}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Téléphone</label>
                    <input 
                      type="text"
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 font-bold text-slate-900 transition-all"
                      value={selectedCustomer.phone || ''}
                      onChange={e => setSelectedCustomer({...selectedCustomer, phone: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Ville</label>
                    <input 
                      type="text"
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 font-bold text-slate-900 transition-all"
                      value={selectedCustomer.city || ''}
                      onChange={e => setSelectedCustomer({...selectedCustomer, city: e.target.value})}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Email</label>
                  <input 
                    type="email"
                    required
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 font-bold text-slate-900 transition-all"
                    value={selectedCustomer.email || ''}
                    onChange={e => setSelectedCustomer({...selectedCustomer, email: e.target.value})}
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button 
                  type="button" 
                  onClick={() => setShowEditModal(false)}
                  className="px-6 py-4 rounded-2xl font-bold text-slate-500 hover:bg-slate-50 transition-colors"
                >
                  Annuler
                </button>
                <button 
                  type="submit" 
                  disabled={submitting}
                  className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-500/30 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {submitting && <Loader2 className="animate-spin" size={18} />}
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
