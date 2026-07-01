import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList,
  Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  ChevronLeft, Search, Ship, Plane, Package, CheckCircle2, Box, ChevronRight,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { colisApi, groupagesApi } from '../../src/api/colis';
import type { Groupage, Colis } from '../../src/types';
import { darkColors as colors, radii, spacing, shadow, fonts } from '../../src/constants/theme';

const containerId = (c: Groupage) => c.id || (c as any)._id;
const colisIdOf = (c: Colis) => c.id || (c as any)._id;

export default function GroupageScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [selectedColis, setSelectedColis] = useState<Colis | null>(null);
  const [recentColis, setRecentColis] = useState<Colis[]>([]);
  const [containers, setContainers] = useState<Groupage[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [assigning, setAssigning] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoadingRecent(true);
    try {
      const [allPackages, allContainers] = await Promise.all([
        colisApi.list({ limit: 100 }),
        groupagesApi.list(),
      ]);
      const assignable = allPackages.filter(
        c => ['received', 'damaged'].includes(c.status) && !c.container_id,
      );
      setRecentColis(assignable);
      setContainers(allContainers.filter(c => c.status === 'open'));
    } catch {
      Alert.alert('Erreur', 'Impossible de charger les données');
    } finally {
      setLoadingRecent(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const selectColis = (c: Colis) => {
    setSelectedColis(c);
    setSearch(c.tracking_number);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const onSearch = async () => {
    if (!search.trim()) return;
    setLoading(true);
    try {
      const res = await colisApi.list({ tracking_number: search.trim() });
      const match = res.find(c => !c.container_id) || res[0];
      if (match) {
        if (match.container_id) {
          Alert.alert('Déjà groupé', 'Ce colis est déjà affecté à un conteneur.');
          return;
        }
        selectColis(match);
      } else {
        Alert.alert('Non trouvé', 'Aucun colis avec ce numéro.');
      }
    } catch {
      Alert.alert('Erreur', 'Recherche impossible');
    } finally {
      setLoading(false);
    }
  };

  const onAssign = (container: Groupage) => {
    if (!selectedColis) {
      Alert.alert('', t('operator.groupage_scan'));
      return;
    }
    const cid = containerId(container);
    const pkgId = colisIdOf(selectedColis);
    if (!cid || !pkgId) {
      Alert.alert('Erreur', 'Identifiant manquant');
      return;
    }

    Alert.alert(
      t('operator.groupage_assign'),
      `${selectedColis.tracking_number} → ${container.container_number || cid.slice(0, 8)} ?`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.confirm'),
          onPress: async () => {
            setAssigning(cid);
            try {
              await groupagesApi.addPackage(cid, pkgId);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('OK', t('operator.groupage_success'), [{ text: 'OK', onPress: () => router.back() }]);
            } catch (e: any) {
              const msg = e?.response?.data?.detail || e?.message || 'Affectation échouée';
              Alert.alert('Erreur', String(msg));
            } finally {
              setAssigning(null);
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <ChevronLeft size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('operator.groupage_title')}</Text>
        <TouchableOpacity onPress={loadData} style={styles.back}>
          <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 12 }}>{t('operator.refresh')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        {/* ── Étape 1 : choisir le colis ── */}
        <View style={styles.section}>
          <Text style={styles.stepLabel}>1. {t('operator.groupage_scan')}</Text>
          <View style={styles.searchRow}>
            <Search size={18} color={colors.textSecondary} />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Tracking / Shipping Mark"
              placeholderTextColor={colors.textSecondary}
              onSubmitEditing={onSearch}
              returnKeyType="search"
            />
            <TouchableOpacity style={styles.searchBtn} onPress={onSearch} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.searchBtnText}>OK</Text>}
            </TouchableOpacity>
          </View>

          {selectedColis && (
            <View style={styles.selectedColis}>
              <CheckCircle2 size={18} color={colors.success} />
              <View style={{ flex: 1 }}>
                <Text style={styles.selectedText}>{selectedColis.tracking_number}</Text>
                <Text style={styles.selectedSub}>{selectedColis.description || selectedColis.nature || '—'}</Text>
              </View>
              <TouchableOpacity onPress={() => { setSelectedColis(null); setSearch(''); }}>
                <Text style={{ color: colors.danger, fontWeight: '700', fontSize: 12 }}>✕</Text>
              </TouchableOpacity>
            </View>
          )}

          {!selectedColis && (
            <>
              <Text style={styles.hint}>Colis réceptionnés disponibles :</Text>
              {loadingRecent ? (
                <ActivityIndicator color={colors.primary} style={{ marginTop: 12 }} />
              ) : recentColis.length === 0 ? (
                <Text style={styles.emptyHint}>Aucun colis reçu en attente de groupage.</Text>
              ) : (
                recentColis.slice(0, 10).map(c => (
                  <TouchableOpacity key={colisIdOf(c)} style={styles.colisRow} onPress={() => selectColis(c)}>
                    <Box size={18} color={colors.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.colisTracking}>{c.tracking_number}</Text>
                      <Text style={styles.colisDesc} numberOfLines={1}>{c.description || c.nature}</Text>
                    </View>
                    <ChevronRight size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                ))
              )}
            </>
          )}
        </View>

        {/* ── Étape 2 : choisir le conteneur ── */}
        <View style={styles.section}>
          <Text style={styles.stepLabel}>2. {t('operator.groupage_select')}</Text>
          {!selectedColis && (
            <View style={styles.warnBanner}>
              <Text style={styles.warnText}>↑ Sélectionnez d'abord un colis ci-dessus</Text>
            </View>
          )}

          {containers.length === 0 ? (
            <Text style={styles.emptyHint}>Aucun conteneur ouvert.</Text>
          ) : (
            containers.map(item => {
              const cid = containerId(item);
              const isAssigning = assigning === cid;
              const canTap = !!selectedColis && !isAssigning;
              return (
                <TouchableOpacity
                  key={cid}
                  style={[styles.card, !canTap && styles.cardMuted]}
                  onPress={() => canTap && onAssign(item)}
                  activeOpacity={canTap ? 0.7 : 1}
                >
                  <View style={styles.cardRow}>
                    {item.mode === 'sea' || item.transport_mode === 'sea' ? (
                      <Ship size={22} color={colors.secondary} />
                    ) : (
                      <Plane size={22} color={colors.accent} />
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.containerNum}>{item.container_number || cid?.slice(0, 8)}</Text>
                      <Text style={styles.route}>
                        {(item.origin_city || item.origin_port || 'Guangzhou')} → {item.destination_city || 'Douala'}
                      </Text>
                    </View>
                    <View style={styles.badge}>
                      <Package size={12} color={colors.primary} />
                      <Text style={styles.badgeText}>{item.packages_ids?.length ?? 0}</Text>
                    </View>
                    {canTap && <ChevronRight size={20} color={colors.primary} />}
                  </View>
                  {isAssigning && <ActivityIndicator color={colors.primary} style={{ marginTop: 8 }} />}
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, backgroundColor: colors.card, borderBottomWidth: 1, borderColor: colors.border },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  back: { padding: 4, minWidth: 40 },
  section: { padding: spacing.lg, paddingBottom: 0 },
  stepLabel: { fontSize: 12, fontWeight: '800', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.card, borderRadius: radii.input, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border },
  searchInput: { flex: 1, height: 48, color: colors.text, fontSize: 14 },
  searchBtn: { backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: radii.button },
  searchBtnText: { color: '#fff', fontWeight: '800' },
  selectedColis: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, backgroundColor: `${colors.success}20`, padding: 14, borderRadius: radii.card, borderWidth: 1, borderColor: colors.success },
  selectedText: { fontWeight: '800', color: colors.success, fontFamily: fonts.mono, fontSize: 15 },
  selectedSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  hint: { fontSize: 13, color: colors.textSecondary, marginTop: 16, marginBottom: 8 },
  emptyHint: { color: colors.textSecondary, fontStyle: 'italic', marginTop: 8 },
  colisRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, padding: 14, borderRadius: radii.card, marginBottom: 8, borderWidth: 1, borderColor: colors.border },
  colisTracking: { fontWeight: '800', color: colors.text, fontFamily: fonts.mono, fontSize: 14 },
  colisDesc: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  warnBanner: { backgroundColor: `${colors.accent}20`, padding: 12, borderRadius: radii.card, marginBottom: 12 },
  warnText: { color: colors.accent, fontWeight: '700', fontSize: 13, textAlign: 'center' },
  card: { backgroundColor: colors.card, borderRadius: radii.card, padding: spacing.lg, marginBottom: spacing.sm, borderWidth: 2, borderColor: colors.primary, ...shadow.card },
  cardMuted: { borderColor: colors.border, opacity: 0.65 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  containerNum: { fontSize: 16, fontWeight: '800', color: colors.text, fontFamily: fonts.mono },
  route: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: `${colors.primary}20`, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 12, fontWeight: '800', color: colors.primary },
});
