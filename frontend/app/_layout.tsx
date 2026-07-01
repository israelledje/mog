import React, { useEffect, useState, useRef } from 'react';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ActivityIndicator, View, StatusBar, AppState, AppStateStatus, Platform, Alert } from 'react-native';
import Toast from 'react-native-toast-message';
import JailMonkey from 'jail-monkey';
import * as ScreenCapture from 'expo-screen-capture';
import { initI18n } from '../src/i18n';
import { useAuthStore } from '../src/store/authStore';
import { useColisStore } from '../src/store/colisStore';
import { useSettingsStore } from '../src/store/settingsStore';
import { colors } from '../src/constants/theme';

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const bootstrap = useAuthStore((s) => s.bootstrap);
  const user = useAuthStore((s) => s.user);
  const fetchAll = useColisStore((s) => s.fetchAll);
  const fetchSettings = useSettingsStore((s) => s.fetchSettings);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    (async () => {
      if (Platform.OS !== 'web') {
        try {
          await ScreenCapture.preventScreenCaptureAsync();
        } catch (e) {
          console.warn('ScreenCapture not supported or failed', e);
        }
      }

      if (JailMonkey.isJailBroken()) {
        Alert.alert(
          "Sécurité compromise",
          "Votre appareil est rooté ou jailbreaké. L'application a été bloquée pour protéger vos données."
        );
        return; // Stoppe le chargement de l'app
      }

      await initI18n();
      await Promise.all([
        bootstrap(),
        fetchSettings()
      ]);
      setReady(true);
    })();
  }, [bootstrap, fetchSettings]);

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
        <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="colis/[id]" />
          <Stack.Screen name="colis/nouveau" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="notifications" />
          <Stack.Screen name="profile/edit" />
          <Stack.Screen name="profile/faq" />
        </Stack>
        <Toast />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
