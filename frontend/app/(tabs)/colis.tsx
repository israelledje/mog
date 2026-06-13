import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, RefreshControl, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Search, Package, Plus, QrCode, Plane, Ship, Activity } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import ColisCard from '../../src/components/ColisCard';
import SkeletonCard from '../../src/components/SkeletonCard';
import { useColisStore } from '../../src/store/colisStore';
import { colors, fonts, radii, shadow, spacing } from '../../src/constants/theme';

const FILTERS: { key: string; statuses: string[] }[] = [
  { key: 'all', statuses: [] },
  { key: 'pending_reception', statuses: ['pending_reception'] },
  { key: 'received', statuses: ['received'] },
  { key: 'grouped', statuses: ['grouped', 'quoted', 'loaded', 'closed'] },
  { key: 'in_transit', statuses: ['in_transit', 'loading', 'departed'] },
  { key: 'arrived', statuses: ['arrived'] },
  { key: 'delivered', statuses: ['delivered'] },
];

export default function ColisListScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colis, fetchColis, loading } = useColisStore();
  const [filter, setFilter] = useState('all');
  const [transportFilter, setTransportFilter] = useState<'all' | 'air' | 'sea'>('all');
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Statistiques
  const activeCount = useMemo(() => colis.filter(c => !['delivered', 'distributed'].includes(c.status)).length, [colis]);
  const receivedCount = useMemo(() => colis.filter(c => ['received', 'delivered', 'distributed'].includes(c.status)).length, [colis]);
  const totalVolume = useMemo(() => colis.reduce((acc, c) => acc + (c.volume_m3 || 0), 0), [colis]);

  useEffect(() => { fetchColis(); }, [fetchColis]);

  const filtered = useMemo(() => {
    let list = colis;
    
    if (transportFilter === 'air') {
      list = list.filter(c => c.transport_mode === 'air' || c.transport_mode === 'air_express');
    } else if (transportFilter === 'sea') {
      list = list.filter(c => c.transport_mode === 'sea');
    }

    const f = FILTERS.find((x) => x.key === filter);
    if (f && f.statuses.length) list = list.filter((c) => f.statuses.includes(c.status));
    
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.tracking_number.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q) ||
          (c.supplier_name && c.supplier_name.toLowerCase().includes(q))
      );
    }
    return list;
  }, [colis, filter, transportFilter, search]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchColis();
    setRefreshing(false);
  }, [fetchColis]);

  return (
    <SafeAreaView style={styles.container} edges={['top']} testID="colis-screen">
      
      {/* STATS CARD - Solid Blue */}
      <View style={styles.statsCardContainer}>
        <View style={styles.statsCard}>
          <View style={styles.statsHeader}>
            <Text style={styles.statsTitle}>Mon Activité</Text>
            <Activity size={20} color="rgba(255,255,255,0.7)" />
          </View>
          <View style={styles.statsRow}>
            <View style={styles.statsCol}>
              <Text style={styles.statsValue}>{activeCount}</Text>
              <Text style={styles.statsLabel}>Colis Actifs</Text>
            </View>
            <View style={styles.statsDivider} />
            <View style={styles.statsCol}>
              <Text style={styles.statsValue}>{receivedCount}</Text>
              <Text style={styles.statsLabel}>Colis Reçus</Text>
            </View>
            <View style={styles.statsDivider} />
            <View style={styles.statsCol}>
              <Text style={styles.statsValue}>{totalVolume.toFixed(2)}</Text>
              <Text style={styles.statsLabel}>Volume (m³)</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.searchWrap}>
        <Search size={18} color={colors.textSecondary} style={{ marginLeft: spacing.sm }} />
        <TextInput
          style={styles.search}
          placeholder={t('package.search_placeholder')}
          placeholderTextColor={colors.textSecondary}
          value={search}
          onChangeText={setSearch}
          testID="colis-search"
        />
        <TouchableOpacity 
          style={styles.scanBtn}
          onPress={() => alert('Scanner un code QR / Code-barres (À venir)')}
        >
          <QrCode size={18} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {/* Quick Transport Filters */}
        <TouchableOpacity
          onPress={() => { Haptics.selectionAsync(); setTransportFilter(transportFilter === 'air' ? 'all' : 'air'); }}
          style={[styles.chip, transportFilter === 'air' && styles.chipActive]}
        >
          <Plane size={14} color={transportFilter === 'air' ? '#fff' : colors.text} style={{ marginRight: 6 }} />
          <Text style={[styles.chipText, transportFilter === 'air' && styles.chipTextActive]}>Aérien</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => { Haptics.selectionAsync(); setTransportFilter(transportFilter === 'sea' ? 'all' : 'sea'); }}
          style={[styles.chip, transportFilter === 'sea' && { backgroundColor: '#0ea5e9', borderColor: '#0ea5e9' }]}
        >
          <Ship size={14} color={transportFilter === 'sea' ? '#fff' : colors.text} style={{ marginRight: 6 }} />
          <Text style={[styles.chipText, transportFilter === 'sea' && styles.chipTextActive]}>Maritime</Text>
        </TouchableOpacity>
        
        <View style={styles.chipDivider} />

        {/* Status Filters */}
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              onPress={() => { Haptics.selectionAsync(); setFilter(f.key); }}
              style={[styles.chip, active && styles.chipActive]}
              testID={`filter-${f.key}`}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {f.key === 'all' ? t('package.all') : t(`status.${f.key}`)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading && filtered.length === 0 ? (
        <View style={styles.list}>
          <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
        </View>
      ) : (
        <FlatList
          contentContainerStyle={styles.list}
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ColisCard item={item} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Package size={64} color={colors.textSecondary} strokeWidth={1.2} />
              <Text style={styles.emptyTitle}>{t('package.no_packages')}</Text>
              <Text style={styles.emptySub}>{t('package.no_packages_sub')}</Text>
            </View>
          }
        />
      )}

      {/* FAB - Floating Action Button */}
      <TouchableOpacity 
        style={styles.fab}
        activeOpacity={0.8}
        onPress={() => { Haptics.selectionAsync(); router.push('/colis/nouveau'); }}
      >
        <Plus size={28} color="#fff" strokeWidth={2.5} />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  
  statsCardContainer: { paddingHorizontal: spacing.lg, marginTop: spacing.md, marginBottom: spacing.md },
  statsCard: { backgroundColor: colors.primary, borderRadius: 24, padding: 24, ...shadow.floating },
  statsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  statsTitle: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statsCol: { alignItems: 'center', flex: 1 },
  statsValue: { color: '#fff', fontSize: 24, fontWeight: '900', fontFamily: fonts.heading },
  statsLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '600', marginTop: 4, textTransform: 'uppercase' },
  statsDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.2)' },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    marginHorizontal: spacing.lg, paddingHorizontal: spacing.sm, height: 50, borderRadius: radii.card, ...shadow.card,
  },
  search: { flex: 1, fontSize: 15, color: colors.text, marginLeft: spacing.sm },
  scanBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(42, 29, 229, 0.1)', alignItems: 'center', justifyContent: 'center' },
  
  chips: { gap: 8, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, alignItems: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  chipDivider: { width: 1, height: 20, backgroundColor: colors.border, marginHorizontal: 4 },

  list: { padding: spacing.lg, paddingTop: 0, paddingBottom: 100 }, // extra padding for FAB
  empty: { padding: spacing.xxl, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginTop: 12 },
  emptySub: { color: colors.textSecondary, fontSize: 14, textAlign: 'center' },

  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.floating,
  }
});
