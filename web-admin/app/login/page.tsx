'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Package, Lock, Mail, Loader2, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('http://127.0.0.1:8000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('admin_token', data.access_token);
        localStorage.setItem('admin_user', JSON.stringify(data.user));
        router.push('/');
      } else {
        const err = await res.json();
        setError(err.detail || "Identifiants invalides");
      }
    } catch (err) {
      setError("Impossible de se connecter au serveur");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-blue-600 shadow-xl shadow-blue-500/20 mb-6">
            <Package className="text-white" size={32} />
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Cargo Admin</h1>
          <p className="text-slate-500 font-medium mt-2">Connectez-vous pour gérer la plateforme</p>
        </div>

        <div className="bg-white rounded-[32px] p-10 shadow-sm border border-slate-100">
          <form onSubmit={handleLogin} className="space-y-6">
            {error && (
              <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-sm font-bold animate-shake">
                <AlertCircle size={20} />
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] mb-2 ml-1">Email</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    required
                    type="email" 
                    className="w-full pl-12 pr-5 py-4 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none font-bold text-slate-700 transition-all bg-slate-50/30"
                    placeholder="admin@cargoline.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] mb-2 ml-1">Mot de passe</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    required
                    type="password" 
                    className="w-full pl-12 pr-5 py-4 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none font-bold text-slate-700 transition-all bg-slate-50/30"
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <button 
              disabled={loading}
              className="w-full bg-[#0F172A] text-white py-5 rounded-[22px] font-black text-xs uppercase tracking-[0.2em] hover:bg-slate-800 transition-all mt-4 shadow-xl shadow-slate-200 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : "Se connecter"}
            </button>
          </form>
        </div>
        
        <p className="text-center text-slate-400 text-xs font-bold mt-8 uppercase tracking-widest">
          © 2024 Cargo Tracker • Logistics Management
        </p>
      </div>
    </div>
  );
}
