'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ChevronLeft, Package, Building2, Truck, Clock, Loader2,
  ArrowRightLeft, Container, MapPin, History, AlertCircle
} from 'lucide-react';
import { API } from '@/lib/api';

const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('admin_token') ?? '' : '';

export default function ColisDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [pkg, setPkg] = useState<any>(null);
  const [entrepots, setEntrepots] = useState<any[]>([]);
  const [containers, setContainers] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [transferTo, setTransferTo] = useState('');
  const [transferNotes, setTransferNotes] = useState('');
  const [selectedContainer, setSelectedContainer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const headers = { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, eRes, cRes, hRes] = await Promise.all([
        fetch(`${API}/colis/${id}`, { headers: { Authorization: headers.Authorization } }),
        fetch(`${API}/entrepots/`, { headers: { Authorization: headers.Authorization } }),
        fetch(`${API}/groupages/`, { headers: { Authorization: headers.Authorization } }),
        fetch(`${API}/entrepots/package/${id}/history`, { headers: { Authorization: headers.Authorization } }),
      ]);
      if (pRes.status === 401) { window.location.href = '/login'; return; }
      if (pRes.ok) setPkg(await pRes.json());
      if (eRes.ok) setEntrepots(await eRes.json());
      if (cRes.ok) {
        const all = await cRes.json();
        setContainers(all.filter((c: any) => c.status === 'open'));
      }
      if (hRes.ok) {
        const h = await hRes.json();
        setHistory(h.history || []);
      }
    } catch {}
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const transfer = async () => {
    if (!transferTo) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch(`${API}/entrepots/transfer-package/${id}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ to_entrepot_id: transferTo, notes: transferNotes || undefined }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(data.message);
        load();
      } else {
        setMessage(data.detail || 'Erreur transfert');
      }
    } catch {
      setMessage('Erreur réseau');
    }
    setSubmitting(false);
  };

  const receiveAt = async (entrepotId: string) => {
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/entrepots/receive-package/${id}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ entrepot_id: entrepotId }),
      });
      const data = await res.json();
      if (res.ok) { setMessage(data.message); load(); }
      else setMessage(data.detail || 'Erreur');
    } catch {
      setMessage('Erreur réseau');
    }
    setSubmitting(false);
  };

  const assignGroupage = async () => {
    if (!selectedContainer) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/groupages/${selectedContainer}/add-package/${id}`, {
        method: 'POST',
        headers: { Authorization: headers.Authorization },
      });
      const data = await res.json();
      if (res.ok) { setMessage(data.message); load(); }
      else setMessage(data.detail || 'Erreur');
    } catch {
      setMessage('Erreur réseau');
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="animate-spin text-blue-600" size={40} />
      </div>
    );
  }

  if (!pkg) {
    return (
      <div className="p-8 text-center">
        <AlertCircle className="mx-auto text-red-400 mb-4" size={48} />
        <p className="font-bold text-slate-600">Colis non trouvé</p>
        <button onClick={() => router.back()} className="mt-4 text-blue-600 font-bold">Retour</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-100 px-8 py-6 flex items-center gap-4">
        <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-slate-100">
          <ChevronLeft size={24} />
        </button>
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Détail Colis</p>
          <h1 className="text-2xl font-black text-slate-900 font-mono">{pkg.tracking_number}</h1>
        </div>
        <span className="ml-auto px-3 py-1 rounded-xl bg-blue-50 text-blue-700 text-xs font-black uppercase">{pkg.status}</span>
      </div>

      {message && (
        <div className="mx-8 mt-4 p-4 bg-emerald-50 text-emerald-800 rounded-xl font-bold text-sm">{message}</div>
      )}

      <div className="p-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <section className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
            <h2 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Package size={16} /> Informations
            </h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><p className="text-slate-400 font-bold text-xs">Client</p><p className="font-black">{pkg.owner_id}</p></div>
              <div><p className="text-slate-400 font-bold text-xs">Description</p><p className="font-bold">{pkg.description || '—'}</p></div>
              <div><p className="text-slate-400 font-bold text-xs">Poids réel</p><p className="font-bold">{pkg.weight_real || '—'} kg</p></div>
              <div><p className="text-slate-400 font-bold text-xs">Entrepôt actuel</p><p className="font-bold">{pkg.current_entrepot_name || 'Non assigné'}</p></div>
              {pkg.container_id && (
                <div><p className="text-slate-400 font-bold text-xs">Groupage</p><p className="font-bold font-mono">{pkg.container_id.slice(0, 8)}…</p></div>
              )}
            </div>
          </section>

          <section className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
            <h2 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <History size={16} /> Historique entrepôts
            </h2>
            {history.length === 0 ? (
              <p className="text-slate-400 text-sm">Aucun mouvement enregistré.</p>
            ) : (
              <div className="space-y-3">
                {history.map((h: any, i: number) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                    <Building2 size={16} className="text-blue-500" />
                    <div className="flex-1">
                      <p className="font-black text-sm">{h.entrepot_name}</p>
                      <p className="text-xs text-slate-400">{h.city} · {h.operator}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold">{new Date(h.arrived_at).toLocaleDateString('fr-FR')}</p>
                      <p className="text-[10px] text-slate-400">{h.dwell_days}j en stock</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <section className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
            <h2 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <ArrowRightLeft size={16} /> Transfert entrepôt
            </h2>
            <select
              className="w-full border border-slate-200 rounded-xl p-3 text-sm font-bold mb-3"
              value={transferTo}
              onChange={e => setTransferTo(e.target.value)}
            >
              <option value="">Choisir destination…</option>
              {entrepots.map(e => (
                <option key={e.id} value={e.id}>{e.name} ({e.city})</option>
              ))}
            </select>
            <input
              className="w-full border border-slate-200 rounded-xl p-3 text-sm mb-3"
              placeholder="Notes (optionnel)"
              value={transferNotes}
              onChange={e => setTransferNotes(e.target.value)}
            />
            <button
              onClick={transfer}
              disabled={!transferTo || submitting}
              className="w-full bg-blue-600 text-white font-black py-3 rounded-xl disabled:opacity-50"
            >
              {submitting ? 'En cours…' : 'Transférer'}
            </button>
          </section>

          <section className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
            <h2 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <MapPin size={16} /> Réception entrepôt
            </h2>
            <div className="space-y-2">
              {entrepots.map(e => (
                <button
                  key={e.id}
                  onClick={() => receiveAt(e.id)}
                  disabled={submitting}
                  className="w-full text-left p-3 rounded-xl border border-slate-100 hover:border-blue-300 hover:bg-blue-50 transition-all"
                >
                  <p className="font-black text-sm">{e.name}</p>
                  <p className="text-xs text-slate-400">{e.city} · {e.type}</p>
                </button>
              ))}
            </div>
          </section>

          <section className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
            <h2 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Container size={16} /> Affecter au groupage
            </h2>
            <select
              className="w-full border border-slate-200 rounded-xl p-3 text-sm font-bold mb-3"
              value={selectedContainer}
              onChange={e => setSelectedContainer(e.target.value)}
            >
              <option value="">Conteneur ouvert…</option>
              {containers.map(c => (
                <option key={c.id} value={c.id}>{c.container_number} ({c.mode || c.transport_mode})</option>
              ))}
            </select>
            <button
              onClick={assignGroupage}
              disabled={!selectedContainer || submitting}
              className="w-full bg-violet-600 text-white font-black py-3 rounded-xl disabled:opacity-50"
            >
              Affecter au groupage
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
