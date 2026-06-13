import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl,
  Modal, ScrollView, TextInput, Animated, Pressable, Platform, ActivityIndicator,
  KeyboardAvoidingView, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  Plane, Ship, Calculator, X, Package, Zap, Weight, Box, Clock, AlertCircle, CheckCircle, Info,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import StatusBadge from '../../src/components/StatusBadge';
import { useColisStore } from '../../src/store/colisStore';
import { api } from '../../src/api/client';
import { colors, fonts, radii, shadow, spacing } from '../../src/constants/theme';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type TransportMode = 'air' | 'sea';
type AirCategory = 'standard' | 'sensitive' | 'express';
type SeaCategory = 'standard' | 'heavy';

interface TarifResult {
  tarif: { label: string; price: number; unit: string; description: string };
  total: number;
  unit_value: number;
  unit_label: string;
}

// ─────────────────────────────────────────────
// Simulator Modal
// ─────────────────────────────────────────────
function SimulatorModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { height: screenHeight } = useWindowDimensions();
  const [mode, setMode] = useState<'air' | 'sea'>('air');
  const [airCategory, setAirCategory] = useState('normal');
  const [seaCategory, setSeaCategory] = useState('normal');
  const [weight, setWeight] = useState('');
  const [cbm, setCbm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    if (visible) {
      setError(null);
      setResult(null);
    }
  }, [visible, mode, airCategory, seaCategory]);

  const formatXAF = (n: number) =>
    n.toLocaleString('fr-CM', { style: 'currency', currency: 'XAF', maximumFractionDigits: 0 });

  const simulate = async () => {
    try {
      setError(null);
      setLoading(true);

      const val = mode === 'air' ? weight : cbm;
      if (!val || isNaN(Number(val)) || Number(val) <= 0) {
        throw new Error(`Veuillez entrer ${mode === 'air' ? 'un poids' : 'un volume'} valide.`);
      }

      const category = mode === 'air' ? airCategory : seaCategory;
      const res = await api.get('/tarifs/calculate', {
        params: {
          transport_mode: mode,
          weight_kg: mode === 'air' ? Number(val) : 0,
          volume_cbm: mode === 'sea' ? Number(val) : 0,
          category_key: category,
        },
      });

      setResult(res.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Erreur lors de la simulation');
    } finally {
      setLoading(false);
    }
  };

  const AIR_CATEGORIES: { key: string; label: string; icon: string; desc: string; color: string; badge?: string }[] = [
    { key: 'normal', label: 'Standard', icon: '📦', desc: 'Vêtements, chaussures', color: colors.primary },
    { key: 'machine', label: 'Sensible', icon: '📱', desc: 'Appareils, électronique', color: '#F59E0B' },
  ];

  const SEA_CATEGORIES: { key: string; label: string; icon: string; desc: string; color: string }[] = [
    { key: 'normal', label: 'Standard', icon: '🚢', desc: 'Meubles, matériaux', color: '#0EA5E9' },
    { key: 'machine', label: 'Lourd', icon: '🏗️', desc: 'Machines, batteries', color: colors.accent },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={sim.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ width: '100%', justifyContent: 'flex-end' }}
        >
          <View style={sim.sheet}>
            {/* Handle */}
            <View style={sim.handle} />

            {/* Header */}
            <View style={sim.header}>
              <View style={sim.headerLeft}>
                <View style={sim.headerIcon}>
                  <Calculator size={18} color="#fff" />
                </View>
                <View>
                  <Text style={sim.headerTitle}>Simulateur de Fret</Text>
                  <Text style={sim.headerSub}>Estimez le coût de votre envoi</Text>
                </View>
              </View>
              <TouchableOpacity onPress={onClose} style={sim.closeBtn}>
                <X size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Scrollable content with explicit max height to guarantee scrolling */}
            <ScrollView
              style={{ maxHeight: screenHeight * 0.70 }}
              contentContainerStyle={sim.content}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >

              {/* Mode Toggle */}
              <View style={sim.section}>
                <Text style={sim.label}>MODE DE TRANSPORT</Text>
                <View style={sim.modeRow}>
                  <TouchableOpacity
                    style={[sim.modeBtn, mode === 'air' && sim.modeBtnAir]}
                    onPress={() => { Haptics.selectionAsync(); setMode('air'); setResult(null); }}
                  >
                    <Plane size={16} color={mode === 'air' ? '#fff' : colors.textSecondary} />
                    <Text style={[sim.modeTxt, mode === 'air' && sim.modeTxtActive]}>Aérien</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[sim.modeBtn, mode === 'sea' && sim.modeBtnSea]}
                    onPress={() => { Haptics.selectionAsync(); setMode('sea'); setResult(null); }}
                  >
                    <Ship size={16} color={mode === 'sea' ? '#fff' : colors.textSecondary} />
                    <Text style={[sim.modeTxt, mode === 'sea' && sim.modeTxtActive]}>Maritime</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Category */}
              <View style={sim.section}>
                <Text style={sim.label}>TYPE DE MARCHANDISE</Text>
                <View style={sim.catRow}>
                  {mode === 'air'
                    ? AIR_CATEGORIES.map((cat) => {
                        const active = airCategory === cat.key;
                        return (
                          <TouchableOpacity
                            key={cat.key}
                            style={[sim.catBtn, active && { backgroundColor: cat.color, borderColor: cat.color }]}
                            onPress={() => { Haptics.selectionAsync(); setAirCategory(cat.key); setResult(null); }}
                          >
                            <Text style={sim.catIcon}>{cat.icon}</Text>
                            <Text style={[sim.catLabel, active && { color: '#fff' }]}>{cat.label}</Text>
                          </TouchableOpacity>
                        );
                      })
                    : SEA_CATEGORIES.map((cat) => {
                        const active = seaCategory === cat.key;
                        return (
                          <TouchableOpacity
                            key={cat.key}
                            style={[sim.catBtn, sim.catBtnWide, active && { backgroundColor: cat.color, borderColor: cat.color }]}
                            onPress={() => { Haptics.selectionAsync(); setSeaCategory(cat.key); setResult(null); }}
                          >
                            <Text style={sim.catIcon}>{cat.icon}</Text>
                            <Text style={[sim.catLabel, active && { color: '#fff' }]}>{cat.label}</Text>
                          </TouchableOpacity>
                        );
                      })
                  }
                </View>
              </View>

              {/* Compact Input */}
              <View style={sim.section}>
                <Text style={sim.label}>{mode === 'air' ? 'POIDS TOTAL' : 'VOLUME TOTAL'}</Text>
                <View style={sim.compactInputWrap}>
                  <View style={sim.compactInputLeft}>
                    <Text style={sim.compactInputIcon}>{mode === 'air' ? '⚖️' : '📐'}</Text>
                  </View>
                  <TextInput
                    style={sim.compactInput}
                    keyboardType="decimal-pad"
                    value={mode === 'air' ? weight : cbm}
                    onChangeText={(v) => {
                      if (mode === 'air') { setWeight(v); } else { setCbm(v); }
                      setResult(null);
                    }}
                    placeholder={mode === 'air' ? '25.5' : '2.5'}
                    placeholderTextColor={colors.textSecondary}
                    returnKeyType="done"
                  />
                  <View style={sim.compactInputRight}>
                    <Text style={sim.compactInputUnit}>{mode === 'air' ? 'KG' : 'CBM'}</Text>
                  </View>
                </View>
              </View>

              {/* Error */}
              {error != null && (
                <View style={sim.errorBox}>
                  <AlertCircle size={14} color={colors.danger} />
                  <Text style={sim.errorTxt}>{error}</Text>
                </View>
              )}

              {/* CTA */}
              <TouchableOpacity
                style={[sim.cta, loading && { opacity: 0.7 }]}
                onPress={simulate}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <>
                      <Text style={sim.ctaTxt}>Estimer le coût</Text>
                      <Calculator size={16} color="#fff" />
                    </>
                }
              </TouchableOpacity>

              {/* Premium Result */}
              {result != null && (
                <View style={sim.premiumCard}>
                  <View style={sim.premiumHeader}>
                    <View style={sim.premiumIconWrap}>
                      <CheckCircle size={22} color="#10B981" strokeWidth={2.5} />
                    </View>
                    <Text style={sim.premiumTitle}>Simulation réussie</Text>
                  </View>

                  <View style={sim.premiumBody}>
                    <View style={sim.premiumRow}>
                      <Text style={sim.premiumLabel}>Tarif unitaire</Text>
                      <Text style={sim.premiumValue}>{formatXAF(result.tarif.price)} / {result.tarif.unit}</Text>
                    </View>
                    <View style={sim.premiumRow}>
                      <Text style={sim.premiumLabel}>{mode === 'air' ? 'Poids calculé' : 'Volume calculé'}</Text>
                      <Text style={sim.premiumValue}>{result.unit_value} {result.unit_label}</Text>
                    </View>
                    <View style={sim.premiumRow}>
                      <Text style={sim.premiumLabel}>Délai estimé</Text>
                      <Text style={sim.premiumValue}>
                        {mode === 'sea' ? '~40 à 45 jours' : airCategory === 'machine' ? '~5 à 7 jours' : '~7 à 10 jours'}
                      </Text>
                    </View>
                  </View>

                  <View style={sim.premiumDividerWrap}>
                    <View style={sim.premiumNotchLeft} />
                    <View style={sim.premiumDashed} />
                    <View style={sim.premiumNotchRight} />
                  </View>

                  <View style={sim.premiumFooter}>
                    <Text style={sim.premiumTotalLabel}>Coût Total Estimé</Text>
                    <Text style={sim.premiumTotalValue}>{formatXAF(result.total)}</Text>
                  </View>

                  <View style={sim.premiumDisclaimer}>
                    <Info size={14} color={colors.textSecondary} />
                    <Text style={sim.premiumDisclaimerTxt}>
                      Ceci est une estimation à titre indicatif. Contactez-nous pour une cotation officielle.
                    </Text>
                  </View>
                </View>
              )}

              <View style={{ height: 24 }} />
            </ScrollView>

          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ─────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────
