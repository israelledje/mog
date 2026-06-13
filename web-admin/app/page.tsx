'use client';

import { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Package, 
  Users, 
  Search, 
  Bell, 
  Filter, 
  MoreVertical, 
  ArrowUpRight, 
  Ship, 
  Plane,
  Clock,
  CheckCircle2,
  Loader2
} from 'lucide-react';

const API_BASE_URL = 'http://127.0.0.1:8000/api';

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
        const headers = { 'Authorization': `Bearer ${token}` };
        const [statsRes, colisRes] = await Promise.all([
          fetch(`${API_BASE_URL}/admin/stats`, { headers }),
          fetch(`${API_BASE_URL}/colis`, { headers })
        ]);
        
        if (statsRes.status === 401) {
          localStorage.removeItem('admin_token');
          window.location.href = '/login';
          return;
        }

        if (statsRes.ok) setStats(await statsRes.json());
        if (colisRes.ok) setRecentColis(await colisRes.json());
      } catch (err) {
        console.error("Failed to fetch dashboard data", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <div className="p-8 space-y-8">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Vue d'ensemble</h1>
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
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button className="relative h-10 w-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors">
            <Bell size={18} />
            <div className="absolute top-2 right-2 h-2 w-2 rounded-full bg-red-500 border-2 border-white" />
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard 
          title="Chiffre d'Affaires" 
          value={stats ? `${stats.total_revenue.toLocaleString()} FCFA` : '...'} 
          trend="+12.5%" 
          icon={TrendingUp} 
          color="blue"
        />
        <StatCard 
          title="Colis Reçus" 
          value={stats ? stats.total_packages.toString() : '...'} 
          trend="+8%" 
          icon={Package} 
          color="indigo"
        />
        <StatCard 
          title="Conteneurs" 
          value={stats ? (stats.logistics_split.sea + stats.logistics_split.air).toString() : '...'} 
          trend="+2" 
          icon={Ship} 
          color="orange"
        />
        <StatCard 
          title="Clients Actifs" 
          value="456" 
          trend="+14%" 
          icon={Users} 
          color="emerald"
        />
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Recent Packages Table */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">Dernières Opérations</h2>
            <button className="text-sm font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1">
              Tout voir <ArrowUpRight size={14} />
            </button>
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
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentColis.slice(0, 5).map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <span className="font-mono text-sm font-bold text-slate-900">{item.tracking_number}</span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-semibold text-slate-700">{item.supplier_name || 'Inconnu'}</p>
                        <p className="text-[10px] text-slate-400">{new Date(item.created_at).toLocaleDateString()}</p>
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={item.status} />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {item.transport_mode === 'sea' ? <Ship size={14} className="text-blue-500" /> : <Plane size={14} className="text-orange-500" />}
                          <span className="text-sm font-bold text-slate-600">{item.weight_real || 0} kg</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className="p-2 rounded-lg hover:bg-slate-100 text-slate-400">
                          <MoreVertical size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {recentColis.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-400 font-medium">Aucun colis trouvé.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Side Widget: Volume Trend */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-slate-900">Activité de la semaine</h2>
          <div className="rounded-3xl bg-slate-900 p-6 text-white shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <TrendingUp size={120} />
            </div>
            <div className="relative z-10">
              <p className="text-slate-400 text-sm font-bold uppercase tracking-widest">Total Volume</p>
              <h3 className="text-4xl font-black mt-2">124.5 <span className="text-lg font-bold text-slate-500">CBM</span></h3>
              <div className="mt-8 flex items-end gap-1.5 h-32">
                {[40, 60, 45, 80, 55, 90, 70].map((h, i) => (
                  <div key={i} className="flex-1 rounded-t-lg bg-blue-500/20 group cursor-pointer relative">
                    <div 
                      className="absolute bottom-0 w-full rounded-t-lg bg-gradient-to-t from-blue-600 to-blue-400 group-hover:from-blue-500 group-hover:to-indigo-400 transition-all duration-300"
                      style={{ height: `${h}%` }}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-4 flex justify-between text-[10px] font-bold text-slate-500 uppercase">
                <span>Lun</span>
                <span>Dim</span>
              </div>
            </div>
          </div>

          <div className="rounded-3xl bg-white border border-slate-100 p-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-orange-50 text-orange-500 flex items-center justify-center">
                <Clock size={24} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Paiements en attente</p>
                <p className="text-xl font-black text-slate-900">24 dossiers</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, trend, icon: Icon, color }: any) {
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
        <span className="text-xs font-bold px-2 py-1 rounded-lg bg-slate-50 text-slate-600 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">{trend}</span>
      </div>
      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{title}</p>
      <p className="text-2xl font-black text-slate-900 mt-1">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const configs: any = {
    received: { label: 'Reçu', bg: 'bg-blue-50 text-blue-600', icon: Clock },
    departed: { label: 'Expédié', bg: 'bg-orange-50 text-orange-600', icon: Plane },
    arrived: { label: 'Arrivé', bg: 'bg-emerald-50 text-emerald-600', icon: CheckCircle2 },
    pending_reception: { label: 'En attente', bg: 'bg-slate-50 text-slate-400', icon: Clock },
    delivered: { label: 'Livré', bg: 'bg-green-50 text-green-600', icon: CheckCircle2 },
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
