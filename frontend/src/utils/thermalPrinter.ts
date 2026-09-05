import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { Alert, Platform } from 'react-native';
import { BASE, TOKEN_KEY } from '../api/client';
import { storage } from '../api/storage';

/**
 * Imprime directement l'étiquette thermique d'un colis (format 80mm / 58mm)
 * Compatible PDA Android avec imprimante thermique intégrée, imprimantes Bluetooth et spooler système.
 */
export async function printPackageThermalLabel(packageId: string, trackingNumber?: string): Promise<boolean> {
  try {
    const token = await storage.getItem(TOKEN_KEY);
    const downloadUrl = `${BASE}/api/colis/${packageId}/label-pdf`;
    const targetPath = `${FileSystem.cacheDirectory}ticket_${trackingNumber || packageId}_${Date.now()}.pdf`;

    const result = await FileSystem.downloadAsync(downloadUrl, targetPath, {
      headers: {
        Authorization: token ? `Bearer ${token}` : '',
      },
    });

    if (result.status !== 200) {
      throw new Error(`Erreur serveur (${result.status})`);
    }

    if (Platform.OS === 'web') {
      window.open(downloadUrl, '_blank');
      return true;
    }

    await Print.printAsync({
      uri: result.uri,
    });
    return true;
  } catch (error: any) {
    console.error('[THERMAL_PRINT_ERR]', error);
    Alert.alert(
      'Impression',
      `Impossible d'imprimer l'étiquette : ${error?.message || 'Erreur inconnue'}`
    );
    return false;
  }
}

/**
 * Imprime en continu les étiquettes thermiques de TOUS les colis d'un conteneur / groupage.
 */
export async function printContainerThermalLabels(containerId: string, containerNumber?: string): Promise<boolean> {
  try {
    const token = await storage.getItem(TOKEN_KEY);
    const downloadUrl = `${BASE}/api/groupages/${containerId}/labels-pdf`;
    const targetPath = `${FileSystem.cacheDirectory}etiquettes_${containerNumber || containerId}_${Date.now()}.pdf`;

    const result = await FileSystem.downloadAsync(downloadUrl, targetPath, {
      headers: {
        Authorization: token ? `Bearer ${token}` : '',
      },
    });

    if (result.status !== 200) {
      throw new Error(`Erreur serveur (${result.status})`);
    }

    if (Platform.OS === 'web') {
      window.open(downloadUrl, '_blank');
      return true;
    }

    await Print.printAsync({
      uri: result.uri,
    });
    return true;
  } catch (error: any) {
    console.error('[CONTAINER_PRINT_ERR]', error);
    Alert.alert(
      'Impression Groupée',
      `Impossible d'imprimer les étiquettes : ${error?.message || 'Erreur inconnue'}`
    );
    return false;
  }
}

/**
 * Partage le fichier PDF de l'étiquette vers une application externe (Bluetooth POS, WhatsApp, etc.)
 */
export async function sharePackageThermalLabel(packageId: string, trackingNumber?: string): Promise<boolean> {
  try {
    const token = await storage.getItem(TOKEN_KEY);
    const downloadUrl = `${BASE}/api/colis/${packageId}/label-pdf`;
    const targetPath = `${FileSystem.cacheDirectory}ticket_${trackingNumber || packageId}.pdf`;

    const result = await FileSystem.downloadAsync(downloadUrl, targetPath, {
      headers: {
        Authorization: token ? `Bearer ${token}` : '',
      },
    });

    if (result.status === 200 && (await Sharing.isAvailableAsync())) {
      await Sharing.shareAsync(result.uri, {
        mimeType: 'application/pdf',
        dialogTitle: `Étiquette Colis ${trackingNumber || packageId}`,
      });
      return true;
    }
    return false;
  } catch (error: any) {
    console.error('[SHARE_LABEL_ERR]', error);
    return false;
  }
}
