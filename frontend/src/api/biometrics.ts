import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Alert, Platform } from 'react-native';

const KEY_BIO_REFRESH = 'user_bio_refresh';
const KEY_BIO_ENABLED = 'biometrics_enabled';

const isWeb = Platform.OS === 'web';

export const biometricService = {
  async isAvailable() {
    if (isWeb) return false;
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      return hasHardware && isEnrolled;
    } catch {
      return false;
    }
  },

  async setEnabled(enabled: boolean, refreshToken?: string) {
    if (isWeb) return;
    try {
      if (enabled) {
        if (!refreshToken) throw new Error("Refresh token missing");
        await SecureStore.setItemAsync(KEY_BIO_REFRESH, refreshToken);
        await SecureStore.setItemAsync(KEY_BIO_ENABLED, 'true');
      } else {
        await SecureStore.deleteItemAsync(KEY_BIO_REFRESH);
        await SecureStore.deleteItemAsync(KEY_BIO_ENABLED);
      }
    } catch (e) {
      console.warn("Biometrics setEnabled error", e);
    }
  },

  async isEnabled() {
    if (isWeb) return false;
    try {
      const val = await SecureStore.getItemAsync(KEY_BIO_ENABLED);
      return val === 'true';
    } catch {
      return false;
    }
  },

  async authenticate() {
    if (isWeb) return null;
    try {
      const results = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authentification requise',
        fallbackLabel: 'Annuler',
        disableDeviceFallback: false,
      });

      if (results.success) {
        const refreshToken = await SecureStore.getItemAsync(KEY_BIO_REFRESH);
        return refreshToken;
      }
      return null;
    } catch {
      return null;
    }
  }
};
