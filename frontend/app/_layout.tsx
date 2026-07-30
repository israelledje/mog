import React, { useEffect, useState, useRef } from 'react';
import { Stack, useRouter } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ActivityIndicator, View, StatusBar, AppState, AppStateStatus, Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import Toast from 'react-native-toast-message';
import * as ScreenCapture from 'expo-screen-capture';
import { initI18n } from '../src/i18n';
import { useAuthStore } from '../src/store/authStore';
import { useColisStore } from '../src/store/colisStore';
import { useSettingsStore } from '../src/store/settingsStore';
import { useSyncStore } from '../src/store/syncStore';
import { setupNotificationTapHandler, getInitialNotificationData } from '../src/api/push';
import { initMonitoring, setUserContext } from '../src/api/monitoring';
import ErrorBoundary from '../src/components/ErrorBoundary';
import OfflineBanner from '../src/components/OfflineBanner';
import { colors } from '../src/constants/theme';

// Initialise Sentry le plus tôt possible (no-op en dev / sans DSN).
initMonitoring();

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const router = useRouter();
  const bootstrap = useAuthStore((s) => s.bootstrap);
  const user = useAuthStore((s) => s.user);
  const fetchAll = useColisStore((s) => s.fetchAll);
  const fetchSettings = useSettingsStore((s) => s.fetchSettings);
  const hydrateColis = useColisStore((s) => s.hydrate);
  const hydrateSync = useSyncStore((s) => s.hydrate);
  const flushSync = useSyncStore((s) => s.flush);
  const appState = useRef(AppState.currentState);

  const handleNotificationData = (data: any) => {
    if (!data) return;
    const colisId = data.colis_id || data.colisId;
    if (colisId) {
      router.push(`/colis/${colisId}`);
    } else {
      router.push('/notifications');
    }
  };

  useEffect(() => {
    (async () => {
      // Détection jailbreak : informatif uniquement.
      // Ne jamais bloquer le boot (faux positifs TestFlight / iOS récents
      // + un `return` ici empêchait setReady et laissait l'app figée).
      if (Platform.OS !== 'web') {
        try {
          const JailMonkey = require('jail-monkey').default;
          if (JailMonkey?.isJailBroken?.()) {
            console.warn('[Security] Device reported as jailbroken');
          }
        } catch {
          // Module natif indisponible — ignoré
        }
      }

      // Blocage captures (FLAG_SECURE) : actif en prod uniquement.
      // Preview / Expo Go / profil screenshots : autorisé pour fiches stores.
      const allowScreenshots =
        __DEV__ || process.env.EXPO_PUBLIC_ALLOW_SCREENSHOTS === 'true';
      if (Platform.OS !== 'web' && !allowScreenshots) {
        try {
          await ScreenCapture.preventScreenCaptureAsync();
        } catch (e) {
          console.warn('ScreenCapture not supported or failed', e);
        }
      }

      try {
        await initI18n();
        await Promise.all([hydrateColis(), hydrateSync()]);
        await Promise.all([bootstrap(), fetchSettings()]);
      } catch (e) {
        console.error('[Boot] initialization error', e);
      } finally {
        setReady(true);
      }
    })();
  }, [bootstrap, fetchSettings, hydrateColis, hydrateSync]);

  // Contexte utilisateur pour Sentry (aide au diagnostic des crashs).
  useEffect(() => {
    setUserContext(
      user ? { id: (user as any).id || (user as any)._id, email: user.email, role: user.role } : null,
    );
  }, [user]);

  // Vide la file de synchro hors-ligne dès que la connexion revient.
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected && user) {
        flushSync().then((synced) => {
          if (synced > 0) fetchAll().catch(() => {});
        }).catch(() => {});
      }
    });
    return () => unsubscribe();
  }, [user, flushSync, fetchAll]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        if (user) {
          fetchAll().catch(console.error);
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [user, fetchAll]);

  // Navigation au tap sur une notification (app ouverte, en arrière-plan, ou lancée à froid)
  useEffect(() => {
    if (!ready) return;
    let cleanup = () => {};
    (async () => {
      const initial = await getInitialNotificationData();
      if (initial) {
        setTimeout(() => handleNotificationData(initial), 300);
      }
      cleanup = await setupNotificationTapHandler(handleNotificationData);
    })();
    return () => cleanup();
  }, [ready]);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <ErrorBoundary>
          <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="onboarding" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="assistant" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="colis/[id]" />
            <Stack.Screen name="colis/nouveau" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="notifications" />
            <Stack.Screen name="profile/edit" />
            <Stack.Screen name="profile/faq" />
            <Stack.Screen name="services/index" />
            <Stack.Screen name="services/vehicles" />
            <Stack.Screen name="services/[slug]" />
            <Stack.Screen name="colis/paiement" />
            <Stack.Screen name="colis/grouper" />
            <Stack.Screen name="marketplace/index" />
            <Stack.Screen name="marketplace/[id]" />
            <Stack.Screen name="marketplace/orders" />
          </Stack>
          <OfflineBanner />
        </ErrorBoundary>
        <Toast />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
