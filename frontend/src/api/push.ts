import { Platform } from 'react-native';
import { api } from './client';
import Constants from 'expo-constants';

let cachedToken: string | null = null;

/** Expo Go (SDK 53+) : les push distants sont retirés — ne jamais importer expo-notifications. */
function isExpoGo(): boolean {
  return Constants.executionEnvironment === 'storeClient';
}

/**
 * Cross-platform push notifications setup.
 * - On native (iOS/Android) en build natif : permission + token Expo + enregistrement backend.
 * - Sur web ou Expo Go : no-op (évite l'erreur fatale d'import d'expo-notifications).
 */
export async function registerForPushNotifications(): Promise<string | null> {
  if (Platform.OS === 'web' || isExpoGo()) {
    if (__DEV__ && isExpoGo()) {
      console.log('Push notifications skipped: not supported in Expo Go (SDK 53+)');
    }
    return null;
  }

  const projectId =
    Constants?.expoConfig?.extra?.eas?.projectId ??
    (Constants as any)?.easConfig?.projectId ??
    undefined;

  if (!projectId) {
    console.warn(
      "Push notifications skipped: No EAS projectId found in app.json. Run 'eas project:init' or add it manually.",
    );
    return null;
  }

  try {
    const Notifications = await import('expo-notifications');

    if (cachedToken) return cachedToken;

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });

    if (Platform.OS === 'android') {
      try {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#3366CC',
        });
      } catch {}
    }

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== 'granted') return null;

    const tokenResp = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenResp.data;
    cachedToken = token;

    try {
      await api.post('/auth/push-token', { token, platform: Platform.OS });
    } catch (e) {
      console.warn('push-token register failed', e);
    }
    return token;
  } catch (e) {
    console.warn('push setup failed', e);
    return null;
  }
}

export async function setupNotificationTapHandler(onTap: (data: any) => void) {
  if (Platform.OS === 'web' || isExpoGo()) return () => {};
  try {
    const Notifications = await import('expo-notifications');
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response?.notification?.request?.content?.data;
      onTap(data);
    });
    return () => sub.remove();
  } catch {
    return () => {};
  }
}

/**
 * Données de la notification ayant lancé l'app (cold start), ou null.
 */
export async function getInitialNotificationData(): Promise<any | null> {
  if (Platform.OS === 'web' || isExpoGo()) return null;
  try {
    const Notifications = await import('expo-notifications');
    const response = await Notifications.getLastNotificationResponseAsync();
    return response?.notification?.request?.content?.data ?? null;
  } catch {
    return null;
  }
}
