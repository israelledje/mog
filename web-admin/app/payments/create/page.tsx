'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  ChevronLeft, Package, Plane, Ship, Users, DollarSign, 
  CheckCircle2, FileText, Loader2, ChevronRight,
  Calculator, BadgeCheck, Clock, Archive, Save, Printer, X,
  Settings, List, Info, AlertCircle, Search, User
} from 'lucide-react';

const API_BASE_URL = 'http://127.0.0.1:8000/api';
const TVA_RATE = 0.1925;

function CreateInvoiceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('edit');
  
  const [activeTab, setActiveTab] = useState<'items' | 'config'>('items');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  // Data
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [availablePackages, setAvailablePackages] = useState<any[]>([]);
  
  // Edit mode tracking
  const [existingInvoice, setExistingInvoice] = useState<any>(null);

  // Invoice State
  const [selectedPackageIds, setSelectedPackageIds] = useState<Set<string>>(new Set());
  const [manualUnitPrices, setManualUnitPrices] = useState<Record<string, number>>({});
  const [includeVat, setIncludeVat] = useState(false);
  const [discount, setDiscount] = useState(0);
  const [tarifs, setTarifs] = useState<any[]>([]);
  
  const [searchTerm, setSearchTerm] = useState('');

  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : '';

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch Customers
      const custRes = await fetch(`${API_BASE_URL}/admin/customers`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (custRes.ok) setCustomers(await custRes.json());
      
      // 2. Fetch Tarifs
      const tarifRes = await fetch(`${API_BASE_URL}/tarifs/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (tarifRes.ok) setTarifs(await tarifRes.json());
      
      // 3. Handle Edit Mode
      if (editId) {
        const invRes = await fetch(`${API_BASE_URL}/invoices/${editId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (invRes.ok) {
          const inv = await invRes.json();
          setExistingInvoice(inv);
          
          // Pre-fill
          const cust = await (await fetch(`${API_BASE_URL}/admin/customers`, { headers: { 'Authorization': `Bearer ${token}` } })).json();
          const foundCust = cust.find((c: any) => c.email === inv.customer_id);
          setSelectedCustomer(foundCust || { email: inv.customer_id });
          
          setIncludeVat(inv.include_vat);
          setDiscount(inv.discount || 0);
          
          const selIds = new Set<string>();
          const mPrices: Record<string, number> = {};
          
          inv.packages.forEach((p: any) => {
            selIds.add(p.package_id);
            if (p.manual_unit_price !== undefined && p.manual_unit_price !== null) {
              mPrices[p.package_id] = p.manual_unit_price;
            } else {
              mPrices[p.package_id] = p.calculated_unit_price;
            }
          });
          
          setSelectedPackageIds(selIds);
          setManualUnitPrices(mPrices);
          
          // Fetch packages for this customer to show in the list
          fetchCustomerPackages(inv.customer_id, selIds);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [token, editId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const fetchCustomerPackages = async (email: string, preSelected?: Set<string>) => {
    try {
      const pRes = await fetch(`${API_BASE_URL}/colis/?limit=200`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (pRes.ok) {
        const all = await pRes.json();
        const clientPkgs = all.filter((p: any) => p.owner_id === email);
        const eligiblePkgs = clientPkgs.filter((p: any) => 
          p.status === 'received' || (preSelected && preSelected.has(p.id))
        );
        setAvailablePackages(eligiblePkgs);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCustomerSelect = (customer: any) => {
    setSelectedCustomer(customer);
    setAvailablePackages([]);
    setSelectedPackageIds(new Set());
    setManualUnitPrices({});
    setDiscount(0);
    fetchCustomerPackages(customer.email);
  };

  const calculateAutoUnitPrice = (pkg: any) => {
    const category = pkg.category || 'standard';
    const tarif = tarifs.find(t => t.mode === pkg.transport_mode && t.category_key === category)
      || tarifs.find(t => t.mode === pkg.transport_mode);
    return tarif ? tarif.price : 0;
  };
  
  const getPackageQteValue = (pkg: any) => {
    if (pkg?.transport_mode === 'air') return pkg.weight_real || 0;
    const dims = pkg?.dimensions || {};
    const cbm = (dims.l || 0) * (dims.w || 0) * (dims.h || 0) / 1000000;
    return cbm > 0 ? cbm : 0;
  };
  
  const getPackageQteStr = (pkg: any) => {
    if (pkg.transport_mode === 'air') return `${pkg.weight_real || 0} kg`;
    const dims = pkg.dimensions || {};
    const cbm = (dims.l || 0) * (dims.w || 0) * (dims.h || 0) / 1000000;
    return `${cbm.toFixed(3)} CBM`;
  };

  const togglePackage = (pkgId: string) => {
    const newSel = new Set(selectedPackageIds);
    if (newSel.has(pkgId)) {
      newSel.delete(pkgId);
    } else {
      newSel.add(pkgId);
      if (!(pkgId in manualUnitPrices)) {
        const pkg = availablePackages.find(p => p.id === pkgId);
        if (pkg) {
          setManualUnitPrices(prev => ({...prev, [pkgId]: calculateAutoUnitPrice(pkg)}));
        }
      }
    }
    setSelectedPackageIds(newSel);
  };

  const handlePriceChange = (pkgId: string, value: string) => {
    const val = parseFloat(value);
    setManualUnitPrices(prev => ({
      ...prev,
      [pkgId]: isNaN(val) ? 0 : val
    }));
  };

  const calculateTotals = () => {
    let ht = 0;
    selectedPackageIds.forEach(id => {
      const pkg = availablePackages.find(p => p.id === id);
      const qte = getPackageQteValue(pkg);
      ht += (manualUnitPrices[id] || 0) * qte;
    });
    const net_ht = Math.max(0, ht - discount);
    const vat = includeVat ? net_ht * TVA_RATE : 0;
    return { ht, net_ht, vat, ttc: net_ht + vat };
  };

  const handleSave = async (finalize = false) => {
    if (!selectedCustomer || selectedPackageIds.size === 0) return;
    setSubmitting(true);
    try {
      const packagesPayload = Array.from(selectedPackageIds).map(id => {
        const pkg = availablePackages.find(p => p.id === id);
        return {
          package_id: id,
          transport_mode: pkg?.transport_mode,
          calculated_unit_price: calculateAutoUnitPrice(pkg),
          manual_unit_price: manualUnitPrices[id],
          weight_or_volume: getPackageQteValue(pkg),
          unit: pkg?.transport_mode === 'air' ? 'kg' : 'cbm'
        };
      });

      const { ht } = calculateTotals();
      
      const payload = {
        customer_id: selectedCustomer.email,
        packages: packagesPayload,
        total_price: ht,
        include_vat: includeVat,
        discount: discount
      };

      let res;
      let finalInvoiceId = editId;
      
      if (editId) {
        res = await fetch(`${API_BASE_URL}/invoices/${editId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch(`${API_BASE_URL}/invoices/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          const data = await res.json();
          finalInvoiceId = data.id;
          router.replace(`/payments/create?edit=${data.id}`);
        }
      }

      if (res.ok) {
        if (finalize && finalInvoiceId) {
          await fetch(`${API_BASE_URL}/invoices/${finalInvoiceId}/finalize`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          router.push('/payments');
        } else {
          alert('Brouillon enregistré');
        }
      }
    } catch {
      alert('Erreur lors de l\'enregistrement');
    } finally {
      setSubmitting(false);
    }
  };

  const { ht, net_ht, vat, ttc } = calculateTotals();
  
  const placeholderInvoiceNumber = `FAC N°_MOG${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, '0')}/----`;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 gap-4">
        <Loader2 className="animate-spin text-blue-600" size={40} />
        <p className="text-slate-400 font-bold animate-pulse uppercase tracking-widest text-xs">Chargement du document...</p>
      </div>
    );
  }

  if (!selectedCustomer) {
    const filteredCustomers = customers.filter(c => 
      (c.full_name?.toLowerCase().includes(searchTerm.toLowerCase())) || 
      (c.email?.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
      <div className="min-h-screen bg-slate-50 p-12">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="flex items-center gap-4 mb-8">
             <button onClick={() => router.back()} className="p-2 hover:bg-white rounded-xl transition-all"><ChevronLeft /></button>
             <h1 className="text-2xl font-black text-slate-900">Sélectionner un Client</h1>
          </div>
          
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text" 
              placeholder="Rechercher un client..."
              className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold text-slate-700 shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredCustomers.map(c => (
              <button 
                key={c.id}
                onClick={() => handleCustomerSelect(c)}
                className="bg-white p-6 rounded-[2rem] border border-slate-200 hover:border-blue-400 hover:shadow-xl transition-all text-left group flex gap-4 items-center"
              >
                <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-inner">
                  <User size={24} />
                </div>
                <div>
                  <p className="font-black text-slate-900 text-lg">{c.full_name || 'Sans Nom'}</p>
                  <p className="text-sm text-slate-400 font-bold">{c.email}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const isFinal = existingInvoice?.status === 'final';

  return (
    <div className="min-h-screen bg-[#f1f3f6] flex flex-col">
      {/* ── TOP ACTION BAR (Odoo Style) ── */}
      <div className="h-14 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => handleSave(false)}
            disabled={submitting || isFinal}
            className="px-4 py-1.5 bg-[#00A09D] hover:bg-[#008d8a] text-white text-xs font-bold rounded shadow-sm disabled:opacity-50 transition-all flex items-center gap-2"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {isFinal ? 'ENREGISTRÉ' : 'ENREGISTRER BROUILLON'}
          </button>
          <button 
            onClick={() => router.back()}
            className="px-4 py-1.5 bg-white border border-slate-300 text-slate-700 text-xs font-bold rounded hover:bg-slate-50 shadow-sm transition-all"
          >
            ANNULER
          </button>
          <div className="w-px h-6 bg-slate-200 mx-2" />
          <button 
            disabled={!editId}
            onClick={() => window.open(`${API_BASE_URL}/invoices/${editId}/pdf?token=${token}`, '_blank')}
            className="px-4 py-1.5 bg-white border border-slate-300 text-slate-700 text-xs font-bold rounded hover:bg-slate-50 shadow-sm transition-all flex items-center gap-2 disabled:opacity-30"
          >
            <Printer size={14} />
            IMPRIMER
          </button>
          {!isFinal && (
            <button 
              onClick={() => handleSave(true)}
              disabled={submitting || selectedPackageIds.size === 0}
              className="px-4 py-1.5 bg-[#714B67] hover:bg-[#5d3e55] text-white text-xs font-bold rounded shadow-sm transition-all disabled:opacity-50"
            >
              CONFIRMER
            </button>
          )}
        </div>

        <div className="flex items-center">
           <div className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${isFinal ? 'text-slate-400' : 'text-[#714B67] border-b-2 border-[#714B67]'}`}>
             <div className={`w-2 h-2 rounded-full ${isFinal ? 'bg-slate-300' : 'bg-[#714B67]'}`} />
             Brouillon
           </div>
           <div className="w-8 h-px bg-slate-200" />
           <div className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${isFinal ? 'text-[#00A09D] border-b-2 border-[#00A09D]' : 'text-slate-300'}`}>
             <div className={`w-2 h-2 rounded-full ${isFinal ? 'bg-[#00A09D]' : 'bg-slate-300'}`} />
             Comptabilisé
           </div>
        </div>
      </div>

      {/* ── DOCUMENT CONTENT ── */}
      <div className="flex-1 p-8 max-w-6xl mx-auto w-full">
        <div className="bg-white shadow-xl rounded-sm min-h-[800px] flex flex-col overflow-hidden">
          
          <div className="p-10 pb-6">
            <div className="flex justify-between items-start mb-10">
              <div>
                <p className="text-[#00A09D] font-black text-sm uppercase tracking-widest mb-2">Facture Client</p>
                <h1 className="text-4xl font-black text-slate-900 tracking-tight">
                  {existingInvoice ? existingInvoice.invoice_number : placeholderInvoiceNumber}
                </h1>
              </div>
              <div className="text-right">
                <button 
                  onClick={() => !isFinal && setSelectedCustomer(null)}
                  disabled={isFinal}
                  className="inline-flex items-center gap-3 px-4 py-2 bg-slate-50 rounded-xl hover:bg-slate-100 transition-all text-left"
                >
                  <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm">
                    <User size={20} className="text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-400 uppercase">Client</p>
                    <p className="font-bold text-slate-900">{selectedCustomer.full_name || selectedCustomer.email}</p>
                  </div>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-12 text-sm">
               <div className="space-y-4">
                  <div className="flex gap-8">
                    <span className="w-24 text-slate-400 font-bold">Client Email</span>
                    <span className="text-[#00A09D] font-black">{selectedCustomer.email}</span>
                  </div>
                  <div className="flex gap-8">
                    <span className="w-24 text-slate-400 font-bold">Téléphone</span>
                    <span className="font-bold text-slate-700">{selectedCustomer.phone || '—'}</span>
                  </div>
               </div>
               <div className="space-y-4">
                  <div className="flex gap-8">
                    <span className="w-24 text-slate-400 font-bold">Date</span>
                    <span className="font-bold text-slate-700">
                      {existingInvoice 
                        ? new Date(existingInvoice.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
                        : new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </span>
                  </div>
                  <div className="flex gap-8">
                    <span className="w-24 text-slate-400 font-bold">Devise</span>
                    <span className="text-[#00A09D] font-black">XAF (FCFA)</span>
                  </div>
               </div>
            </div>
          </div>

          <div className="flex border-b border-slate-100 px-10 mt-6">
            <button 
              onClick={() => setActiveTab('items')}
              className={`px-6 py-3 text-xs font-black uppercase tracking-widest transition-all border-b-2 
                ${activeTab === 'items' ? 'border-[#714B67] text-[#714B67]' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
            >
              <div className="flex items-center gap-2"><List size={14} /> Colis à facturer</div>
            </button>
            <button 
              onClick={() => setActiveTab('config')}
              className={`px-6 py-3 text-xs font-black uppercase tracking-widest transition-all border-b-2 
                ${activeTab === 'config' ? 'border-[#714B67] text-[#714B67]' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
            >
              <div className="flex items-center gap-2"><Settings size={14} /> Configuration</div>
            </button>
          </div>

          <div className="flex-1 p-0 flex flex-col bg-slate-50/30">
            {activeTab === 'items' ? (
              <div className="overflow-x-auto p-6">
                <table className="w-full text-left text-sm bg-white rounded-xl shadow-sm overflow-hidden border border-slate-100">
                  <thead>
                    <tr className="bg-slate-50 text-slate-400 uppercase text-[10px] font-black border-b border-slate-100">
                      <th className="px-6 py-4 w-10"></th>
                      <th className="px-6 py-4 font-black">Colis</th>
                      <th className="px-6 py-4 font-black">Mode</th>
                      <th className="px-6 py-4 font-black text-right">Qté</th>
                      <th className="px-6 py-4 font-black text-right">P.U (FCFA)</th>
                      <th className="px-6 py-4 font-black text-right">P.T (FCFA)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {availablePackages.map((pkg) => (
                      <tr key={pkg.id} className={`transition-colors group ${selectedPackageIds.has(pkg.id) ? 'bg-blue-50/30' : 'hover:bg-slate-50'}`}>
                        <td className="px-6 py-4">
                          <input 
                            type="checkbox" 
                            disabled={isFinal}
                            checked={selectedPackageIds.has(pkg.id)}
                            onChange={() => togglePackage(pkg.id)}
                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                             <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center text-slate-400">
                               <Package size={14} />
                             </div>
                             <div>
                               <p className="font-black text-slate-900">{pkg.tracking_number}</p>
                               <p className="text-[10px] text-slate-400 font-bold">{pkg.description || 'Sans description'}</p>
                             </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-500 px-2 py-1 rounded">
                            {pkg.transport_mode || 'Inconnu'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-slate-700">
                          {getPackageQteStr(pkg)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          {selectedPackageIds.has(pkg.id) ? (
                            <input 
                              type="number"
                              disabled={isFinal}
                              value={manualUnitPrices[pkg.id] ?? ''}
                              onChange={(e) => handlePriceChange(pkg.id, e.target.value)}
                              className="w-24 px-3 py-1.5 text-right font-black border border-slate-200 rounded focus:border-blue-500 outline-none text-slate-900 bg-white"
                            />
                          ) : (
                            <span className="text-slate-300 font-bold">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right font-black text-[#00A09D]">
                           {selectedPackageIds.has(pkg.id) ? (
                             ((manualUnitPrices[pkg.id] || 0) * getPackageQteValue(pkg)).toLocaleString('fr-FR')
                           ) : (
                             <span className="text-slate-300">—</span>
                           )}
                        </td>
                      </tr>
                    ))}
                    {availablePackages.length === 0 && (
                       <tr>
                         <td colSpan={6} className="py-20 text-center">
                            <div className="max-w-xs mx-auto space-y-3 opacity-30">
                               <Package size={40} className="mx-auto" />
                               <p className="text-sm font-black uppercase tracking-widest">Aucun colis réceptionné trouvé pour ce client</p>
                            </div>
                         </td>
                       </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-10 space-y-10 max-w-2xl">
                 <div className="space-y-4">
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                       <DollarSign size={14} className="text-[#00A09D]" /> Paramètres de Tarification
                    </h3>
                    <div className="bg-white p-8 rounded-xl border border-slate-200 space-y-6 shadow-sm">
                       <div className="flex items-center justify-between">
                          <div className="space-y-1">
                             <p className="text-sm font-bold text-slate-600">TVA Cameroun (19.25%)</p>
                             <p className="text-[10px] text-slate-400 font-bold uppercase">Appliquer la taxe réglementaire</p>
                          </div>
                          <button 
                            disabled={isFinal}
                            onClick={() => setIncludeVat(!includeVat)}
                            className={`w-12 h-6 rounded-full transition-all relative ${includeVat ? 'bg-[#00A09D]' : 'bg-slate-300'}`}
                          >
                             <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${includeVat ? 'left-7' : 'left-1'}`} />
                          </button>
                       </div>
                    </div>
                 </div>

                 <div className="bg-amber-50 p-6 rounded-xl border border-amber-100 flex gap-4">
                    <AlertCircle className="text-amber-600 shrink-0" size={20} />
                    <div className="space-y-1">
                       <p className="text-sm font-bold text-amber-900">Information importante</p>
                       <p className="text-xs text-amber-700 leading-relaxed font-medium">
                         Une facture "Brouillon" peut être modifiée à tout moment. Une fois "Comptabilisée" (Confirmée), elle ne pourra plus être éditée et sera disponible pour le client.
                       </p>
                    </div>
                 </div>
              </div>
            )}
          </div>

          <div className="p-10 bg-slate-50 border-t border-slate-100">
             <div className="flex justify-between items-start">
                <div className="max-w-md space-y-4">
                   <div className="flex items-center gap-2 text-slate-400 text-[10px] font-black uppercase">
                      <Info size={12} /> Conditions Générales
                   </div>
                   <p className="text-[10px] text-slate-400 leading-loose font-bold uppercase">
                     PAIEMENT À RÉCEPTION DE FACTURE. TOUT RETARD ENTRAÎNERA DES PÉNALITÉS DE RETARD AU TAUX LÉGAL EN VIGUEUR. MOG LOGISTICS - VOS COLIS, NOTRE PRIORITÉ.
                   </p>
                </div>
                <div className="w-80 space-y-2">
                   <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-400 font-bold">Montant hors taxes</span>
                      <span className="font-black text-slate-700">{ht.toLocaleString('fr-FR')} FCFA</span>
                   </div>
                   <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-400 font-bold">Remise Globale</span>
                      {isFinal ? (
                        <span className="font-black text-slate-700">- {discount.toLocaleString('fr-FR')} FCFA</span>
                      ) : (
                        <input 
                          type="number" 
                          value={discount || ''} 
                          onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                          className="w-24 px-2 py-1 text-right font-black border border-slate-200 rounded focus:border-blue-500 outline-none text-slate-900 bg-white"
                          placeholder="0"
                        />
                      )}
                   </div>
                   {includeVat && (
                     <div className="flex justify-between items-center text-sm mt-2">
                        <span className="text-slate-400 font-bold">TVA (19,25%)</span>
                        <span className="font-black text-slate-700">{vat.toLocaleString('fr-FR')} FCFA</span>
                     </div>
                   )}
                   <div className="h-px bg-slate-200 my-4" />
                   <div className="flex justify-between items-center">
                      <span className="text-slate-900 font-black uppercase text-xs tracking-widest">Total TTC</span>
                      <span className="font-black text-2xl text-slate-900">
                        {ttc.toLocaleString('fr-FR')} <span className="text-xs text-slate-400 ml-1">FCFA</span>
                      </span>
                   </div>
                   <div className="pt-4 flex justify-between items-center">
                      <span className="text-slate-400 font-bold text-xs">Montant dû</span>
                      <span className="font-black text-lg text-[#00A09D]">{ttc.toLocaleString('fr-FR')} FCFA</span>
                   </div>
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CreateInvoicePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen bg-slate-50"><Loader2 className="animate-spin text-blue-600" size={40} /></div>}>
      <CreateInvoiceContent />
    </Suspense>
  );
}
