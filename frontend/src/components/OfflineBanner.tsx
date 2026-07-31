import React, { useEffect, useRef, useState } from 'react';
import { Text, StyleSheet, Animated, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NetInfo from '@react-native-community/netinfo';
import { useTranslation } from 'react-i18next';
import { WifiOff, RefreshCw } from 'lucide-react-native';
import { useSyncStore } from '../store/syncStore';
import { colors } from '../constants/theme';

/**
 * Bandeau global affiché en haut de l'app lorsque le réseau est indisponible,
 * ou lorsqu'une file de synchro hors-ligne est en attente d'envoi.
 */
export default function OfflineBanner() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [offline, setOffline] = useState(false);
  const pending = useSyncStore((s) => s.queue.length);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setOffline(!state.isConnected);
    });
    return () => unsubscribe();
  }, []);

  const visible = offline || pending > 0;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: visible ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [visible, anim]);

  if (!visible) return null;

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [-60, 0] });
  const showSyncing = !offline && pending > 0;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.banner,
        {
          paddingTop: insets.top + 6,
          backgroundColor: showSyncing ? colors.warning : colors.danger,
          transform: [{ translateY }],
        },
      ]}
    >
      {showSyncing ? (
        <RefreshCw size={15} color="#fff" style={styles.icon} />
      ) : (
        <WifiOff size={15} color="#fff" style={styles.icon} />
      )}
      <Text style={styles.text}>
        {showSyncing
          ? t('common.syncing', { pending })
          : t('common.offline_banner')}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 8,
    paddingHorizontal: 16,
    zIndex: 9999,
    ...(Platform.OS === 'android' ? { elevation: 12 } : {}),
  },
  icon: { marginRight: 8 },
  text: { color: '#fff', fontSize: 12, fontWeight: '700', textAlign: 'center', flexShrink: 1 },
});
