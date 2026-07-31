import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityIndicator, View } from 'react-native';
import { useAuthStore } from '../src/store/authStore';
import { getAdminUiMode } from '../src/utils/adminMode';
import { colors } from '../src/constants/theme';

export default function Index() {
  const user = useAuthStore((s) => s.user);
  const ready = useAuthStore((s) => s.ready);
  const [seenOnboarding, setSeenOnboarding] = useState<boolean | null>(null);
  const [adminMode, setAdminMode] = useState<'admin' | 'client' | null>(null);

  useEffect(() => {
    (async () => {
      const v = await AsyncStorage.getItem('@onboarded');
      setSeenOnboarding(v === '1');
    })();
  }, []);

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      setAdminMode(null);
      return;
    }
    getAdminUiMode().then(setAdminMode);
  }, [user]);

  if (!ready || seenOnboarding === null) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!seenOnboarding) return <Redirect href="/onboarding" />;
  if (!user) return <Redirect href="/(auth)/login" />;

  // Opérateur terrain : toujours l'espace opérateur
  if (user.role === 'operator') return <Redirect href="/(operator)" />;

  // Admin : bascule admin ↔ client selon préférence
  if (user.role === 'admin') {
    if (adminMode === null) {
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      );
    }
    return adminMode === 'client'
      ? <Redirect href="/(tabs)" />
      : <Redirect href="/(operator)" />;
  }

  return <Redirect href="/(tabs)" />;
}
