import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator, TextInput, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Lock, FileText, Package, CheckCircle2, Ship, Plane, ShieldAlert } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { groupagesApi } from '../../src/api/colis';
import { useAuthStore } from '../../src/store/authStore';
import type { Groupage } from '../../src/types';
import { darkColors as colors, radii, spacing, shadow, fonts } from '../../src/constants/theme';

export default function ClotureScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  const [containers, setContainers] = useState<Groupage[]>([]);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState<string | null>(null);
  const [showUnauthorized, setShowUnauthorized] = useState(false);
  const [otpModal, setOtpModal] = useState<{ id: string; number: string } | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);

  useEffect(() => {
    if (!isAdmin) {
      setShowUnauthorized(true);
      setLoading(false);
      return;
    }
    fetchContainers();
  }, [isAdmin]);

  const fetchContainers = async () => {
    try {
      const data = await groupagesApi.list();
      setContainers(data.filter(c => c.status === 'open'));
    } catch {
      Alert.alert('Erreur', 'Impossible de charger les conteneurs.');
    } finally {
      setLoading(false);
    }
  };

  const onCloture = (id: string, number: string) => {
    if (!isAdmin) {
      setShowUnauthorized(true);
      return;
    }
    setOtpModal({ id, number });
    setOtpCode('');
    setOtpSent(false);
  };

  const sendOtp = async () => {
    if (!otpModal) return;
    setClosing(otpModal.id);
    try {
      await groupagesApi.requestCloseOtp(otpModal.id);
      setOtpSent(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert('Erreur', 'Envoi OTP échoué');
    } finally {
      setClosing(null);
    }
  };

  const confirmClose = async () => {
    if (!otpModal || otpCode.length < 6) return;
    setClosing(otpModal.id);
    try {
      await groupagesApi.confirmClose(otpModal.id, otpCode);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Succès', t('operator.close_success'));
      setOtpModal(null);
      fetchContainers();
    } catch {
      Alert.alert('Erreur', 'Code OTP incorrect ou expiré');
    } finally {
      setClosing(null);
    }
  };

  const renderItem = ({ item }: { item: Groupage }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.iconWrap}>
          {item.transport_mode === 'sea' || item.mode === 'sea' ? (
            <Ship size={24} color={colors.secondary} />
          ) : (
            <Plane size={24} color={colors.accent} />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.containerNum}>{item.container_number}</Text>
          <Text style={styles.route}>{item.origin_city} ➔ {item.destination_city}</Text>
        </View>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>OPEN</Text>
        </View>
      </View>

      <View style={styles.details}>
        <View style={styles.detailItem}>
          <Package size={16} color={colors.textSecondary} />
          <Text style={styles.detailText}>{item.packages_ids?.length ?? 0} colis</Text>
        </View>
        {item.estimated_arrival && (
          <View style={styles.detailItem}>
            <FileText size={16} color={colors.textSecondary} />
            <Text style={styles.detailText}>ETA: {new Date(item.estimated_arrival).toLocaleDateString()}</Text>
          </View>
        )}
      </View>

      <TouchableOpacity style={styles.closeBtn} onPress={() => onCloture(item.id, item.container_number || '')} disabled={closing === item.id}>
        {closing === item.id ? <ActivityIndicator color="#fff" /> : (
          <>
            <Lock size={18} color="#fff" />
            <Text style={styles.closeBtnText}>{t('operator.close_pl')}</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <ChevronLeft size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('operator.close_pl')}</Text>
        <View style={{ width: 26 }} />
      </View>

      {!isAdmin ? (
        <View style={styles.center}>
          <ShieldAlert size={64} color={colors.danger} />
          <Text style={styles.unauthTitle}>{t('operator.unauthorized_title')}</Text>
          <Text style={styles.unauthDesc}>{t('operator.unauthorized_close')}</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>{t('common.back')}</Text>
          </TouchableOpacity>
        </View>
      ) : loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <FlatList
          data={containers}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <CheckCircle2 size={64} color={colors.success} opacity={0.5} />
              <Text style={styles.emptyText}>Aucun conteneur ouvert.</Text>
            </View>
          }
        />
      )}

      <Modal visible={showUnauthorized && !isAdmin} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <ShieldAlert size={48} color={colors.danger} />
            <Text style={styles.modalTitle}>{t('operator.unauthorized_title')}</Text>
            <Text style={styles.modalDesc}>{t('operator.unauthorized_close')}</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={() => { setShowUnauthorized(false); router.back(); }}>
              <Text style={styles.closeBtnText}>{t('common.close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={!!otpModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{t('operator.close_otp_title')}</Text>
            <Text style={styles.modalDesc}>{t('operator.close_otp_desc')}</Text>
            {!otpSent ? (
              <TouchableOpacity style={styles.closeBtn} onPress={sendOtp} disabled={!!closing}>
                {closing ? <ActivityIndicator color="#fff" /> : <Text style={styles.closeBtnText}>{t('operator.close_otp_send')}</Text>}
              </TouchableOpacity>
            ) : (
              <>
                <TextInput
                  style={styles.otpInput}
                  value={otpCode}
                  onChangeText={setOtpCode}
                  keyboardType="number-pad"
                  maxLength={6}
                  placeholder="000000"
                  placeholderTextColor={colors.textSecondary}
                />
                <TouchableOpacity style={styles.closeBtn} onPress={confirmClose} disabled={!!closing || otpCode.length < 6}>
                  {closing ? <ActivityIndicator color="#fff" /> : <Text style={styles.closeBtnText}>{t('operator.close_otp_confirm')}</Text>}
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity onPress={() => setOtpModal(null)} style={{ marginTop: 12 }}>
              <Text style={{ color: colors.textSecondary }}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border, ...shadow.card },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  back: { padding: 4 },
  list: { padding: spacing.lg },
  card: { backgroundColor: colors.card, borderRadius: radii.card, padding: spacing.lg, marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.border, ...shadow.card },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  iconWrap: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  containerNum: { fontSize: 18, fontWeight: '800', color: colors.text, fontFamily: fonts.mono },
  route: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  statusBadge: { backgroundColor: `${colors.success}15`, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusText: { color: colors.success, fontSize: 10, fontWeight: '800' },
  details: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.borderLight, paddingTop: spacing.md, marginBottom: spacing.lg },
  detailItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailText: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
  closeBtn: { backgroundColor: colors.primary, borderRadius: radii.button, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  closeBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  empty: { alignItems: 'center', marginTop: 100, gap: spacing.md },
  emptyText: { color: colors.textSecondary, fontSize: 16, fontWeight: '600', textAlign: 'center' },
  unauthTitle: { fontSize: 20, fontWeight: '800', color: colors.text, textAlign: 'center' },
  unauthDesc: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  backBtn: { marginTop: spacing.lg, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: colors.primary, borderRadius: radii.button },
  backBtnText: { color: '#fff', fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: spacing.xl },
  modalBox: { backgroundColor: colors.card, borderRadius: radii.card, padding: spacing.xl, alignItems: 'center', gap: spacing.md },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.text, textAlign: 'center' },
  modalDesc: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  otpInput: { width: '100%', backgroundColor: colors.background, borderRadius: radii.input, padding: 16, fontSize: 24, fontWeight: '800', textAlign: 'center', color: colors.text, letterSpacing: 8, borderWidth: 1, borderColor: colors.border },
});
