import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { api, getAccessToken, BASE } from './client';

const BASE_URL = `${BASE}/api`;

function safeFilename(name: string) {
  return (name || 'document.pdf').replace(/[^\w.\-]+/g, '_');
}

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  // btoa disponible sur RN / Hermes / web
  return globalThis.btoa(binary);
}

export type PdfDownload = {
  uri: string;
  base64: string;
  endpoint: string;
  filename: string;
};

/**
 * Téléchargement PDF via Axios (même auth que le reste de l'app).
 * createDownloadResumable ignore parfois Authorization → 401 / échec.
 */
export const fileService = {
  async downloadPdf(endpoint: string, filename: string): Promise<PdfDownload> {
    const safe = safeFilename(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
    const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

    try {
      const res = await api.get(path, {
        responseType: 'arraybuffer',
        timeout: 60000,
        // force Accept for some proxies
        headers: { Accept: 'application/pdf,*/*' },
        validateStatus: () => true,
      });

      if (res.status !== 200) {
        let detail = `HTTP ${res.status}`;
        try {
          const text = typeof res.data === 'string'
            ? res.data
            : new TextDecoder().decode(res.data);
          const parsed = JSON.parse(text);
          if (parsed?.detail) detail = typeof parsed.detail === 'string' ? parsed.detail : detail;
        } catch { /* ignore */ }
        throw new Error(detail);
      }

      const buffer: ArrayBuffer = res.data;
      if (!buffer || (buffer as ArrayBuffer).byteLength === 0) {
        throw new Error('PDF vide');
      }

      const base64 = toBase64(buffer);

      if (Platform.OS === 'web') {
        const blob = new Blob([buffer], { type: 'application/pdf' });
        const uri = window.URL.createObjectURL(blob);
        return { uri, base64, endpoint: path, filename: safe };
      }

      const fileUri = `${FileSystem.cacheDirectory}${safe}`;
      await FileSystem.writeAsStringAsync(fileUri, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return { uri: fileUri, base64, endpoint: path, filename: safe };
    } catch (error: any) {
      console.error('Download error:', error?.message || error);
      throw error;
    }
  },

  /** @deprecated prefer downloadPdf — conservé pour écrans existants */
  async downloadToCache(endpoint: string, filename: string): Promise<string> {
    const pdf = await fileService.downloadPdf(endpoint, filename);
    return pdf.uri;
  },

  async downloadAndShare(endpoint: string, filename: string) {
    const pdf = await fileService.downloadPdf(endpoint, filename);

    if (Platform.OS === 'web') {
      const a = document.createElement('a');
      a.href = pdf.uri;
      a.download = pdf.filename;
      document.body.appendChild(a);
      a.click();
      return pdf;
    }

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(pdf.uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Télécharger / partager la facture',
        UTI: 'com.adobe.pdf',
      });
    }
    return pdf;
  },

  /** URL navigateur (web-admin style) avec ?token= — secours */
  async buildAuthedUrl(endpoint: string): Promise<string> {
    const token = await getAccessToken();
    const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const sep = path.includes('?') ? '&' : '?';
    return `${BASE_URL}${path}${sep}token=${encodeURIComponent(token || '')}`;
  },
};
