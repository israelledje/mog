'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ShieldCheck, Loader2, AlertCircle, RefreshCw, LogOut, MessageSquare } from 'lucide-react';
import Image from 'next/image';
import { API_BASE_URL } from '@/lib/api';

const getToken = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('admin_token');
  }
  return null;
};

type ConnectionStatus = 'loading' | 'connected' | 'disconnected' | 'error';

export default function WhatsAppPage() {
  const [status, setStatus] = useState<ConnectionStatus>('loading');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [initState, setInitState] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopQrPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const fetchQrCode = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/whatsapp/qr`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      setInitState(data.initState ?? null);

      if (data.status === 'connected') {
        setStatus('connected');
        setQrCode(null);
        setError(null);
        stopQrPolling();
        return;
      }

      if (data.status === 'error') {
        setStatus('error');
        setQrCode(null);
        setError(data.initError || 'Erreur lors de l\'initialisation WhatsApp.');
        stopQrPolling();
        return;
      }

      if (data.qr) {
        setQrCode(data.qr);
        setStatus('disconnected');
        setError(null);
        return;
      }

      setStatus('loading');
      setError(null);
    } catch (err) {
      console.error('Failed to fetch QR', err);
      setStatus('error');
      setError('Impossible de récupérer le QR Code WhatsApp.');
      stopQrPolling();
    }
  }, [stopQrPolling]);

  const startQrPolling = useCallback(() => {
    stopQrPolling();
    pollingRef.current = setInterval(() => {
      fetchQrCode();
    }, 3000);
  }, [fetchQrCode, stopQrPolling]);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/whatsapp/status`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      setInitState(data.initState ?? null);

      if (data.isConnected || data.initState === 'connected') {
        setStatus('connected');
        setQrCode(null);
        setError(data.error ?? null);
        stopQrPolling();
        return;
      }

      if (data.initState === 'authenticating') {
        setStatus('loading');
        setError(null);
        await fetchQrCode();
        startQrPolling();
        return;
      }

      if (data.initState === 'error' || data.error) {
        setStatus('error');
        setError(data.initError || data.error || 'Service WhatsApp indisponible.');
        stopQrPolling();
        return;
      }

      setStatus('loading');
      setError(null);
      await fetchQrCode();
      startQrPolling();
    } catch (err) {
      console.error(err);
      setError('Impossible de joindre le service WhatsApp.');
      setStatus('error');
      stopQrPolling();
    }
  }, [fetchQrCode, startQrPolling, stopQrPolling]);

  const handleRestart = async () => {
    try {
      setStatus('loading');
      setError(null);
      setQrCode(null);
      await fetch(`${API_BASE_URL}/whatsapp/restart`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      await fetchStatus();
    } catch (err) {
      console.error(err);
      setError('Impossible de redémarrer le service WhatsApp.');
      setStatus('error');
    }
  };

  const handleLogout = async () => {
    try {
      setStatus('loading');
      setQrCode(null);
      await fetch(`${API_BASE_URL}/whatsapp/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      await fetchStatus();
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 15000);
    return () => {
      clearInterval(interval);
      stopQrPolling();
    };
  }, [fetchStatus, stopQrPolling]);

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <MessageSquare className="text-green-500" />
            WhatsApp & SMS
          </h1>
          <p className="text-slate-500">Gérez le compte WhatsApp utilisé pour envoyer les OTPs et alertes.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-slate-800">Statut de la Connexion</h2>
            <div className="flex items-center gap-2">
              {status === 'loading' && <Loader2 className="animate-spin text-slate-400" size={20} />}
              {status === 'connected' && <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1"><ShieldCheck size={14} /> Connecté</span>}
              {status === 'disconnected' && <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-xs font-bold">En attente de scan</span>}
              {status === 'error' && <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold">Erreur</span>}
            </div>
          </div>

          {initState && status !== 'connected' && (
            <p className="text-xs text-slate-400 mb-4">État interne : {initState}</p>
          )}

          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6 flex items-center gap-3">
              <AlertCircle size={20} />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          {status === 'connected' ? (
            <div className="text-center py-8">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <ShieldCheck size={40} className="text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Service WhatsApp Opérationnel</h3>
              <p className="text-slate-500 mb-8">Les OTPs et notifications sont actuellement envoyés via WhatsApp.</p>

              <button
                onClick={handleLogout}
                className="bg-red-50 text-red-600 hover:bg-red-100 px-6 py-2 rounded-lg font-bold transition-colors flex items-center gap-2 mx-auto"
              >
                <LogOut size={18} />
                Déconnecter cet appareil
              </button>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-slate-600 mb-6 font-medium">1. Ouvrez WhatsApp sur votre téléphone<br/>2. Allez dans Paramètres {">"} Appareils connectés<br/>3. Scannez ce QR Code :</p>

              <div className="w-64 h-64 bg-slate-100 rounded-xl mx-auto flex items-center justify-center border-2 border-dashed border-slate-300 relative overflow-hidden mb-6">
                {qrCode ? (
                  <Image src={qrCode} alt="WhatsApp QR Code" fill className="object-contain p-4" unoptimized />
                ) : (
                  <div className="text-center px-4">
                    <Loader2 className="animate-spin text-slate-400 mx-auto mb-2" size={30} />
                    <span className="text-sm text-slate-500">
                      {initState === 'authenticating'
                        ? 'Finalisation de la connexion...'
                        : status === 'error'
                          ? 'Échec de génération'
                          : 'Génération du QR Code...'}
                    </span>
                    {status === 'loading' && (
                      <p className="text-xs text-slate-400 mt-2">Le service peut prendre 30 à 60 secondes au premier démarrage.</p>
                    )}
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={fetchStatus}
                  className="bg-slate-100 text-slate-700 hover:bg-slate-200 px-6 py-2 rounded-lg font-bold transition-colors flex items-center gap-2 mx-auto"
                >
                  <RefreshCw size={18} />
                  Rafraîchir
                </button>
                {status === 'error' && (
                  <button
                    onClick={handleRestart}
                    className="bg-green-50 text-green-700 hover:bg-green-100 px-6 py-2 rounded-lg font-bold transition-colors flex items-center gap-2 mx-auto"
                  >
                    <RefreshCw size={18} />
                    Redémarrer le service
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 h-fit">
          <h2 className="text-lg font-bold text-slate-800 mb-4">Système de Fallback (SMS)</h2>
          <p className="text-sm text-slate-600 mb-4">
            Pour garantir que les opérateurs reçoivent toujours leurs OTPs, un système de repli (fallback) est actif.
          </p>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-4">
            <h3 className="font-bold text-slate-800 mb-2">Comportement :</h3>
            <ul className="text-sm text-slate-600 space-y-2 list-disc pl-5">
              <li>Si WhatsApp est <b>Connecté</b>, les OTPs partent via WhatsApp Web (gratuit).</li>
              <li>Si WhatsApp est <b>Déconnecté</b>, le système envoie automatiquement un SMS via l&apos;API Nexah.</li>
              <li>Si WhatsApp est connecté mais que le numéro de l&apos;opérateur n&apos;a pas WhatsApp, le système bascule aussi sur Nexah SMS.</li>
            </ul>
          </div>
          <div className="flex items-center gap-2 text-sm font-bold text-green-600 bg-green-50 p-3 rounded-lg border border-green-200">
            <ShieldCheck size={18} />
            Le Fallback Nexah SMS est configuré et actif.
          </div>
        </div>
      </div>
    </div>
  );
}
