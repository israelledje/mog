import React, { useEffect, useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, BellOff, CheckCheck, Package } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useColisStore } from '../src/store/colisStore';
import { colors, fonts, radii, shadow, spacing } from '../src/constants/theme';

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { notifications, fetchNotifications, markRead, markAllRead } = useColisStore();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchNotifications();
    setRefreshing(false);
  }, [fetchNotifications]);

  const onPress = async (n: any) => {
    Haptics.selectionAsync();
    if (!n.read) await markRead(n.id);
    if (n.colis_id) router.push(`/colis/${n.colis_id}` as any);
  };

  const onMarkAll = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await markAllRead();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']} testID="notifications-screen">
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} testID="notif-back"><ChevronLeft size={26} color={colors.text} /></TouchableOpacity>
        <Text style={styles.title}>{t('notifications.title')}</Text>
        <TouchableOpacity onPress={onMarkAll} testID="notif-mark-all">
          <CheckCheck size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>
      <FlatList
        contentContainerStyle={styles.list}
        data={notifications}
        keyExtractor={(n) => n.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        renderItem={({ item }) => (
          <TouchableOpacity style={[styles.item, !item.read && styles.itemUnread]} onPress={() => onPress(item)} testID={`notif-${item.id}`}>
            <View style={styles.dot}>{!item.read && <View style={styles.dotInner} />}</View>
            <View style={[styles.icon, { backgroundColor: getIconBg(item.type) }]}>
              <Package size={18} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.message, !item.read && styles.messageUnread]} numberOfLines={2}>
                {t(item.message_key, { ref: item.tracking_number })}
              </Text>
              <Text style={styles.time}>{new Date(item.created_at).toLocaleString()}</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <BellOff size={48} color={colors.textSecondary} strokeWidth={1.4} />
            <Text style={styles.emptyText}>{t('notifications.empty')}</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

function getIconBg(type: string) {
  const map: Record<string, string> = {
    received: '#1D4ED8', quoted: '#C2410C', grouped: '#4338CA',
    departed: '#3366CC', arrived: '#15803D', delivered: '#009933',
  };
  return map[type] || colors.primary;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg },
  title: { fontSize: 20, fontWeight: '800', color: colors.text, fontFamily: fonts.heading },
  list: { padding: spacing.lg, paddingTop: 0 },
  item: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: radii.card, padding: spacing.md, marginBottom: spacing.sm, ...shadow.card, gap: spacing.sm },
  itemUnread: { borderLeftWidth: 3, borderLeftColor: colors.primary },
  dot: { width: 12, alignItems: 'center' },
  dotInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  message: { color: colors.textSecondary, fontSize: 13 },
  messageUnread: { color: colors.text, fontWeight: '600' },
  time: { color: colors.textSecondary, fontSize: 11, marginTop: 4 },
  empty: { padding: spacing.xxl, alignItems: 'center', gap: 10 },
  emptyText: { color: colors.textSecondary, fontSize: 14 },
});
