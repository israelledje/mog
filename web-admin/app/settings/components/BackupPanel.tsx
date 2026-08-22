"use client";

import { useState, useEffect, useCallback } from "react";

interface Backup {
  filename: string;
  size_bytes: number;
  created_at: string;
}

interface BackupPanelProps {
  token: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function BackupPanel({ token }: BackupPanelProps) {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchBackups = useCallback(async () => {
    setFetchError(null);
    try {
      const res = await fetch("/api/admin/backup/list", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: Backup[] = await res.json();
      setBackups(data);
    } catch (e) {
      setFetchError("Impossible de récupérer la liste des sauvegardes.");
    }
  }, [token]);

  useEffect(() => {
    fetchBackups();
  }, [fetchBackups]);

  const handleBackup = async () => {
    setLoading(true);
    setStatusMsg(null);
    try {
      const res = await fetch("/api/admin/backup/create", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStatusMsg({
          type: "success",
          text: `✅ Sauvegarde créée : ${data.filename} (${formatSize(data.size_bytes)})${
            data.old_backups_deleted > 0
              ? ` — ${data.old_backups_deleted} ancienne(s) supprimée(s)`
              : ""
          }`,
        });
        await fetchBackups();
      } else {
        setStatusMsg({
          type: "error",
          text: `❌ Erreur : ${data.detail || "Échec inconnu"}`,
        });
      }
    } catch {
      setStatusMsg({ type: "error", text: "❌ Erreur réseau — réessayez plus tard." });
    } finally {
      setLoading(false);
    }
  };

  const getDownloadUrl = (filename: string) =>
    `/api/admin/backup/download/${encodeURIComponent(filename)}`;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            💾 Sauvegardes MongoDB
          </h3>
          <p className="text-sm text-gray-500 mt-0.5">
            Les 10 dernières sauvegardes sont conservées automatiquement
          </p>
        </div>
        <button
          onClick={handleBackup}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Sauvegarde en cours…
            </>
          ) : (
            "Sauvegarder maintenant"
          )}
        </button>
      </div>

      {/* Status message */}
      {statusMsg && (
        <div
          className={`mx-6 mt-4 p-3 rounded-lg text-sm ${
            statusMsg.type === "success"
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {statusMsg.text}
        </div>
      )}

      {/* Backup list */}
      <div className="px-6 pb-4 mt-4">
        {fetchError ? (
          <p className="text-sm text-red-500 py-4 text-center">{fetchError}</p>
        ) : backups.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <p className="text-2xl mb-2">🗄️</p>
            <p className="text-sm">Aucune sauvegarde disponible</p>
            <p className="text-xs mt-1">Cliquez sur &ldquo;Sauvegarder maintenant&rdquo; pour créer la première</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 -mx-6 px-6">
            {backups.map((b) => (
              <div
                key={b.filename}
                className="py-3 flex items-center justify-between group hover:bg-gray-50 -mx-6 px-6 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-mono text-gray-800 truncate">{b.filename}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {formatDate(b.created_at)} &bull; {formatSize(b.size_bytes)}
                  </p>
                </div>
                <a
                  href={getDownloadUrl(b.filename)}
                  download={b.filename}
                  className="ml-4 flex-shrink-0 inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V3" />
                  </svg>
                  Télécharger
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
