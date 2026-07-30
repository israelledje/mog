'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  Users,
  ShieldCheck,
  Settings,
  FileText,
  CreditCard,
  LogOut,
  Store,
  Warehouse,
  Tag,
  ShoppingBag,
  Percent,
  Handshake,
} from 'lucide-react';
import { useEffect, useState } from 'react';

const menuItems = [
  { name: 'Tableau de bord', href: '/', icon: LayoutDashboard },
  { name: 'Colis & Logistique', href: '/logistics', icon: Package },
  { name: 'Entrepôts & Stocks', href: '/entrepot', icon: Warehouse },
  { name: 'Guichet & Retraits', href: '/guichet', icon: Store },
  { name: 'Marketplace', href: '/marketplace', icon: ShoppingBag },
  { name: 'Codes promo', href: '/promos', icon: Percent },
  { name: 'Commerciaux', href: '/commerciaux', icon: Handshake },
  { name: 'Paiements & Factures', href: '/payments', icon: CreditCard },
  { name: 'Grille Tarifaire', href: '/tarifs', icon: Tag },
  { name: 'Clients', href: '/customers', icon: Users },
  { name: 'Équipe', href: '/team', icon: ShieldCheck },
  { name: 'Rapports', href: '/reports', icon: FileText },
  { name: 'Configuration', href: '/settings', icon: Settings },
  { name: 'WhatsApp / SMS', href: '/whatsapp', icon: ShieldCheck },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [adminName, setAdminName] = useState('Administrateur');
  const [adminRole, setAdminRole] = useState('Admin');

  useEffect(() => {
    try {
      const raw = localStorage.getItem('admin_user');
      if (!raw) return;
      const user = JSON.parse(raw);
      setAdminName(user.full_name || user.name || user.email || 'Administrateur');
      setAdminRole(user.role === 'operator' ? 'Opérateur' : 'Super Administrateur');
    } catch {
      /* ignore */
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    router.push('/login');
  };

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col overflow-hidden border-r border-slate-800 bg-[#0F172A] text-slate-300 lg:w-72">
      <div className="flex shrink-0 items-center gap-3 px-5 py-6 lg:px-6">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/20">
          <Package className="text-white" size={22} />
        </div>
        <div className="min-w-0">
          <span className="block truncate text-lg font-black leading-none tracking-tight text-white">MOG Admin</span>
          <span className="mt-1 block text-[10px] font-bold uppercase tracking-widest text-slate-500">Logistics Console</span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">Menu Principal</p>
        <nav className="space-y-0.5">
          {menuItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-200 ${
                  isActive
                    ? 'bg-blue-600/10 text-blue-400'
                    : 'hover:bg-slate-800 hover:text-white'
                }`}
              >
                <item.icon size={17} className={`shrink-0 ${isActive ? 'text-blue-400' : 'text-slate-500 group-hover:text-slate-300'}`} />
                <span className="min-w-0 flex-1 truncate">{item.name}</span>
                {isActive && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.6)]" />}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="shrink-0 border-t border-slate-800 p-3">
        <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-600 bg-gradient-to-tr from-slate-700 to-slate-600">
              <Users size={16} className="text-slate-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-white">{adminName}</p>
              <p className="truncate text-[10px] text-slate-500">{adminRole}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-600/80 bg-slate-900/60 px-3 py-2 text-xs font-bold text-slate-300 transition-colors hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-400"
          >
            <LogOut size={14} />
            Déconnexion
          </button>
        </div>
      </div>
    </aside>
  );
}
