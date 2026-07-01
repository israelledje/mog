import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import Toast from 'react-native-toast-message';
import {
  Search, Copy, MapPin, AlertTriangle, Clock, Package, Truck, CheckCircle2,
} from 'lucide-react-native';
import { colors, fonts, radii, shadow, spacing } from '../../constants/theme';
import { buildWarehouseClipboardText, CHINA_WAREHOUSE_ADDRESS } from '../../constants/warehouse';
import type { Colis, User } from '../../types';

type Kpi = { pending: number; warehouse: number; transit: number; delivered: number };

type Props = {
  user: User | null;
  colis: Colis[];
  kpi: Kpi;
};

export default function HomeTopPanels({ user, colis, kpi }: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const [trackingQuery, setTrackingQuery] = useState('');

  const actionCount = colis.filter(
    (c) =>
      c.status === 'arrived' ||
      c.payment_status === 'waiting_validation' ||
      (c.payment_status === 'pending' && !['draft', 'pending_reception', 'delivered'].includes(c.status)),
  ).length;

  const onSearchTracking = () => {
    const q = trackingQuery.trim().toLowerCase();
    if (!q) return;
    Haptics.selectionAsync();
    const found = colis.find(
      (c) =>
        c.tracking_number?.toLowerCase().includes(q) ||
        c.description?.toLowerCase().includes(q),
    );
    if (found) {
      router.push(`/colis/${found.id}`);
      setTrackingQuery('');
    } else {
      Toast.show({ type: 'info', text1: t('home.search_not_found') });
    }
  };

  const copyClientCode = async () => {
    if (!user?.client_code) return;
    await Clipboard.setStringAsync(user.client_code);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Toast.show({ type: 'success', text1: t('home.client_code_copied') });
  };

  const copyWarehouse = async () => {
    const text = buildWarehouseClipboardText({
      clientCode: user?.client_code,
      fullName: user?.full_name,
      phone: user?.phone,
      city: user?.city,
    });
    await Clipboard.setStringAsync(text);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Toast.show({ type: 'success', text1: t('home.warehouse_copied') });
  };

  const kpiItems = [
    { key: 'pending', label: t('home.pending'), value: kpi.pending, icon: Clock, color: '#F59E0B', bg: '#FEF3C7' },
    { key: 'warehouse', label: t('home.warehouse'), value: kpi.warehouse, icon: Package, color: colors.secondary, bg: '#E8F1FC' },
    { key: 'transit', label: t('home.transit'), value: kpi.transit, icon: Truck, color: '#0EA5E9', bg: '#E0F2FE' },
    { key: 'delivered', label: t('home.delivered'), value: kpi.delivered, icon: CheckCircle2, color: colors.success, bg: '#DCFCE7' },
  ] as const;

  return (
    <View style={styles.wrap}>
      {/* Recherche suivi */}
      <View style={styles.searchRow}>
        <Search size={18} color={colors.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder={t('home.search_tracking')}
          placeholderTextColor={colors.textSecondary}
          value={trackingQuery}
          onChangeText={setTrackingQuery}
          onSubmitEditing={onSearchTracking}
          returnKeyType="search"
          testID="home-tracking-search"
        />
        {trackingQuery.length > 0 && (
          <TouchableOpacity onPress={onSearchTracking} style={styles.searchBtn}>
            <Text style={styles.searchBtnText}>OK</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* KPI */}
      <View style={styles.kpiRow}>
        {kpiItems.map((item) => {
          const Icon = item.icon;
          return (
            <TouchableOpacity
              key={item.key}
              style={styles.kpiCard}
              onPress={() => router.push('/(tabs)/colis')}
              activeOpacity={0.85}
            >
              <View style={[styles.kpiIcon, { backgroundColor: item.bg }]}>
                <Icon size={16} color={item.color} strokeWidth={2.5} />
              </View>
              <Text style={styles.kpiValue}>{item.value}</Text>
              <Text style={styles.kpiLabel} numberOfLines={1}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Actions requises */}
      {actionCount > 0 && (
        <TouchableOpacity style={styles.alertBanner} onPress={() => router.push('/(tabs)/colis')} activeOpacity={0.9}>
          <AlertTriangle size={18} color="#B45309" />
          <Text style={styles.alertText}>
            {t('home.action_required', { count: actionCount })}
          </Text>
        </TouchableOpacity>
      )}

      {/* Code client + entrepôt */}
      <View style={styles.infoCard}>
        <View style={styles.infoHeader}>
          <Text style={styles.infoTitle}>{t('home.your_shipping_info')}</Text>
        </View>
        {user?.client_code ? (
          <View style={styles.codeRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoLabel}>{t('profile.client_code')}</Text>
              <Text style={styles.codeValue}>{user.client_code}</Text>
            </View>
            <TouchableOpacity style={styles.copyBtn} onPress={copyClientCode}>
              <Copy size={16} color={colors.primary} />
              <Text style={styles.copyBtnText}>{t('home.copy')}</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        <View style={[styles.warehouseBlock, user?.client_code ? { marginTop: spacing.md } : null]}>
          <View style={styles.warehouseTitleRow}>
            <MapPin size={16} color={colors.secondary} />
            <Text style={styles.warehouseTitle}>{t('package.warehouse_address')}</Text>
          </View>
          <Text style={styles.warehousePreview} numberOfLines={3}>{CHINA_WAREHOUSE_ADDRESS}</Text>
          <TouchableOpacity style={styles.warehouseCopyBtn} onPress={copyWarehouse}>
            <Copy size={16} color="#fff" />
            <Text style={styles.warehouseCopyText}>{t('home.copy_full_address')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: spacing.lg, marginBottom: spacing.lg },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: radii.button,
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginBottom: spacing.md,
    ...shadow.card,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.text, paddingVertical: 12, fontWeight: '500' },
  searchBtn: { backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  searchBtnText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  kpiRow: { flexDirection: 'row', gap: 8, marginBottom: spacing.md },
  kpiCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
    ...shadow.card,
  },
  kpiIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  kpiValue: { fontSize: 18, fontWeight: '800', color: colors.text, fontFamily: fonts.heading },
  kpiLabel: { fontSize: 9, fontWeight: '700', color: colors.textSecondary, marginTop: 2, textAlign: 'center' },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: radii.card,
    padding: 14,
    marginBottom: spacing.md,
  },
  alertText: { flex: 1, color: '#92400E', fontWeight: '700', fontSize: 13 },
  infoCard: { backgroundColor: '#fff', borderRadius: 20, padding: spacing.md, ...shadow.card },
  infoHeader: { marginBottom: spacing.sm },
  infoTitle: { fontSize: 16, fontWeight: '800', color: colors.text, fontFamily: fonts.heading },
  codeRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0F4FF', borderRadius: 14, padding: 12 },
  infoLabel: { fontSize: 11, fontWeight: '600', color: colors.textSecondary, marginBottom: 2 },
  codeValue: { fontSize: 20, fontWeight: '900', color: colors.primary, fontFamily: fonts.mono, letterSpacing: 1 },
  copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#fff', borderRadius: 10 },
  copyBtnText: { fontSize: 12, fontWeight: '700', color: colors.primary },
  warehouseBlock: { borderTopWidth: 1, borderTopColor: colors.borderLight, paddingTop: spacing.md },
  warehouseTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  warehouseTitle: { fontSize: 13, fontWeight: '700', color: colors.text },
  warehousePreview: { fontSize: 12, color: colors.textSecondary, lineHeight: 18, marginBottom: 10 },
  warehouseCopyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.secondary,
    paddingVertical: 12,
    borderRadius: radii.button,
  },
  warehouseCopyText: { color: '#fff', fontWeight: '800', fontSize: 13 },
});
