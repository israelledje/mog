'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ChevronLeft, Package, Building2, Clock, Loader2,
  ArrowRightLeft, Container, MapPin, History, AlertCircle,
  Truck, Image as ImageIcon, User, Scale, Box, CheckCircle2
} from 'lucide-react';
import { API } from '@/lib/api';

const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('admin_token') ?? '' : '';

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  draft: { label: 'Brouillon', cls: 'bg-slate-100 text-slate-600' },
  pending_reception: { label: 'En attente réception', cls: 'bg-amber-50 text-amber-700' },
  received: { label: 'Réceptionné (Chine)', cls: 'bg-blue-50 text-blue-700' },
  grouped: { label: 'Groupé', cls: 'bg-violet-50 text-violet-700' },
  loaded: { label: 'Chargé', cls: 'bg-violet-50 text-violet-700' },
  closed: { label: 'Groupage clôturé', cls: 'bg-indigo-50 text-indigo-700' },
  departed: { label: 'Parti', cls: 'bg-sky-50 text-sky-700' },
  in_transit: { label: 'En transit', cls: 'bg-sky-50 text-sky-700' },
  customs: { label: 'En douane', cls: 'bg-amber-50 text-amber-800' },
  arrived: { label: 'Entrepôt destination', cls: 'bg-emerald-50 text-emerald-700' },
  distributed: { label: 'Distribué', cls: 'bg-emerald-100 text-emerald-800' },
  delivered: { label: 'Retiré', cls: 'bg-slate-200 text-slate-700' },
  damaged: { label: 'Anomalie', cls: 'bg-red-50 text-red-700' },
};

const ORIGIN_OK = new Set(['draft', 'pending_reception', 'received']);
const DEST_OK = new Set(['in_transit', 'departed', 'customs', 'arrived', 'distributed']);

function photoSrc(url: string) {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return url.startsWith('/') ? url : `/${url}`;
}

