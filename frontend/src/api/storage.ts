import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

// SecureStore on native, AsyncStorage on web (SecureStore is unavailable on web)
const isWeb = Platform.OS === 'web';

/**
 * Utilitaire de stockage local.
 * Utilise SecureStore (chiffré) sur mobile et AsyncStorage sur le Web.
 * Idéal pour stocker des jetons de sécurité (JWT).
 */
export const storage = {
  async getItem(key: string): Promise<string | null> {
    if (isWeb) return AsyncStorage.getItem(key);
    return SecureStore.getItemAsync(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    if (isWeb) {
      await AsyncStorage.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },
  async deleteItem(key: string): Promise<void> {
    if (isWeb) {
      await AsyncStorage.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};
