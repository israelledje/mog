'use client';

import { useState, useEffect } from 'react';
import { Users, UserPlus, ShieldCheck, Mail, Phone, MoreVertical, X, Loader2, Check, AlertCircle, QrCode, Share2, Edit2, Trash2 } from 'lucide-react';
import { API_BASE_URL } from '@/lib/api';

export default function TeamPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: '',
    phone: '',
    role: 'operator',
    city: 'Douala',
    gender: 'male'
  });

  const fetchUsers = async () => {
    const token = localStorage.getItem('admin_token');
    if (!token) {
      window.location.href = '/login';
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/admin/team`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.status === 401) {
        localStorage.removeItem('admin_token');
        window.location.href = '/login';
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (err) {
      console.error("Failed to fetch users", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleOpenCreate = () => {
    setIsEditing(false);
    setSelectedUserId(null);
    setFormData({ full_name: '', email: '', password: '', phone: '', role: 'operator', city: 'Douala', gender: 'male' });
    setError(null);
    setShowModal(true);
  };

  const handleOpenEdit = (user: any) => {
    setIsEditing(true);
    setSelectedUserId(user.id);
    setFormData({
      full_name: user.full_name || '',
      email: user.email || '',
      password: '', // Leave empty for edit
      phone: user.phone || '',
      role: user.role || 'operator',
      city: user.city || 'Douala',
      gender: user.gender || 'male'
    });
    setError(null);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('admin_token');
      
      if (isEditing) {
        const payload: any = {
          full_name: formData.full_name,
          phone: formData.phone,
          city: formData.city,
          email: formData.email
        };
        // Add password only if provided during edit
        if (formData.password) payload.password = formData.password;

        const res = await fetch(`${API_BASE_URL}/admin/users/${selectedUserId}`, {
          method: 'PATCH',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });
        
        if (res.ok) {
          setShowModal(false);
          fetchUsers();
        } else {
          const errData = await res.json();
          setError(errData.detail || "Erreur lors de la modification");
        }
      } else {
        const res = await fetch(`${API_BASE_URL}/admin/users`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(formData)
        });
        
        if (res.ok) {
          setShowModal(false);
          fetchUsers();
        } else {
          const errData = await res.json();
          setError(errData.detail || "Erreur lors de la création");
        }
      }
    } catch (err) {
      setError("Impossible de contacter le serveur backend");
    } finally {
      setSubmitting(false);
    }
  };

  const handleWhatsApp = (user: any) => {
    const message = `Bonjour ${user.full_name}, voici tes accès Cargo Tracker :\n\n📧 Email: ${user.email}\n🔑 Password: (celui défini par l'admin)\n\nTu peux te connecter via le QR Code sur ton badge professionnel.`;
    const encoded = encodeURIComponent(message);
    const phone = user.phone?.replace(/\D/g, '') || '';
    window.open(`https://wa.me/${phone}?text=${encoded}`, '_blank');
  };

  const generateBadge = (user: any) => {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${user.badge_secret || user.email}&bgcolor=ffffff&color=0f172a&margin=1`;
    const avatarUrl = user.gender === 'female' 
      ? 'https://cdn-icons-png.flaticon.com/512/6997/6997674.png' 
      : 'https://cdn-icons-png.flaticon.com/512/6997/6997662.png';
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Badge - ${user.full_name}</title>
            <style>
              @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
              body { font-family: 'Inter', sans-serif; margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #f8fafc; }
              .badge { width: 2.125in; height: 3.375in; background: white; border-radius: 12px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1); overflow: hidden; position: relative; border: 1px solid #e2e8f0; display: flex; flex-direction: column; }
              .header { background: #0f172a; padding: 15px; text-align: center; color: white; }
              .logo { font-weight: 900; font-size: 14pt; letter-spacing: 1px; }
              .content { flex: 1; display: flex; flex-direction: column; align-items: center; padding: 15px; text-align: center; justify-content: space-between; }
              .avatar-container { width: 80px; height: 80px; border-radius: 20px; overflow: hidden; margin: -40px auto 10px auto; border: 4px solid white; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); background: #f1f5f9; }
              .avatar-img { width: 100%; height: 100%; object-fit: cover; }
              .name { font-weight: 900; font-size: 12pt; color: #0f172a; margin-bottom: 4px; }
              .role-badge { display: inline-block; padding: 4px 10px; background: #e0e7ff; color: #4338ca; font-weight: 900; font-size: 7pt; border-radius: 100px; text-transform: uppercase; letter-spacing: 1px; }
              .qr-code { width: 90px; height: 90px; margin: 10px 0; }
              .footer-text { font-size: 6pt; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-top: auto; }
              .user-id { font-size: 8pt; color: #0f172a; font-weight: 900; font-family: monospace; }
              @media print { body { background: white; } .badge { box-shadow: none; border: 1px solid #000; } }
            </style>
          </head>
          <body>
            <div class="badge">
              <div class="header">
                <div class="logo">MOG LOGISTICS</div>
                <div style="font-size: 5pt; font-weight: 800; opacity: 0.6; letter-spacing: 2pt;">STAFF IDENTITY</div>
              </div>
              
              <div class="avatar-container">
                <img src="${avatarUrl}" class="avatar-img" />
              </div>

              <div class="content">
                <div class="user-details">
                  <div class="name">${user.full_name}</div>
                  <div class="role-badge">${user.role === 'admin' ? 'Administrateur' : 'Opérateur'}</div>
                </div>

                <div class="qr-section">
                  <img src="${qrUrl}" class="qr-code" />
                  <div class="user-id">ID: ${user.email.split('@')[0].toUpperCase()}</div>
                  <div class="footer-text">Security Access Card</div>
                </div>
              </div>
            </div>
            <script>
              window.onload = () => {
                setTimeout(() => { 
                  window.print(); 
                }, 1000);
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-4">
            <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-500/20">
              <Users size={28} />
            </div>
            Gestion d'Équipe
          </h1>
          <p className="text-slate-500 font-medium mt-3 text-lg">
            Gérez les comptes de vos collaborateurs, attribuez les rôles et générez les badges d'accès.
          </p>
        </div>
        <button 
          onClick={handleOpenCreate}
          className="flex items-center gap-2 bg-slate-900 text-white px-6 py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg active:scale-95"
        >
          <UserPlus size={20} /> Ajouter un collaborateur
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center h-64 text-slate-400">
          <Loader2 className="animate-spin mb-2" size={32} />
          <p className="font-medium tracking-wide">Chargement de l'équipe...</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-[0.1em] border-b border-slate-100">
                <tr>
                  <th className="px-8 py-6">Membre</th>
                  <th className="px-6 py-6">Rôle & Ville</th>
                  <th className="px-6 py-6">Contact</th>
                  <th className="px-6 py-6 text-center">Accès & Badges</th>
                  <th className="px-8 py-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 text-slate-600 font-black text-base group-hover:from-blue-600 group-hover:to-indigo-600 group-hover:text-white transition-all duration-300 overflow-hidden shadow-inner">
                           <img src={user.gender === 'female' ? 'https://cdn-icons-png.flaticon.com/512/6997/6997674.png' : 'https://cdn-icons-png.flaticon.com/512/6997/6997662.png'} className="w-full h-full object-cover p-1.5" />
                        </div>
                        <div>
                          <p className="font-black text-slate-900 text-base">{user.full_name}</p>
                          <p className="text-xs text-slate-400 font-mono uppercase mt-1">ID: {user.id.slice(0, 8)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-6">
                      <div className="flex flex-col gap-2">
                        <span className={`inline-flex self-start items-center gap-1.5 rounded px-2.5 py-1 text-[10px] font-black tracking-widest uppercase ${
                          user.role === 'admin' ? 'bg-purple-100 text-purple-700' : 
                          user.role === 'operator' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          <ShieldCheck size={12} />
                          {user.role}
                        </span>
                        <p className="text-xs font-bold text-slate-500 ml-1">{user.city || 'Non Assigné'}</p>
                      </div>
                    </td>
                    <td className="px-6 py-6">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm text-slate-600 font-bold">
                          <Phone size={14} className="text-slate-400" />
                          {user.phone || '-'}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
                          <Mail size={14} className="text-slate-400" />
                          {user.email}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-6">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => generateBadge(user)}
                          className="flex items-center justify-center gap-1.5 bg-slate-100 text-slate-600 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                        >
                          <QrCode size={14} /> Badge
                        </button>
                        <button 
                          onClick={() => handleWhatsApp(user)}
                          className="flex items-center justify-center gap-1.5 bg-emerald-50 text-emerald-600 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                        >
                          <Share2 size={14} /> Wa
                        </button>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleOpenEdit(user)}
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
                ))}
              </tbody>
            </table>
            {users.length === 0 && (
              <div className="p-20 text-center">
                <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-slate-50 text-slate-300 mb-4">
                  <Users size={32} />
                </div>
                <p className="text-slate-400 font-bold tracking-tight text-lg">Aucun membre dans l'équipe</p>
              </div>
            )}
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">{isEditing ? "Modifier Membre" : "Nouveau Membre"}</h2>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Identité & Accès</p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-3 hover:bg-white border border-transparent hover:border-slate-200 rounded-2xl text-slate-400 hover:text-slate-600 shadow-none hover:shadow-sm transition-all">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-8 space-y-6">
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
                    required
                    type="text" 
                    className="w-full px-5 py-4 rounded-2xl border border-slate-200 focus:border-blue-500 outline-none font-bold text-slate-800 transition-all bg-slate-50/50 shadow-sm"
                    value={formData.full_name}
                    onChange={e => setFormData({...formData, full_name: e.target.value})}
                    placeholder="Paul Atreides"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Email Professionnel</label>
                    <input 
                      required
                      type="email" 
                      className="w-full px-5 py-4 rounded-2xl border border-slate-200 focus:border-blue-500 outline-none font-bold text-slate-800 transition-all bg-slate-50/50 shadow-sm"
                      value={formData.email}
                      onChange={e => setFormData({...formData, email: e.target.value})}
                      placeholder="p.atreides@mog.com"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Genre</label>
                    <div className="flex gap-2">
                       <button 
                        type="button"
                        onClick={() => setFormData({...formData, gender: 'male'})}
                        className={`flex-1 py-4 rounded-2xl border font-bold text-sm transition-all ${formData.gender === 'male' ? 'border-blue-600 bg-blue-50 text-blue-600 shadow-inner' : 'border-slate-200 bg-white text-slate-400 hover:bg-slate-50'}`}
                       >
                         Homme
                       </button>
                       <button 
                        type="button"
                        onClick={() => setFormData({...formData, gender: 'female'})}
                        className={`flex-1 py-4 rounded-2xl border font-bold text-sm transition-all ${formData.gender === 'female' ? 'border-pink-600 bg-pink-50 text-pink-600 shadow-inner' : 'border-slate-200 bg-white text-slate-400 hover:bg-slate-50'}`}
                       >
                         Femme
                       </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Téléphone (avec indicatif)</label>
                    <input 
                      required
                      type="tel" 
                      className="w-full px-5 py-4 rounded-2xl border border-slate-200 focus:border-blue-500 outline-none font-bold text-slate-800 transition-all bg-slate-50/50 shadow-sm"
                      value={formData.phone}
                      onChange={e => setFormData({...formData, phone: e.target.value})}
                      placeholder="+237 6XX XXX XXX"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Rôle</label>
                    <select 
                      className="w-full px-5 py-4 rounded-2xl border border-slate-200 focus:border-blue-500 outline-none font-bold text-slate-800 bg-slate-50/50 shadow-sm"
                      value={formData.role}
                      onChange={e => setFormData({...formData, role: e.target.value})}
                    >
                      <option value="operator">Opérateur</option>
                      <option value="admin">Administrateur</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Ville Affectée</label>
                    <select 
                      className="w-full px-5 py-4 rounded-2xl border border-slate-200 focus:border-blue-500 outline-none font-bold text-slate-800 bg-slate-50/50 shadow-sm"
                      value={formData.city}
                      onChange={e => setFormData({...formData, city: e.target.value})}
                    >
                      <option value="Douala">Douala</option>
                      <option value="Yaoundé">Yaoundé</option>
                      <option value="Guangzhou">Guangzhou</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
                    {isEditing ? "Nouveau mot de passe (optionnel)" : "Mot de passe temporaire"}
                  </label>
                  <input 
                    required={!isEditing}
                    type="password" 
                    className="w-full px-5 py-4 rounded-2xl border border-slate-200 focus:border-blue-500 outline-none font-bold text-slate-800 transition-all bg-slate-50/50 shadow-sm"
                    value={formData.password}
                    onChange={e => setFormData({...formData, password: e.target.value})}
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)}
                  className="px-6 py-4 rounded-2xl font-bold text-slate-500 hover:bg-slate-50 transition-colors"
                >
                  Annuler
                </button>
                <button 
                  disabled={submitting}
                  className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-slate-800 transition-all shadow-lg active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3"
                >
                  {submitting ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
                  {submitting ? "Enregistrement..." : "Valider"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