export default function ColisDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [pkg, setPkg] = useState<any>(null);
  const [entrepots, setEntrepots] = useState<any[]>([]);
  const [containers, setContainers] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [customer, setCustomer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [transferTo, setTransferTo] = useState('');
  const [transferNotes, setTransferNotes] = useState('');
  const [selectedContainer, setSelectedContainer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const auth = { Authorization: `Bearer ${getToken()}` };
  const jsonHeaders = { ...auth, 'Content-Type': 'application/json' };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, eRes, cRes, hRes] = await Promise.all([
        fetch(`${API}/colis/${id}`, { headers: auth }),
        fetch(`${API}/entrepots/`, { headers: auth }),
        fetch(`${API}/groupages/`, { headers: auth }),
        fetch(`${API}/entrepots/package/${id}/history`, { headers: auth }),
      ]);
      if (pRes.status === 401) { window.location.href = '/login'; return; }
      let packageData: any = null;
      if (pRes.ok) {
        packageData = await pRes.json();
        setPkg(packageData);
      }
      if (eRes.ok) setEntrepots(await eRes.json());
      if (cRes.ok) {
        const all = await cRes.json();
        setContainers(all.filter((c: any) => c.status === 'open'));
      }
      if (hRes.ok) {
        const h = await hRes.json();
        setHistory(h.history || []);
      }
      if (packageData?.owner_id) {
        const custRes = await fetch(`${API}/admin/customers`, { headers: auth });
        if (custRes.ok) {
          const list = await custRes.json();
          const match = list.find(
            (u: any) => String(u.email || '').toLowerCase() === String(packageData.owner_id).toLowerCase()
          );
          setCustomer(match || null);
        }
      }
    } catch {}
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const statusCfg = STATUS_LABELS[pkg?.status] || { label: pkg?.status || '—', cls: 'bg-slate-100 text-slate-600' };
  const originWh = useMemo(() => entrepots.filter((e) => e.type === 'origin'), [entrepots]);
  const destWh = useMemo(() => entrepots.filter((e) => e.type === 'destination'), [entrepots]);

  const canReceiveOrigin = pkg && ORIGIN_OK.has(pkg.status);
  const canReceiveDest = pkg && DEST_OK.has(pkg.status);
  const canAssignGroupage = pkg && ['received', 'grouped', 'loaded'].includes(pkg.status) && !pkg.container_id;
  const canTransfer = pkg && !['delivered', 'draft'].includes(pkg.status);

  const runAction = async (fn: () => Promise<void>) => {
    setSubmitting(true);
    setMessage(null);
    setError(null);
    try {
      await fn();
    } catch {
      setError('Erreur réseau');
    }
    setSubmitting(false);
  };

  const transfer = () => runAction(async () => {
    if (!transferTo) return;
    const res = await fetch(`${API}/entrepots/transfer-package/${id}`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ to_entrepot_id: transferTo, notes: transferNotes || undefined }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) { setMessage(data.message); load(); }
    else setError(data.detail || 'Erreur transfert');
  });

  const receiveAt = (entrepotId: string) => runAction(async () => {
    const res = await fetch(`${API}/entrepots/receive-package/${id}`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ entrepot_id: entrepotId }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      const n = data.notification;
      const extra = n?.success
        ? ` · Notif ${n.channel || 'ok'}`
        : n ? ` · Notif échouée` : '';
      setMessage(`${data.message}${extra}`);
      load();
    } else setError(typeof data.detail === 'string' ? data.detail : 'Erreur réception');
  });

  const assignGroupage = () => runAction(async () => {
    if (!selectedContainer) return;
    const res = await fetch(`${API}/groupages/${selectedContainer}/add-package/${id}`, {
      method: 'POST',
      headers: auth,
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) { setMessage(data.message); load(); }
    else setError(data.detail || 'Erreur');
  });

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

  const photos: string[] = pkg.photos || [];

  return (
    <div className="min-h-screen bg-slate-50/60">
      <div className="bg-white border-b border-slate-100 px-6 md:px-8 py-5 sticky top-0 z-20">
        <div className="flex flex-wrap items-center gap-4 max-w-7xl mx-auto">
          <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-slate-100">
            <ChevronLeft size={22} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Détail colis</p>
            <h1 className="text-xl md:text-2xl font-black text-slate-900 font-mono truncate">{pkg.tracking_number}</h1>
          </div>
          <span className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider ${statusCfg.cls}`}>
            {statusCfg.label}
          </span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 md:px-8 py-6 space-y-4">
        {message && (
          <div className="p-4 bg-emerald-50 text-emerald-800 rounded-2xl font-bold text-sm flex items-center gap-2">
            <CheckCircle2 size={18} /> {message}
          </div>
        )}
        {error && (
          <div className="p-4 bg-red-50 text-red-700 rounded-2xl font-bold text-sm flex items-center gap-2">
            <AlertCircle size={18} /> {error}
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* LEFT: identity + media + timeline */}
          <div className="xl:col-span-7 space-y-6">
            <section className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
              <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-5 flex items-center gap-2">
                <Package size={14} /> Identité & client
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-sm">
                <Info icon={User} label="Client" value={customer?.full_name || pkg.owner_id} sub={pkg.owner_id} />
                <Info icon={MapPin} label="Ville client" value={customer?.city || '—'} sub={customer?.phone} />
                <Info icon={Box} label="Description" value={pkg.description || '—'} />
                <Info icon={Truck} label="Mode" value={(pkg.transport_mode || 'sea').toUpperCase()} />
                <Info icon={Scale} label="Poids réel" value={pkg.weight_real ? `${pkg.weight_real} kg` : '—'} />
                <Info icon={Building2} label="Entrepôt actuel" value={pkg.current_entrepot_name || 'Non assigné'} />
                {pkg.container_id && (
                  <Info icon={Container} label="Groupage" value={String(pkg.container_id).slice(0, 12) + '…'} />
                )}
                <Info
                  icon={Clock}
                  label="Paiement"
                  value={pkg.payment_status || 'pending'}
                  sub={pkg.total_price ? `${Number(pkg.total_price).toLocaleString()} FCFA` : undefined}
                />
              </div>
            </section>

            <section className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
              <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <ImageIcon size={14} /> Photos ({photos.length})
              </h2>
              {photos.length === 0 ? (
                <p className="text-slate-400 text-sm font-medium">Aucune photo associée.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {photos.map((p, i) => (
                    <a key={i} href={photoSrc(p)} target="_blank" rel="noreferrer" className="block aspect-square rounded-2xl overflow-hidden bg-slate-100 border border-slate-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photoSrc(p)} alt={`photo-${i}`} className="w-full h-full object-cover" />
                    </a>
                  ))}
                </div>
              )}
            </section>

            <section className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
              <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <History size={14} /> Historique entrepôts
              </h2>
              {history.length === 0 ? (
                <p className="text-slate-400 text-sm">Aucun mouvement enregistré.</p>
              ) : (
                <div className="space-y-3">
                  {history.map((h: any, i: number) => (
                    <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                      <Building2 size={16} className="text-blue-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-sm truncate">{h.entrepot_name}</p>
                        <p className="text-xs text-slate-400">{h.city} · {h.type} · {h.operator}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-bold">{new Date(h.arrived_at).toLocaleDateString('fr-FR')}</p>
                        <p className="text-[10px] text-slate-400">{h.dwell_days}j</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {(pkg.timeline || []).length > 0 && (
              <section className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
                <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Clock size={14} /> Timeline statut
                </h2>
                <div className="space-y-2">
                  {[...(pkg.timeline || [])].reverse().slice(0, 8).map((t: any, i: number) => (
                    <div key={i} className="flex gap-3 text-sm border-l-2 border-slate-200 pl-3 py-1">
                      <div className="flex-1">
                        <p className="font-bold text-slate-800">{t.label || t.status}</p>
                        <p className="text-xs text-slate-400">{t.location || '—'}</p>
                      </div>
                      <p className="text-[10px] text-slate-400 font-bold whitespace-nowrap">
                        {t.timestamp ? new Date(t.timestamp).toLocaleString('fr-FR') : ''}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* RIGHT: contextual actions */}
          <div className="xl:col-span-5 space-y-6">
            <section className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
              <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                <MapPin size={14} /> Réception entrepôt
              </h2>
              <p className="text-xs text-slate-500 mb-4">
                Origine = réception Chine (sans transit). Destination = uniquement après transit.
              </p>

              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Origine (Chine)</p>
              <div className="space-y-2 mb-5">
                {originWh.length === 0 && <p className="text-xs text-slate-400">Aucun entrepôt origine.</p>}
                {originWh.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => receiveAt(e.id)}
                    disabled={submitting || !canReceiveOrigin}
                    className="w-full text-left p-3 rounded-xl border border-slate-100 hover:border-blue-300 hover:bg-blue-50 transition-all disabled:opacity-40 disabled:hover:bg-white disabled:hover:border-slate-100"
                  >
                    <p className="font-black text-sm">{e.name}</p>
                    <p className="text-xs text-slate-400">{e.city}</p>
                  </button>
                ))}
                {!canReceiveOrigin && (
                  <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                    Réception origine indisponible pour le statut « {statusCfg.label} ».
                  </p>
                )}
              </div>

              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Destination (Cameroun)</p>
              <div className="space-y-2">
                {destWh.length === 0 && <p className="text-xs text-slate-400">Aucun entrepôt destination.</p>}
                {destWh.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => receiveAt(e.id)}
                    disabled={submitting || !canReceiveDest}
                    className="w-full text-left p-3 rounded-xl border border-slate-100 hover:border-emerald-300 hover:bg-emerald-50 transition-all disabled:opacity-40 disabled:hover:bg-white disabled:hover:border-slate-100"
                  >
                    <p className="font-black text-sm">{e.name}</p>
                    <p className="text-xs text-slate-400">{e.city}</p>
                  </button>
                ))}
                {!canReceiveDest && (
                  <p className="text-[11px] text-red-700 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                    Réception destination bloquée : le colis doit d&apos;abord être passé en transit / douane.
                  </p>
                )}
              </div>
            </section>

            <section className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
              <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Container size={14} /> Affecter au groupage
              </h2>
              {!canAssignGroupage ? (
                <p className="text-xs text-slate-500">
                  {pkg.container_id
                    ? 'Déjà rattaché à un groupage.'
                    : 'Disponible après réception Chine (statut reçu).'}
                </p>
              ) : (
                <>
                  <select
                    className="w-full border border-slate-200 rounded-xl p-3 text-sm font-bold mb-3 bg-slate-50"
                    value={selectedContainer}
                    onChange={(e) => setSelectedContainer(e.target.value)}
                  >
                    <option value="">Conteneur ouvert…</option>
                    {containers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.container_number} ({c.mode || c.transport_mode})
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={assignGroupage}
                    disabled={!selectedContainer || submitting}
                    className="w-full bg-violet-600 text-white font-black py-3 rounded-xl disabled:opacity-50"
                  >
                    Affecter au groupage
                  </button>
                </>
              )}
            </section>

            <section className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
              <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <ArrowRightLeft size={14} /> Transfert entrepôt
              </h2>
              {!canTransfer ? (
                <p className="text-xs text-slate-500">Transfert indisponible pour ce statut.</p>
              ) : (
                <>
                  <select
                    className="w-full border border-slate-200 rounded-xl p-3 text-sm font-bold mb-3 bg-slate-50"
                    value={transferTo}
                    onChange={(e) => setTransferTo(e.target.value)}
                  >
                    <option value="">Choisir destination…</option>
                    {entrepots.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name} ({e.city}) — {e.type}
                      </option>
                    ))}
                  </select>
                  <input
                    className="w-full border border-slate-200 rounded-xl p-3 text-sm mb-3 bg-slate-50"
                    placeholder="Notes (optionnel)"
                    value={transferNotes}
                    onChange={(e) => setTransferNotes(e.target.value)}
                  />
                  <button
                    onClick={transfer}
                    disabled={!transferTo || submitting}
                    className="w-full bg-blue-600 text-white font-black py-3 rounded-xl disabled:opacity-50"
                  >
                    {submitting ? 'En cours…' : 'Transférer'}
                  </button>
                </>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function Info({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: any;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="flex gap-3">
      <div className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center shrink-0">
        <Icon size={16} className="text-slate-400" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{label}</p>
        <p className="font-black text-slate-900 truncate">{value}</p>
        {sub && <p className="text-xs text-slate-400 truncate">{sub}</p>}
      </div>
    </div>
  );
}
