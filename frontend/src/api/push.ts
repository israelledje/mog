import { Platform } from 'react-native';
import { api } from './client';
import Constants from 'expo-constants';

let cachedToken: string | null = null;

/**
 * Cross-platform push notifications setup.
 * - On native (iOS/Android): requests permission, gets Expo push token, registers with backend.
 * - On web or Expo Go: gracefully no-ops (Expo Go SDK 53+ doesn't support remote pushes).
 */
export async function registerForPushNotifications(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  
  // 🚀 CRITICAL: Detect Expo Go or missing Project ID
  // SDK 53+ removed remote notifications from Expo Go.
  const isExpoGo = Constants.executionEnvironment === 'storeClient'; 
  
  const projectId =
    Constants?.expoConfig?.extra?.eas?.projectId ??
    (Constants as any)?.easConfig?.projectId ??
    undefined;

  if (isExpoGo) {
    console.log("Push notifications skipped: Not supported in Expo Go (SDK 53+)");
    return null;
  }

  if (!projectId) {
    console.warn("Push notifications skipped: No EAS projectId found in app.json. Run 'eas project:init' or add it manually.");
    return null;
  }

  try {
    const Notifications = await import('expo-notifications');

    if (cachedToken) return cachedToken;

    // Configure default behavior when notification arrives in foreground
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });

    // Android requires a channel for notifications to be displayed
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

    // Permission flow
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

    // Register with backend
    try {
      await api.post('/auth/push-token', { token, platform: Platform.OS });
    } catch (e) {
      // Non-fatal
      console.warn('push-token register failed', e);
    }
    return token;
  } catch (e) {
    console.warn('push setup failed', e);
    return null;
  }
}

export async function setupNotificationTapHandler(onTap: (data: any) => void) {
  if (Platform.OS === 'web') return () => {};
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
