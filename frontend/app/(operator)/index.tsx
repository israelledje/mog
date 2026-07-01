import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Modal, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { LogOut, Package, Scan, List, Lock, Clock, RotateCcw, Building2, Globe, Box } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '../../src/store/authStore';
import { colisApi } from '../../src/api/colis';
import { entrepotsApi, type Entrepot } from '../../src/api/entrepots';
import { setAppLanguage, SUPPORTED_LANGS } from '../../src/i18n';
import type { SupportedLang } from '../../src/i18n';
import { darkColors as colors, fonts, radii, shadow, spacing } from '../../src/constants/theme';

export default function OperatorDashboard() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { user, logout, setActiveEntrepot } = useAuthStore();

  const [kpi, setKpi] = useState({ pending: 0, warehouse: 0, transit: 0, delivered: 0 });
  const [recent, setRecent] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [shiftActive, setShiftActive] = useState(false);
  const [entrepots, setEntrepots] = useState<Entrepot[]>([]);
  const [showEntrepotModal, setShowEntrepotModal] = useState(false);
  const [showLangModal, setShowLangModal] = useState(false);

  const isAdmin = user?.role === 'admin';
  const activeEntrepotName = user?.active_entrepot_name || user?.assigned_entrepot_name;

  useEffect(() => {
    fetchData();
    entrepotsApi.list().then(list => {
      const origin = list.filter(e => e.type === 'origin');
      setEntrepots(origin);
      if (!user?.active_entrepot_id && origin.length > 0) {
        setShowEntrepotModal(true);
      }
    }).catch(() => {});
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [kpiData, recentData] = await Promise.all([
        colisApi.kpi(),
        colisApi.list({ limit: 5, status: 'received' }),
      ]);
      setKpi(kpiData);
      setRecent(recentData);
    } catch (e) {
      console.log('Error fetching dashboard data', e);
    } finally {
      setLoading(false);
    }
  };

  const onSelectEntrepot = async (e: Entrepot) => {
    try {
      await setActiveEntrepot(e.id || e._id!);
      setShowEntrepotModal(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert('Erreur', 'Impossible de sélectionner cet entrepôt');
    }
  };

  const onLogout = async () => {
    if (shiftActive) {
      Alert.alert('', t('operator.shift_active_warn'));
      return;
    }
    await logout();
    router.replace('/(auth)/login');
  };

  const toggleShift = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShiftActive(!shiftActive);
  };

  const goReception = () => {
    if (!user?.active_entrepot_id) {
      Alert.alert('', t('operator.warehouse_required'));
      setShowEntrepotModal(true);
      return;
    }
    router.push('/(operator)/reception');
  };

  const goCloture = () => {
    if (!isAdmin) {
      Alert.alert(t('operator.unauthorized_title'), t('operator.unauthorized_close'));
      return;
    }
    router.push('/(operator)/cloture');
  };

  const onUndo = (colis: any) => {
    Alert.alert('', t('operator.undo_confirm', { tracking: colis.tracking_number }), [
      { text: t('common.no'), style: 'cancel' },
      {
        text: t('common.yes'),
        style: 'destructive',
        onPress: async () => {
          try {
            await colisApi.updateStatus(colis.id, 'pending_reception', 'Erreur opérateur');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            fetchData();
          } catch {
            Alert.alert('Erreur', 'Impossible d\'annuler');
          }
        },
      },
    ]);
  };

  const changeLang = async (lang: SupportedLang) => {
    await setAppLanguage(lang);
    setShowLangModal(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.badge}>{t('operator.mode')}</Text>
          <Text style={styles.userName}>{user?.full_name || 'Agent'}</Text>
          <TouchableOpacity style={styles.warehouseChip} onPress={() => setShowEntrepotModal(true)}>
            <Building2 size={14} color={colors.primary} />
            <Text style={styles.warehouseText}>{activeEntrepotName || t('operator.no_warehouse')}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => setShowLangModal(true)} style={styles.iconBtn}>
            <Globe size={20} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onLogout} style={styles.logoutBtn}>
            <LogOut size={20} color={colors.danger} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <TouchableOpacity style={[styles.shiftBtn, shiftActive ? styles.shiftActive : styles.shiftInactive]} onPress={toggleShift}>
          <Clock size={20} color={shiftActive ? '#fff' : colors.text} />
          <Text style={[styles.shiftText, shiftActive && { color: '#fff' }]}>
            {shiftActive ? t('operator.end_shift') : t('operator.start_shift')}
          </Text>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>{t('operator.reception_title')}</Text>

        <TouchableOpacity style={styles.mainAction} onPress={goReception}>
          <View style={styles.actionIcon}>
            <Scan size={32} color="#fff" />
          </View>
          <View>
            <Text style={styles.actionTitle}>{t('operator.new_reception')}</Text>
            <Text style={styles.actionDesc}>{t('operator.new_reception_desc')}</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.grid}>
          <TouchableOpacity style={styles.subAction} onPress={goReception}>
            <List size={24} color={colors.primary} />
            <Text style={styles.subActionTitle}>{t('operator.my_receptions')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.subAction} onPress={() => router.push('/(operator)/groupage')}>
            <Box size={24} color={colors.secondary} />
            <Text style={styles.subActionTitle}>{t('operator.groupage')}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={[styles.subAction, { marginBottom: spacing.lg }]} onPress={goCloture}>
          <Lock size={24} color={isAdmin ? colors.danger : colors.textSecondary} />
          <Text style={styles.subActionTitle}>{t('operator.close_pl')}</Text>
        </TouchableOpacity>

        <View style={styles.statsCard}>
          <View style={styles.statsHeader}>
            <Text style={styles.statsTitle}>{t('operator.today')}</Text>
            <TouchableOpacity onPress={fetchData}>
              <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>{t('operator.refresh')}</Text>
            </TouchableOpacity>
          </View>
          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ padding: 20 }} />
          ) : (
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{kpi.warehouse}</Text>
                <Text style={styles.statLabel}>{t('operator.received')}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{kpi.pending}</Text>
                <Text style={styles.statLabel}>{t('operator.pending')}</Text>
              </View>
            </View>
          )}
        </View>

        <Text style={[styles.sectionTitle, { marginTop: spacing.xl }]}>{t('operator.recent_history')}</Text>
        {recent.length === 0 && !loading && (
          <Text style={{ color: colors.textSecondary, fontStyle: 'italic' }}>{t('operator.no_recent')}</Text>
        )}
        {recent.map(colis => (
          <View key={colis.id} style={styles.recentCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.recentTracking}>{colis.tracking_number}</Text>
              <Text style={styles.recentNature}>{colis.nature || 'Marchandise'}</Text>
            </View>
            <TouchableOpacity style={styles.undoBtn} onPress={() => onUndo(colis)}>
              <RotateCcw size={16} color={colors.danger} />
              <Text style={styles.undoText}>{t('operator.undo')}</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>

      <Modal visible={showEntrepotModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{t('operator.select_warehouse')}</Text>
            <Text style={styles.modalDesc}>{t('operator.select_warehouse_desc')}</Text>
            <FlatList
              data={entrepots}
              keyExtractor={item => item.id || item._id!}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.entrepotItem} onPress={() => onSelectEntrepot(item)}>
                  <Building2 size={20} color={colors.primary} />
                  <View>
                    <Text style={styles.entrepotName}>{item.name}</Text>
                    <Text style={styles.entrepotCity}>{item.city}, {item.country}</Text>
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={styles.modalDesc}>Aucun entrepôt d'origine configuré.</Text>}
            />
            {user?.active_entrepot_id && (
              <TouchableOpacity onPress={() => setShowEntrepotModal(false)}>
                <Text style={{ color: colors.textSecondary, textAlign: 'center', marginTop: 12 }}>{t('common.close')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={showLangModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{t('operator.language')}</Text>
            {SUPPORTED_LANGS.map(lang => (
              <TouchableOpacity key={lang} style={[styles.langItem, i18n.language === lang && styles.langActive]} onPress={() => changeLang(lang)}>
                <Text style={styles.langText}>{t(`operator.lang_${lang}`)}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => setShowLangModal(false)} style={{ marginTop: 12 }}>
              <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>{t('common.close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', padding: spacing.lg, backgroundColor: colors.card, ...shadow.card },
  badge: { fontSize: 10, fontWeight: '800', color: colors.primary, backgroundColor: `${colors.primary}20`, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, alignSelf: 'flex-start', marginBottom: 4 },
  userName: { fontSize: 20, fontWeight: '800', color: colors.text, fontFamily: fonts.heading },
  warehouseChip: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, backgroundColor: `${colors.primary}15`, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, alignSelf: 'flex-start' },
  warehouseText: { fontSize: 12, fontWeight: '700', color: colors.primary },
  headerActions: { flexDirection: 'row', gap: 8 },
  iconBtn: { padding: 8, backgroundColor: colors.background, borderRadius: radii.button },
  logoutBtn: { padding: 8, backgroundColor: colors.dangerBg, borderRadius: radii.button },
  scroll: { padding: spacing.lg, paddingBottom: 100 },
  shiftBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 14, borderRadius: radii.button, marginBottom: spacing.lg, ...shadow.card },
  shiftInactive: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  shiftActive: { backgroundColor: colors.success },
  shiftText: { fontSize: 16, fontWeight: '700', color: colors.text },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.textSecondary, marginBottom: spacing.md, textTransform: 'uppercase', letterSpacing: 1 },
  mainAction: { backgroundColor: colors.primary, borderRadius: radii.card, padding: spacing.xl, flexDirection: 'row', alignItems: 'center', gap: spacing.lg, ...shadow.floating, marginBottom: spacing.lg },
  actionIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  actionTitle: { fontSize: 20, fontWeight: '800', color: '#fff' },
  actionDesc: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  grid: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  subAction: { flex: 1, backgroundColor: colors.card, borderRadius: radii.card, padding: spacing.lg, alignItems: 'center', gap: 10, ...shadow.card },
  subActionTitle: { fontSize: 14, fontWeight: '700', color: colors.text, textAlign: 'center' },
  statsCard: { backgroundColor: colors.card, borderRadius: radii.card, padding: spacing.lg, ...shadow.card },
  statsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  statsTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  statsRow: { flexDirection: 'row', alignItems: 'center' },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 32, fontWeight: '900', color: colors.primary },
  statLabel: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
  statDivider: { width: 1, height: 50, backgroundColor: colors.borderLight },
  recentCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, padding: spacing.md, borderRadius: radii.card, marginBottom: spacing.sm, ...shadow.card },
  recentTracking: { fontSize: 15, fontWeight: '800', color: colors.text, fontFamily: fonts.mono },
  recentNature: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  undoBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.dangerBg, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radii.button },
  undoText: { color: colors.danger, fontSize: 12, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.xl, maxHeight: '70%' },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 8 },
  modalDesc: { fontSize: 14, color: colors.textSecondary, marginBottom: spacing.lg },
  entrepotItem: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  entrepotName: { fontSize: 15, fontWeight: '700', color: colors.text },
  entrepotCity: { fontSize: 12, color: colors.textSecondary },
  langItem: { padding: 14, borderRadius: radii.button, marginBottom: 8, backgroundColor: colors.background },
  langActive: { backgroundColor: `${colors.primary}25`, borderWidth: 1, borderColor: colors.primary },
  langText: { fontSize: 16, fontWeight: '700', color: colors.text, textAlign: 'center' },
});
