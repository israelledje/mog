import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Search, Ship, Plane, Package, CheckCircle2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { colisApi, groupagesApi } from '../../src/api/colis';
import type { Groupage } from '../../src/types';
import { darkColors as colors, radii, spacing, shadow, fonts } from '../../src/constants/theme';

export default function GroupageScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [colisId, setColisId] = useState<string | null>(null);
  const [tracking, setTracking] = useState('');
  const [containers, setContainers] = useState<Groupage[]>([]);
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState<string | null>(null);

  useEffect(() => {
    groupagesApi.list().then(data => setContainers(data.filter(c => c.status === 'open'))).catch(() => {});
  }, []);

  const onSearch = async () => {
    if (!search.trim()) return;
    setLoading(true);
    try {
      const res = await colisApi.list({ tracking_number: search.trim() });
      if (res.length > 0) {
        setColisId(res[0].id);
        setTracking(res[0].tracking_number);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Alert.alert('Non trouvé', 'Aucun colis avec ce numéro.');
      }
    } catch {
      Alert.alert('Erreur', 'Recherche impossible');
    } finally {
      setLoading(false);
    }
  };

  const onAssign = async (containerId: string) => {
    if (!colisId) return;
    setAssigning(containerId);
    try {
      await groupagesApi.addPackage(containerId, colisId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('OK', t('operator.groupage_success'), [{ text: 'OK', onPress: () => router.back() }]);
    } catch (e: any) {
      Alert.alert('Erreur', e?.response?.data?.detail || 'Affectation échouée');
    } finally {
      setAssigning(null);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <ChevronLeft size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('operator.groupage_title')}</Text>
        <View style={{ width: 26 }} />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>{t('operator.groupage_scan')}</Text>
        <View style={styles.searchRow}>
          <Search size={18} color={colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Tracking / Shipping Mark"
            placeholderTextColor={colors.textSecondary}
            onSubmitEditing={onSearch}
          />
          <TouchableOpacity style={styles.searchBtn} onPress={onSearch} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.searchBtnText}>OK</Text>}
          </TouchableOpacity>
        </View>
        {colisId && (
          <View style={styles.selectedColis}>
            <CheckCircle2 size={18} color={colors.success} />
            <Text style={styles.selectedText}>{tracking}</Text>
          </View>
        )}
      </View>

      <Text style={styles.sectionLabel}>{t('operator.groupage_select')}</Text>
      <FlatList
        data={containers}
        keyExtractor={item => item.id}
        contentContainerStyle={{ padding: spacing.lg, paddingTop: 0 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, !colisId && styles.cardDisabled]}
            onPress={() => onAssign(item.id)}
            disabled={!colisId || assigning === item.id}
          >
            <View style={styles.cardRow}>
              {item.mode === 'sea' || item.transport_mode === 'sea' ? (
                <Ship size={22} color={colors.secondary} />
              ) : (
                <Plane size={22} color={colors.accent} />
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.containerNum}>{item.container_number}</Text>
                <Text style={styles.route}>{item.origin_city} → {item.destination_city}</Text>
              </View>
              <View style={styles.badge}>
                <Package size={12} color={colors.primary} />
                <Text style={styles.badgeText}>{item.packages_ids?.length ?? 0}</Text>
              </View>
            </View>
            {assigning === item.id && <ActivityIndicator color={colors.primary} style={{ marginTop: 8 }} />}
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Aucun conteneur ouvert.</Text>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, backgroundColor: colors.card, borderBottomWidth: 1, borderColor: colors.border },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  back: { padding: 4 },
  section: { padding: spacing.lg },
  label: { fontSize: 12, fontWeight: '800', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  sectionLabel: { fontSize: 12, fontWeight: '800', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, paddingHorizontal: spacing.lg, marginTop: spacing.md },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.card, borderRadius: radii.input, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border },
  searchInput: { flex: 1, height: 48, color: colors.text, fontSize: 14 },
  searchBtn: { backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: radii.button },
  searchBtnText: { color: '#fff', fontWeight: '800' },
  selectedColis: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, backgroundColor: `${colors.success}20`, padding: 12, borderRadius: radii.card },
  selectedText: { fontWeight: '800', color: colors.success, fontFamily: fonts.mono },
  card: { backgroundColor: colors.card, borderRadius: radii.card, padding: spacing.lg, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border, ...shadow.card },
  cardDisabled: { opacity: 0.5 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  containerNum: { fontSize: 16, fontWeight: '800', color: colors.text, fontFamily: fonts.mono },
  route: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: `${colors.primary}20`, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 12, fontWeight: '800', color: colors.primary },
  empty: { textAlign: 'center', color: colors.textSecondary, marginTop: 40 },
});
