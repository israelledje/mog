import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ChevronLeft, Package, Users, Wallet, Boxes, Ship, Plane, TrendingUp, RefreshCw,
} from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { adminApi, type AdminStats } from '../../src/api/admin';
import { formatErr } from '../../src/api/client';
import { useAuthStore } from '../../src/store/authStore';
import { darkColors as colors, radii, spacing, shadow } from '../../src/constants/theme';

export default function ReportsAdminScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (user?.role !== 'admin') return;
    setLoading(true);
    try {
      const data = await adminApi.stats();
      setStats(data);
    } catch (e: any) {
      Toast.show({ type: 'error', text1: formatErr(e, 'Rapports') });
    } finally {
      setLoading(false);
    }
  }, [user?.role]);

  useEffect(() => { load(); }, [load]);

  if (user?.role !== 'admin') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Text style={styles.empty}>Accès réservé aux administrateurs</Text>
      </SafeAreaView>
    );
  }

  const maxDaily = Math.max(1, ...(stats?.daily_trends || []).map((d) => d.count));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><ChevronLeft size={24} color={colors.text} /></TouchableOpacity>
        <Text style={styles.title}>Rapport d’activité</Text>
        <TouchableOpacity onPress={load}><RefreshCw size={20} color={colors.primary} /></TouchableOpacity>
      </View>

      {loading || !stats ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.grid}>
            <StatCard icon={<Package size={18} color={colors.primary} />} label="Colis total" value={String(stats.total_packages)} />
            <StatCard icon={<Boxes size={18} color={colors.secondary} />} label="Reçus / chargés" value={String(stats.packages_received)} />
            <StatCard icon={<Users size={18} color="#F59E0B" />} label="Clients actifs" value={String(stats.active_clients)} />
            <StatCard icon={<Wallet size={18} color={colors.success} />} label="Revenu (payé)" value={`${Number(stats.total_revenue || 0).toLocaleString()} XAF`} />
            <StatCard icon={<TrendingUp size={18} color={colors.accent} />} label="Volume CBM" value={String(stats.total_volume_cbm)} />
            <StatCard icon={<Package size={18} color={colors.danger} />} label="Paiements en attente" value={String(stats.pending_payments)} />
          </View>

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Logistique</Text>
            <View style={styles.splitRow}>
              <View style={styles.splitItem}>
                <Ship size={20} color={colors.secondary} />
                <Text style={styles.splitVal}>{stats.logistics_split?.sea ?? 0}</Text>
                <Text style={styles.splitLab}>Maritime</Text>
              </View>
              <View style={styles.splitItem}>
                <Plane size={20} color={colors.accent} />
                <Text style={styles.splitVal}>{stats.logistics_split?.air ?? 0}</Text>
                <Text style={styles.splitLab}>Aérien</Text>
              </View>
              <View style={styles.splitItem}>
                <Boxes size={20} color={colors.primary} />
                <Text style={styles.splitVal}>{stats.open_containers}</Text>
                <Text style={styles.splitLab}>Ouverts</Text>
              </View>
            </View>
          </View>

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Cette semaine</Text>
            <Text style={styles.weekVal}>{stats.packages_this_week ?? 0} colis</Text>
            {stats.packages_week_change_pct != null && (
              <Text style={styles.meta}>
                {stats.packages_week_change_pct >= 0 ? '+' : ''}
                {stats.packages_week_change_pct}% vs semaine précédente
              </Text>
            )}
          </View>

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Tendance 7 jours</Text>
            {(stats.daily_trends || []).map((d) => (
              <View key={d.date} style={styles.barRow}>
                <Text style={styles.barLabel}>{d.date.slice(5)}</Text>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${Math.max(8, (d.count / maxDaily) * 100)}%` }]} />
                </View>
                <Text style={styles.barVal}>{d.count}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      {icon}
      <Text style={styles.statVal} numberOfLines={1}>{value}</Text>
      <Text style={styles.statLab}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg },
  title: { fontSize: 18, fontWeight: '800', color: colors.text },
  scroll: { padding: spacing.lg, paddingBottom: 40 },
  empty: { textAlign: 'center', color: colors.textSecondary, marginTop: 40 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  statCard: {
    width: '48%', backgroundColor: colors.card, borderRadius: 14, padding: 14, gap: 6, ...shadow.card,
  },
  statVal: { fontSize: 16, fontWeight: '900', color: colors.text },
  statLab: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
  panel: { backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 14, ...shadow.card },
  panelTitle: { fontSize: 13, fontWeight: '800', color: colors.textSecondary, textTransform: 'uppercase', marginBottom: 12 },
  splitRow: { flexDirection: 'row' },
  splitItem: { flex: 1, alignItems: 'center', gap: 4 },
  splitVal: { fontSize: 20, fontWeight: '900', color: colors.text },
  splitLab: { fontSize: 11, color: colors.textSecondary },
  weekVal: { fontSize: 28, fontWeight: '900', color: colors.primary },
  meta: { marginTop: 6, color: colors.textSecondary, fontWeight: '600' },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  barLabel: { width: 40, fontSize: 11, color: colors.textSecondary, fontWeight: '700' },
  barTrack: { flex: 1, height: 10, backgroundColor: colors.background, borderRadius: 999, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 999 },
  barVal: { width: 28, textAlign: 'right', fontSize: 12, fontWeight: '800', color: colors.text },
});
