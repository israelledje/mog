import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Alert, Platform } from 'react-native';

const KEY_EMAIL = 'user_email';
const KEY_PASS = 'user_password';
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

  async setEnabled(enabled: boolean, email?: string, password?: string) {
    if (isWeb) return;
    try {
      if (enabled) {
        if (!email || !password) throw new Error("Credentials missing");
        await SecureStore.setItemAsync(KEY_EMAIL, email);
        await SecureStore.setItemAsync(KEY_PASS, password);
        await SecureStore.setItemAsync(KEY_BIO_ENABLED, 'true');
      } else {
        await SecureStore.deleteItemAsync(KEY_EMAIL);
        await SecureStore.deleteItemAsync(KEY_PASS);
        await SecureStore.deleteItemAsync(KEY_BIO_ENABLED, 'false');
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
        fallbackLabel: 'Utiliser le mot de passe',
        disableDeviceFallback: false,
      });

      if (results.success) {
        const email = await SecureStore.getItemAsync(KEY_EMAIL);
        const password = await SecureStore.getItemAsync(KEY_PASS);
        return { email, password };
      }
      return null;
    } catch {
      return null;
    }
  }
};
