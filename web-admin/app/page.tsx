'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  Package,
  Users,
  Search,
  Bell,
  ArrowUpRight,
  Ship,
  Plane,
  Clock,
  CheckCircle2,
  Loader2,
  CreditCard,
} from 'lucide-react';
import { API_BASE_URL } from '@/lib/api';

const DAY_LABELS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

function formatTrend(pct: number | null | undefined): string | null {
  if (pct === null || pct === undefined) return null;
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct}%`;
}

export default function Dashboard() {
  const [search, setSearch] = useState('');
  const [stats, setStats] = useState<any>(null);
  const [recentColis, setRecentColis] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) {
      window.location.href = '/login';
      return;
    }

    const fetchData = async () => {
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const [statsRes, colisRes] = await Promise.all([
          fetch(`${API_BASE_URL}/admin/stats`, { headers }),
          fetch(`${API_BASE_URL}/colis/?limit=10&skip=0`, { headers }),
        ]);

        if (statsRes.status === 401 || colisRes.status === 401) {
          localStorage.removeItem('admin_token');
          window.location.href = '/login';
          return;
        }

        if (statsRes.ok) setStats(await statsRes.json());
        if (colisRes.ok) {
          const data = await colisRes.json();
          setRecentColis(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error('Failed to fetch dashboard data', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const chartData = useMemo(() => {
    const trends = stats?.daily_trends || [];
    const maxCount = Math.max(...trends.map((d: any) => d.count || 0), 1);
    return trends.map((d: any) => ({
      ...d,
      heightPct: d.count > 0 ? Math.max(8, (d.count / maxCount) * 100) : 4,
      dayLabel: DAY_LABELS[new Date(d.date).getDay()],
    }));
  }, [stats]);

  const weekVolume = useMemo(() => {
    return (stats?.daily_trends || []).reduce((s: number, d: any) => s + (d.volume_cbm || 0), 0);
  }, [stats]);

  const filteredColis = useMemo(() => {
    if (!search.trim()) return recentColis;
    const q = search.toLowerCase();
    return recentColis.filter(
      c =>
        c.tracking_number?.toLowerCase().includes(q) ||
        c.owner_id?.toLowerCase().includes(q) ||
        c.description?.toLowerCase().includes(q),
    );
  }, [recentColis, search]);

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Vue d&apos;ensemble</h1>
          <p className="text-slate-500 font-medium mt-1">Bienvenue, voici le récapitulatif de votre activité.</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Rechercher un colis, un client..."
              className="w-80 rounded-2xl border border-slate-200 bg-white px-10 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button className="relative h-10 w-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors">
            <Bell size={18} />
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Chiffre d'Affaires"
          value={stats ? `${Number(stats.total_revenue || 0).toLocaleString('fr-FR')} FCFA` : '...'}
          trend={stats?.packages_week_change_pct != null ? `${stats.packages_this_week} colis / 7j` : null}
          icon={TrendingUp}
          color="blue"
          loading={loading}
        />
        <StatCard
          title="Colis Reçus"
          value={stats ? String(stats.packages_received ?? stats.total_packages ?? 0) : '...'}
          trend={formatTrend(stats?.packages_week_change_pct)}
          icon={Package}
          color="indigo"
          loading={loading}
        />
        <StatCard
          title="Groupages"
          value={stats ? String(stats.logistics_split?.total ?? 0) : '...'}
          trend={stats ? `${stats.open_containers ?? 0} ouverts` : null}
          icon={Ship}
          color="orange"
          loading={loading}
        />
        <StatCard
          title="Clients"
          value={stats ? String(stats.active_clients ?? 0) : '...'}
          trend={stats ? `Mer ${stats.logistics_split?.sea ?? 0} · Air ${stats.logistics_split?.air ?? 0}` : null}
          icon={Users}
          color="emerald"
          loading={loading}
        />
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">Dernières Opérations</h2>
            <Link href="/entrepot" className="text-sm font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1">
              Tout voir <ArrowUpRight size={14} />
            </Link>
          </div>

          <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
            {loading ? (
              <div className="p-12 flex flex-col items-center justify-center text-slate-400">
                <Loader2 className="animate-spin mb-2" />
                <p className="font-medium">Chargement des opérations...</p>
              </div>
            ) : (
              <table className="w-full text-left">
                <thead className="bg-slate-50/50 border-bottom border-slate-100">
                  <tr>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">ID Colis</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Client</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Statut</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Poids</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Entrepôt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredColis.slice(0, 8).map(item => {
                    const id = item.id || item._id;
                    return (
                      <tr
                        key={id}
                        className="hover:bg-slate-50/50 transition-colors cursor-pointer"
                        onClick={() => (window.location.href = `/colis/${id}`)}
                      >
                        <td className="px-6 py-4">
                          <span className="font-mono text-sm font-bold text-slate-900">{item.tracking_number}</span>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm font-semibold text-slate-700 truncate max-w-[180px]">{item.owner_id || '—'}</p>
                          <p className="text-[10px] text-slate-400">
                            {item.created_at ? new Date(item.created_at).toLocaleDateString('fr-FR') : '—'}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <StatusBadge status={item.status} />
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {item.transport_mode === 'sea' ? (
                              <Ship size={14} className="text-blue-500" />
                            ) : (
                              <Plane size={14} className="text-orange-500" />
                            )}
                            <span className="text-sm font-bold text-slate-600">{item.weight_real || 0} kg</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs font-bold text-slate-600 truncate max-w-[120px] block">
                            {item.current_entrepot_name || item.warehouse_location || '—'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredColis.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-400 font-medium">
                        {search ? 'Aucun résultat pour cette recherche.' : 'Aucun colis trouvé.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-bold text-slate-900">Activité de la semaine</h2>
          <div className="rounded-3xl bg-slate-900 p-6 text-white shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <TrendingUp size={120} />
            </div>
            <div className="relative z-10">
              <p className="text-slate-400 text-sm font-bold uppercase tracking-widest">Volume (7 jours)</p>
              <h3 className="text-4xl font-black mt-2">
                {loading ? '...' : weekVolume.toFixed(2)}{' '}
                <span className="text-lg font-bold text-slate-500">CBM</span>
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Total stocké : {stats ? Number(stats.total_volume_cbm || 0).toFixed(2) : '...'} CBM
              </p>
              <div className="mt-8 flex items-end gap-1.5 h-32">
                {loading ? (
                  <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">...</div>
                ) : (
                  chartData.map((d: any, i: number) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1 group cursor-default">
                      <span className="text-[9px] font-bold text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">
                        {d.count}
                      </span>
                      <div className="w-full rounded-t-lg bg-blue-500/20 relative flex-1 min-h-[8px]">
                        <div
                          className="absolute bottom-0 w-full rounded-t-lg bg-gradient-to-t from-blue-600 to-blue-400 transition-all duration-300"
                          style={{ height: `${d.heightPct}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="mt-2 flex justify-between text-[10px] font-bold text-slate-500 uppercase">
                {chartData.map((d: any, i: number) => (
                  <span key={i} className="flex-1 text-center">{d.dayLabel}</span>
                ))}
              </div>
            </div>
          </div>

          <Link href="/payments" className="block rounded-3xl bg-white border border-slate-100 p-6 shadow-sm hover:border-orange-200 transition-all">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-orange-50 text-orange-500 flex items-center justify-center">
                <CreditCard size={24} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Paiements en attente</p>
                <p className="text-xl font-black text-slate-900">
                  {loading ? '...' : `${stats?.pending_payments ?? 0} dossier${(stats?.pending_payments ?? 0) !== 1 ? 's' : ''}`}
                </p>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, trend, icon: Icon, color, loading }: any) {
  const colors: any = {
    blue: 'bg-blue-50 text-blue-600',
    indigo: 'bg-indigo-50 text-indigo-600',
    orange: 'bg-orange-50 text-orange-600',
    emerald: 'bg-emerald-50 text-emerald-600',
  };

  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-100 hover:border-blue-500/30 transition-all group">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-2xl ${colors[color]}`}>
          <Icon size={24} />
        </div>
        {trend && !loading && (
          <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-slate-50 text-slate-600 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors max-w-[120px] truncate text-right">
            {trend}
          </span>
        )}
      </div>
      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{title}</p>
      <p className="text-2xl font-black text-slate-900 mt-1">{loading ? '...' : value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const configs: Record<string, { label: string; bg: string; icon: any }> = {
    received: { label: 'Reçu', bg: 'bg-blue-50 text-blue-600', icon: Clock },
    loaded: { label: 'Groupé', bg: 'bg-violet-50 text-violet-600', icon: Package },
    departed: { label: 'Expédié', bg: 'bg-orange-50 text-orange-600', icon: Plane },
    in_transit: { label: 'En transit', bg: 'bg-sky-50 text-sky-600', icon: Ship },
    arrived: { label: 'Arrivé', bg: 'bg-emerald-50 text-emerald-600', icon: CheckCircle2 },
    pending_reception: { label: 'En attente', bg: 'bg-slate-50 text-slate-400', icon: Clock },
    delivered: { label: 'Livré', bg: 'bg-green-50 text-green-600', icon: CheckCircle2 },
    damaged: { label: 'Endommagé', bg: 'bg-red-50 text-red-600', icon: Clock },
  };

  const config = configs[status] || configs.pending_reception;
  const Icon = config.icon;

  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold ${config.bg}`}>
      <Icon size={12} />
      {config.label}
    </div>
  );
}
