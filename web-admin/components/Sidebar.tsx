'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Package, 
  Users, 
  ShieldCheck, 
  Settings, 
  FileText, 
  CreditCard, 
  ChevronRight,
  LogOut,
  Store,
  Warehouse,
  Tag
} from 'lucide-react';

const menuItems = [
  { name: 'Tableau de bord', href: '/', icon: LayoutDashboard },
  { name: 'Colis & Logistique', href: '/logistics', icon: Package },
  { name: 'Entrepôts & Stocks', href: '/entrepot', icon: Warehouse },
  { name: 'Guichet & Retraits', href: '/guichet', icon: Store },
  { name: 'Paiements & Factures', href: '/payments', icon: CreditCard },
  { name: 'Grille Tarifaire', href: '/tarifs', icon: Tag },
  { name: 'Clients', href: '/customers', icon: Users },
  { name: 'Équipe', href: '/team', icon: ShieldCheck },
  { name: 'Rapports', href: '/reports', icon: FileText },
  { name: 'Configuration', href: '/settings', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="flex h-screen w-72 flex-col bg-[#0F172A] text-slate-300 border-r border-slate-800">
      <div className="flex items-center gap-3 px-8 py-10">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/20">
          <Package className="text-white" size={24} />
        </div>
        <div>
          <span className="text-xl font-black tracking-tight text-white block leading-none">CargoLine</span>
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1 block">Logistics Admin</span>
        </div>
      </div>

      <div className="px-4 mb-4">
        <p className="px-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Menu Principal</p>
        <nav className="space-y-1">
          {menuItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`group flex items-center justify-between rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-200 ${
                  isActive 
                    ? 'bg-blue-600/10 text-blue-400' 
                    : 'hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <item.icon size={18} className={isActive ? 'text-blue-400' : 'text-slate-500 group-hover:text-slate-300'} />
                  {item.name}
                </div>
                {isActive && <div className="h-1.5 w-1.5 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.6)]" />}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="mt-auto p-4">
        <div className="rounded-2xl bg-slate-800/50 p-4 border border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-slate-700 to-slate-600 border border-slate-600 flex items-center justify-center overflow-hidden">
               <Users size={20} className="text-slate-400" />
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-bold text-white truncate">Winston Agent</p>
              <p className="text-[10px] text-slate-500 truncate">Super Administrateur</p>
            </div>
            <button className="text-slate-500 hover:text-red-400 transition-colors">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