export default function ExpeditionsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { groupages, colis, fetchGroupages } = useColisStore();
  const [refreshing, setRefreshing] = useState(false);
  const [simulatorVisible, setSimulatorVisible] = useState(false);

  useEffect(() => { fetchGroupages(); }, [fetchGroupages]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchGroupages();
    setRefreshing(false);
  }, [fetchGroupages]);

  return (
    <SafeAreaView style={styles.container} edges={['top']} testID="expeditions-screen">
      <View style={styles.header}>
        <Text style={styles.title}>{t('shipment.title')}</Text>
      </View>

      <FlatList
        contentContainerStyle={styles.list}
        data={groupages}
        keyExtractor={(g) => g.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        renderItem={({ item }) => {
          const Icon = item.mode === 'air' ? Plane : Ship;
          const count = colis.filter((c: any) => c.container_id === item.id || c.groupage_id === item.id).length;
          const stages = ['loading', 'departed', 'in_transit', 'arrived'];
          const idx = stages.indexOf(item.status);
          return (
            <TouchableOpacity
              style={styles.card}
              testID={`groupage-${item.id}`}
              onPress={() => router.push(`/expeditions/${item.id}` as any)}
              activeOpacity={0.7}
            >
              <View style={styles.cardHeader}>
                <View style={styles.iconWrap}>
                  <Icon size={22} color={colors.primary} strokeWidth={2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.containerNum}>{item.container_number}</Text>
                  <Text style={styles.mode}>{t(`transport.${item.mode}`)}</Text>
                </View>
                <StatusBadge status={item.status as any} small />
              </View>

              <View style={styles.dividerContainer}>
                <View style={styles.leftCircle} />
                <View style={styles.dashedLine} />
                <View style={styles.rightCircle} />
              </View>

              <View style={styles.detailsGrid}>
                <View style={styles.detailBlock}>
                  <Text style={styles.detailLabel}>{t('shipment.origin')}</Text>
                  <Text style={styles.detailValue}>{item.origin_port}</Text>
                </View>
                <View style={styles.detailBlock}>
                  <Text style={styles.detailLabel}>{t('shipment.destination')}</Text>
                  <Text style={styles.detailValue}>{item.destination_port}</Text>
                </View>
                <View style={styles.detailBlock}>
                  <Text style={styles.detailLabel}>{t('shipment.departure')}</Text>
                  <Text style={styles.detailValue}>{new Date(item.departure_date).toLocaleDateString()}</Text>
                </View>
                <View style={styles.detailBlock}>
                  <Text style={styles.detailLabel}>{t('shipment.eta')}</Text>
                  <Text style={styles.detailValue}>{new Date(item.estimated_arrival).toLocaleDateString()}</Text>
                </View>
              </View>

              <View style={styles.bottomRow}>
                <Text style={styles.count}>{t('shipment.packages_count', { count })}</Text>
                <View style={styles.progressBarMini}>
                  {stages.map((_, i) => (
                    <View key={i} style={[styles.segmentMini, i <= idx && styles.segmentActiveMini]} />
                  ))}
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ship size={56} color={colors.textSecondary} strokeWidth={1.2} />
            <Text style={styles.emptyText}>{t('shipment.no_shipments')}</Text>
          </View>
        }
      />

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.8}
        onPress={() => setSimulatorVisible(true)}
      >
        <Calculator size={24} color="#fff" />
      </TouchableOpacity>

      <SimulatorModal visible={simulatorVisible} onClose={() => setSimulatorVisible(false)} />
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────
// Styles — Screen
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { padding: spacing.lg, paddingBottom: spacing.sm },
  title: { fontSize: 28, fontWeight: '900', color: colors.text, fontFamily: fonts.heading },
  list: { padding: spacing.lg, paddingBottom: 100, gap: spacing.md },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 16, ...shadow.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  iconWrap: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#EEF2FB', alignItems: 'center', justifyContent: 'center' },
  containerNum: { fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 2 },
  mode: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
  dividerContainer: { flexDirection: 'row', alignItems: 'center', marginVertical: 12, marginHorizontal: -16 },
  leftCircle: { width: 12, height: 24, borderTopRightRadius: 12, borderBottomRightRadius: 12, backgroundColor: colors.background },
  dashedLine: { flex: 1, height: 1, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed' },
  rightCircle: { width: 12, height: 24, borderTopLeftRadius: 12, borderBottomLeftRadius: 12, backgroundColor: colors.background },
  detailsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 16 },
  detailBlock: { width: '45%' },
  detailLabel: { fontSize: 11, color: colors.textSecondary, textTransform: 'uppercase', marginBottom: 4, fontWeight: '600' },
  detailValue: { fontSize: 14, color: colors.text, fontWeight: '700' },
  bottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  count: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  progressBarMini: { flexDirection: 'row', gap: 4, width: 100 },
  segmentMini: { flex: 1, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB' },
  segmentActiveMini: { backgroundColor: colors.primary },
  empty: { padding: spacing.xxl, alignItems: 'center', gap: 12 },
  emptyText: { color: colors.textSecondary, fontSize: 14 },
  fab: {
    position: 'absolute', bottom: 24, right: 24,
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
    ...shadow.floating,
  },
});

// ─────────────────────────────────────────────
// Styles — Simulator Modal
// ─────────────────────────────────────────────
const sim = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    width: '100%',
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center',
    marginTop: 10, marginBottom: 4,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerIcon: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  headerSub: { fontSize: 11, color: colors.textSecondary },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center', justifyContent: 'center',
  },
  content: { padding: 20 },
  section: { marginBottom: 20 },
  label: {
    fontSize: 10, fontWeight: '800', color: colors.textSecondary,
    letterSpacing: 0.5, marginBottom: 8,
  },
  
  // Compact Mode Toggle
  modeRow: { flexDirection: 'row', gap: 8 },
  modeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 10, borderRadius: 10, gap: 6,
    backgroundColor: '#F3F4F6',
  },
  modeBtnAir: { backgroundColor: colors.primary },
  modeBtnSea: { backgroundColor: '#0EA5E9' },
  modeTxt: { fontWeight: '700', fontSize: 13, color: colors.textSecondary },
  modeTxtActive: { color: '#fff' },

  // Compact Category
  catRow: { flexDirection: 'row', gap: 8 },
  catBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center', gap: 4,
  },
  catBtnWide: { flex: 1 },
  catIcon: { fontSize: 16 },
  catLabel: { fontSize: 11, fontWeight: '700', color: colors.textSecondary },

  // Ultra-Compact Input
  compactInputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F8F9FB',
    borderRadius: 10, borderWidth: 1, borderColor: colors.border,
    height: 44,
  },
  compactInputLeft: {
    width: 44, alignItems: 'center', justifyContent: 'center',
    borderRightWidth: 1, borderRightColor: colors.border,
  },
  compactInputIcon: { fontSize: 16 },
  compactInput: {
    flex: 1, paddingHorizontal: 12,
    fontSize: 16, fontWeight: '700', color: colors.text,
  },
  compactInputRight: {
    paddingHorizontal: 12, justifyContent: 'center',
  },
  compactInputUnit: { fontSize: 12, fontWeight: '800', color: colors.textSecondary },

  // Compact Error
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FEE2E2', borderRadius: 10, padding: 12, marginTop: 10,
  },
  errorTxt: { color: colors.danger, fontSize: 13, fontWeight: '600', flex: 1 },

  // CTA Button
  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, marginTop: 18,
    backgroundColor: colors.primary, borderRadius: 14, height: 56,
    ...shadow.floating,
  },
  ctaTxt: { color: '#fff', fontSize: 16, fontWeight: '800' },

  // Premium Result Card
  premiumCard: {
    marginTop: 24,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1, borderColor: colors.border,
    ...shadow.sm,
  },
  premiumHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  premiumIconWrap: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#D1FAE5',
    alignItems: 'center', justifyContent: 'center',
  },
  premiumTitle: { fontSize: 16, fontWeight: '800', color: '#111827' },
  
  premiumBody: {
    paddingHorizontal: 20, paddingVertical: 16, gap: 12,
  },
  premiumRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  premiumLabel: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  premiumValue: { fontSize: 14, color: '#111827', fontWeight: '800' },

  premiumDividerWrap: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: -8,
  },
  premiumNotchLeft: {
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: '#F3F4F6',
    marginLeft: -8,
  },
  premiumDashed: {
    flex: 1, height: 1,
    borderWidth: 1, borderColor: '#E5E7EB', borderStyle: 'dashed',
  },
  premiumNotchRight: {
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: '#F3F4F6',
    marginRight: -8,
  },

  premiumFooter: {
    paddingHorizontal: 20, paddingVertical: 16,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#F8F9FB',
  },
  premiumTotalLabel: { fontSize: 15, fontWeight: '800', color: '#111827', textTransform: 'uppercase' },
  premiumTotalValue: { fontSize: 24, fontWeight: '900', color: colors.primary },

  premiumDisclaimer: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#F3F4F6',
    borderBottomLeftRadius: 16, borderBottomRightRadius: 16,
  },
  premiumDisclaimerTxt: { fontSize: 11, color: colors.textSecondary, fontWeight: '500', flex: 1 },
});
