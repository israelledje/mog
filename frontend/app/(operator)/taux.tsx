import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { 
  ChevronLeft, 
  Coins, 
  Save, 
  TrendingUp, 
  Sparkles, 
  Calculator, 
  ArrowLeftRight, 
  CheckCircle2,
  Info
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Toast from 'react-native-toast-message';
import { api, formatErr } from '../../src/api/client';
import { useAuthStore } from '../../src/store/authStore';
import { darkColors as colors, radii, spacing } from '../../src/constants/theme';

export default function TauxChangeAdminScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const [under1m, setUnder1m] = useState('100');
  const [over1m, setOver1m] = useState('85');
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [updatedBy, setUpdatedBy] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Live Simulator state
  const [simCny, setSimCny] = useState('1000');
  const [simFcfa, setSimFcfa] = useState('100000');
  const [simMode, setSimMode] = useState<'cny_to_fcfa' | 'fcfa_to_cny'>('cny_to_fcfa');

  useEffect(() => {
    fetchRates();
  }, []);

  const fetchRates = async () => {
    setLoading(true);
    try {
      const res = await api.get('/settings');
      if (res.data) {
        setUnder1m(String(res.data.exchange_rate_cny_xaf_under_1m ?? 100));
        setOver1m(String(res.data.exchange_rate_cny_xaf_over_1m ?? 85));
        setUpdatedAt(res.data.cny_rate_updated_at || null);
        setUpdatedBy(res.data.cny_rate_updated_by || null);
      }
    } catch (e: any) {
      Toast.show({ type: 'error', text1: formatErr(e, 'Taux de change') });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    const valUnder = parseFloat(under1m.replace(',', '.'));
    const valOver = parseFloat(over1m.replace(',', '.'));

    if (isNaN(valUnder) || valUnder <= 0 || isNaN(valOver) || valOver <= 0) {
      Toast.show({ type: 'error', text1: 'Saisissez des taux valides (> 0)' });
      return;
    }

    setSaving(true);
    try {
      const res = await api.patch('/settings/exchange-rates', {
        exchange_rate_cny_xaf_under_1m: valUnder,
        exchange_rate_cny_xaf_over_1m: valOver,
      });

      if (res.data) {
        setUnder1m(String(res.data.exchange_rate_cny_xaf_under_1m));
        setOver1m(String(res.data.exchange_rate_cny_xaf_over_1m));
        setUpdatedAt(res.data.cny_rate_updated_at);
        setUpdatedBy(res.data.cny_rate_updated_by);
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Toast.show({ type: 'success', text1: 'Taux de change mis à jour !' });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: formatErr(e, 'Erreur enregistrement') });
    } finally {
      setSaving(false);
    }
  };

  if (user?.role !== 'admin') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}><ChevronLeft size={24} color={colors.text} /></TouchableOpacity>
          <Text style={styles.title}>Taux de Change</Text>
          <View style={{ width: 24 }} />
        </View>
        <Text style={styles.empty}>Accès réservé aux administrateurs</Text>
      </SafeAreaView>
    );
  }

  // Live Converter computations
  const rateUnderNum = parseFloat(under1m.replace(',', '.')) || 100;
  const rateOverNum = parseFloat(over1m.replace(',', '.')) || 85;

  const inputCnyNum = parseFloat(simCny.replace(',', '.')) || 0;
  const inputFcfaNum = parseFloat(simFcfa.replace(',', '.')) || 0;

  const simResultUnder = simMode === 'cny_to_fcfa' 
    ? inputCnyNum * rateUnderNum 
    : (rateUnderNum > 0 ? inputFcfaNum / rateUnderNum : 0);

  const simResultOver = simMode === 'cny_to_fcfa' 
    ? inputCnyNum * rateOverNum 
    : (rateOverNum > 0 ? inputFcfaNum / rateOverNum : 0);

  const formatNum = (n: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(n);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <ChevronLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Taux de change CNY / FCFA</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving}>
            {saving ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Save size={22} color={colors.primary} />
            )}
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            
            {/* Top overview banner */}
            <View style={styles.banner}>
              <View style={styles.bannerIcon}>
                <Coins size={24} color="#10B981" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.bannerTitle}>Cours du Yuan chinois (¥)</Text>
                <Text style={styles.bannerSub}>
                  Appliqué en direct pour les conversions, achats fournisseurs et paiements clients.
                </Text>
              </View>
            </View>

            {/* Form Section */}
            <Text style={styles.sectionHeader}>Paliers de facturation</Text>

            {/* Card Tier 1 (< 1M) */}
            <View style={styles.rateCard}>
              <View style={styles.rateCardHeader}>
                <View style={styles.badgeBlue}>
                  <Text style={styles.badgeTextBlue}>Palier Standard</Text>
                </View>
                <TrendingUp size={18} color="#38BDF8" />
              </View>

              <Text style={styles.rateCardLabel}>Montants &lt; 1 000 000 FCFA</Text>
              
              <View style={styles.inputContainer}>
                <Text style={styles.inputPrefix}>1 CNY =</Text>
                <TextInput
                  style={styles.rateInput}
                  value={under1m}
                  onChangeText={setUnder1m}
                  keyboardType="numeric"
                  placeholder="100.00"
                  placeholderTextColor={colors.textSecondary}
                />
                <Text style={styles.inputSuffix}>FCFA</Text>
              </View>
              <Text style={styles.fieldNote}>Tarif de base appliqué à la majorité des achats.</Text>
            </View>

            {/* Card Tier 2 (>= 1M) */}
            <View style={[styles.rateCard, styles.rateCardEmerald]}>
              <View style={styles.rateCardHeader}>
                <View style={styles.badgeEmerald}>
                  <Text style={styles.badgeTextEmerald}>Gros Volumes</Text>
                </View>
                <Sparkles size={18} color="#34D399" />
              </View>

              <Text style={styles.rateCardLabel}>Montants ≥ 1 000 000 FCFA</Text>
              
              <View style={styles.inputContainer}>
                <Text style={styles.inputPrefix}>1 CNY =</Text>
                <TextInput
                  style={styles.rateInput}
                  value={over1m}
                  onChangeText={setOver1m}
                  keyboardType="numeric"
                  placeholder="85.00"
                  placeholderTextColor={colors.textSecondary}
                />
                <Text style={styles.inputSuffix}>FCFA</Text>
              </View>
              <Text style={styles.fieldNote}>Tarif préférentiel pour les grossistes et gros montants.</Text>
            </View>

            {/* Save CTA */}
            <TouchableOpacity 
              style={styles.saveBtn} 
              onPress={handleSave} 
              disabled={saving}
              activeOpacity={0.8}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <CheckCircle2 size={20} color="#fff" />
                  <Text style={styles.saveBtnText}>Enregistrer les taux</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Live Converter Widget */}
            <View style={styles.simCard}>
              <View style={styles.simHeader}>
                <Calculator size={20} color={colors.primary} />
                <Text style={styles.simTitle}>Simulateur de conversion</Text>
              </View>

              <View style={styles.tabToggle}>
                <TouchableOpacity
                  style={[styles.toggleBtn, simMode === 'cny_to_fcfa' && styles.toggleBtnActive]}
                  onPress={() => setSimMode('cny_to_fcfa')}
                >
                  <Text style={[styles.toggleText, simMode === 'cny_to_fcfa' && styles.toggleTextActive]}>
                    CNY (¥) → FCFA
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toggleBtn, simMode === 'fcfa_to_cny' && styles.toggleBtnActive]}
                  onPress={() => setSimMode('fcfa_to_cny')}
                >
                  <Text style={[styles.toggleText, simMode === 'fcfa_to_cny' && styles.toggleTextActive]}>
                    FCFA → CNY (¥)
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.simInputRow}>
                <Text style={styles.simInputLabel}>
                  {simMode === 'cny_to_fcfa' ? 'Montant en Yuan (¥) :' : 'Montant en FCFA :'}
                </Text>
                <TextInput
                  style={styles.simInput}
                  value={simMode === 'cny_to_fcfa' ? simCny : simFcfa}
                  onChangeText={simMode === 'cny_to_fcfa' ? setSimCny : setSimFcfa}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>

              <View style={styles.simResults}>
                <View style={styles.simRow}>
                  <Text style={styles.simRowLabel}>Standard (&lt; 1M) :</Text>
                  <Text style={styles.simRowValue}>
                    {formatNum(simResultUnder)} {simMode === 'cny_to_fcfa' ? 'FCFA' : '¥'}
                  </Text>
                </View>
                <View style={styles.simRow}>
                  <Text style={[styles.simRowLabel, { color: '#34D399' }]}>Gros volume (≥ 1M) :</Text>
                  <Text style={[styles.simRowValue, { color: '#34D399' }]}>
                    {formatNum(simResultOver)} {simMode === 'cny_to_fcfa' ? 'FCFA' : '¥'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Audit / Info footer */}
            <View style={styles.infoBox}>
              <Info size={16} color={colors.textSecondary} style={{ marginTop: 2 }} />
              <Text style={styles.infoText}>
                Toute mise à jour est immédiatement répercutée sur les écrans clients, le calculateur de frais et les bons de commande.
              </Text>
            </View>

          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { fontSize: 17, fontWeight: '800', color: colors.text },
  empty: { textAlign: 'center', color: colors.textSecondary, marginTop: 40, fontSize: 14 },
  content: { padding: spacing.lg, paddingBottom: 40 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bannerIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  bannerSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2, lineHeight: 17 },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  rateCard: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rateCardEmerald: {
    borderColor: 'rgba(16, 185, 129, 0.3)',
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
  },
  rateCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  badgeBlue: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeTextBlue: { color: '#38BDF8', fontSize: 11, fontWeight: '800' },
  badgeEmerald: {
    backgroundColor: 'rgba(52, 211, 153, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeTextEmerald: { color: '#34D399', fontSize: 11, fontWeight: '800' },
  rateCardLabel: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 12 },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputPrefix: { fontSize: 15, fontWeight: '700', color: colors.textSecondary, marginRight: 8 },
  rateInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 20,
    fontWeight: '900',
    color: colors.text,
  },
  inputSuffix: { fontSize: 14, fontWeight: '800', color: colors.textSecondary, marginLeft: 8 },
  fieldNote: { fontSize: 11, color: colors.textSecondary, marginTop: 8 },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 16,
    marginVertical: 12,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  simCard: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 18,
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  simHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  simTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  tabToggle: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 4,
    marginBottom: 14,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 10,
  },
  toggleBtnActive: { backgroundColor: colors.primary },
  toggleText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  toggleTextActive: { color: '#fff' },
  simInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  simInputLabel: { fontSize: 13, fontWeight: '700', color: colors.text },
  simInput: {
    backgroundColor: colors.background,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 110,
    textAlign: 'right',
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  simResults: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  simRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  simRowLabel: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  simRowValue: { fontSize: 15, fontWeight: '900', color: colors.text },
  infoBox: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 18,
    paddingHorizontal: 6,
  },
  infoText: { flex: 1, fontSize: 11, color: colors.textSecondary, lineHeight: 16 },
});
