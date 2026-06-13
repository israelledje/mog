import { useEffect } from 'react';
import { Redirect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useAuthStore } from '../src/store/authStore';
import { colors } from '../src/constants/theme';

export default function Index() {
  const user = useAuthStore((s) => s.user);
  const ready = useAuthStore((s) => s.ready);
  const [seenOnboarding, setSeenOnboarding] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      const v = await AsyncStorage.getItem('@onboarded');
      setSeenOnboarding(v === '1');
    })();
  }, []);

  if (!ready || seenOnboarding === null) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!seenOnboarding) return <Redirect href="/onboarding" />;
  if (!user) return <Redirect href="/(auth)/login" />;
  if (user.role === 'operator') return <Redirect href="/(operator)" />;
  if (user.role === 'admin') return <Redirect href="/(operator)" />; // Or admin dashboard if mobile has one
  return <Redirect href="/(tabs)" />;
}
