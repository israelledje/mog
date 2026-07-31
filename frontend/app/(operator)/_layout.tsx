import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, DeviceEventEmitter } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, useRouter, useSegments } from 'expo-router';
import NetInfo from '@react-native-community/netinfo';
import { useTranslation } from 'react-i18next';
import { Scan, WifiOff } from 'lucide-react-native';
import { darkColors as colors, shadow, radii, spacing } from '../../src/constants/theme';
import { OPERATOR_OPEN_SCAN } from '../../src/utils/operatorEvents';

export default function OperatorLayout() {
  const [isConnected, setIsConnected] = useState(true);
  const router = useRouter();
  const { t } = useTranslation();
  const segments = useSegments();
  const insets = useSafeAreaInsets();
  const lastSegment = segments[segments.length - 1] as string;
  const showFab = lastSegment === 'index' || lastSegment === 'reception';

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected ?? true);
    });
    return () => unsubscribe();
  }, []);

  const onFabPress = () => {
    if (lastSegment === 'reception') {
      // Ouvre le scanner sur l’écran déjà monté (évite d’empiler reception)
      DeviceEventEmitter.emit(OPERATOR_OPEN_SCAN);
      return;
    }
    router.push('/(operator)/reception');
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      {!isConnected && (
        <SafeAreaView style={styles.offlineBanner} edges={['top']}>
          <WifiOff size={16} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.offlineText}>{t('operator.offline_banner')}</Text>
        </SafeAreaView>
      )}
      
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background }
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="reception" />
        <Stack.Screen name="groupage" />
        <Stack.Screen name="cloture" />
        <Stack.Screen name="service-requests" />
        <Stack.Screen name="marketplace" />
        <Stack.Screen name="promos" />
        <Stack.Screen name="growth" />
        <Stack.Screen name="customers" />
        <Stack.Screen name="team" />
        <Stack.Screen name="tarifs" />
        <Stack.Screen name="warehouses" />
        <Stack.Screen name="invoices" />
        <Stack.Screen name="reports" />
      </Stack>

      {showFab && (
      <TouchableOpacity 
        style={[styles.fab, { bottom: insets.bottom + 24 }]} 
        onPress={onFabPress}
        activeOpacity={0.8}
      >
        <Scan size={28} color="#fff" />
      </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  offlineBanner: {
    backgroundColor: colors.danger,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    zIndex: 100,
  },
  offlineText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  fab: {
    position: 'absolute',
    right: 30,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.floating,
    zIndex: 1000,
  }
});
