import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { getAccessToken, BASE } from './client';

const BASE_URL = `${BASE}/api`;

/**
 * Service gérant le téléchargement et le partage de fichiers générés par l'API (ex: PDF).
 * S'adapte dynamiquement à la plateforme (Web via Blob, Mobile via Expo FileSystem & Sharing).
 */
export const fileService = {
  /**
   * Télécharge un fichier depuis l'API et lance l'interface de partage native de l'appareil.
   * @param endpoint Le chemin de l'API (ex: '/colis/123/invoice')
   * @param filename Le nom sous lequel enregistrer le fichier (ex: 'facture.pdf')
   */
  async downloadAndShare(endpoint: string, filename: string) {
    if (Platform.OS === 'web') {
      // Pour le web, on ouvre simplement le lien ou on utilise un blob
      const token = await getAccessToken();
      const url = `${BASE_URL}${endpoint}`;
      
      try {
        const response = await fetch(url, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(blobUrl);
      } catch (err) {
        console.error("Web download failed", err);
      }
      return;
    }

    try {
      const token = await getAccessToken();
      const fileUri = `${FileSystem.documentDirectory}${filename}`;
      
      const resumable = FileSystem.createDownloadResumable(
        `${BASE_URL}${endpoint}`,
        fileUri,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      const downloadRes = await resumable.downloadAsync();

      if (downloadRes.status !== 200) {
        throw new Error("Erreur de téléchargement");
      }

      await Sharing.shareAsync(downloadRes.uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Télécharger la facture',
        UTI: 'com.adobe.pdf'
      });

    } catch (error) {
      console.error("Download error:", error);
      throw error;
    }
  }
};
