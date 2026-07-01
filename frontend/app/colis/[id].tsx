import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Platform, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Copy, Plane, Ship, FileText, Receipt, MessageCircle, Box, Container, Scale, Ruler, Tag, Store, Globe, DollarSign, ShieldCheck } from 'lucide-react-native';
import { z } from 'zod';

const paramSchema = z.object({
  id: z.string().min(1),
});
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import Toast from 'react-native-toast-message';
import StatusBadge from '../../src/components/StatusBadge';
import Timeline from '../../src/components/Timeline';
import PhotoCarousel from '../../src/components/PhotoCarousel';
import { colisApi } from '../../src/api/colis';
import type { Colis } from '../../src/types';
import { colors, fonts, radii, shadow, spacing } from '../../src/constants/theme';

const PLACEHOLDER = 'https://images.pexels.com/photos/5860937/pexels-photo-5860937.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940';

import ShippingMark from '../../src/components/ShippingMark';
import { useAuthStore } from '../../src/store/authStore';
import { useSettingsStore } from '../../src/store/settingsStore';
import { fileService } from '../../src/api/files';
import { formatDeclaredValue } from '../../src/utils/format';

export default function ColisDetailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const settings = useSettingsStore((s) => s.settings);
  const rawParams = useLocalSearchParams();
  const parsed = paramSchema.safeParse(rawParams);
  
  if (!parsed.success) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: colors.danger }}>Lien invalide.</Text>
      </SafeAreaView>
    );
  }
  
  const { id } = parsed.data;
  const [colis, setColis] = useState<Colis | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    (async () => {
      if (!id) return;
      try {
        const c = await colisApi.get(id);
        setColis(c);
      } catch {}
      setLoading(false);
    })();
  }, [id]);

  const onCopyTracking = async () => {
    if (!colis) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await Clipboard.setStringAsync(colis.tracking_number);
    Toast.show({ type: 'success', text1: t('package.copied') });
  };

  const onDownloadInvoice = async () => {
    if (!colis || !id) return;
    setDownloading(true);
    Haptics.selectionAsync();
    try {
      await fileService.downloadAndShare(
        `/colis/${id}/invoice`, 
        `Facture_${colis.tracking_number}.pdf`
      );
      Toast.show({ type: 'success', text1: 'Facture téléchargée' });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Erreur lors du téléchargement' });
    } finally {
      setDownloading(false);
    }
  };

  const onContactSupport = () => {
    Haptics.selectionAsync();
    const supportPhone = settings?.support_phone || '237694581150';
    const message = `Bonjour, je vous contacte concernant mon colis ${colis?.tracking_number}.`;
    const url = `whatsapp://send?phone=${supportPhone}&text=${encodeURIComponent(message)}`;
    Linking.openURL(url).catch(() => {
      Toast.show({ type: 'error', text1: 'WhatsApp n\'est pas installé.' });
    });
  };

  if (loading) {
    return (
      <View style={styles.loaderWrap}><ActivityIndicator color={colors.primary} /></View>
    );
  }
  if (!colis) {
    return (
      <View style={styles.loaderWrap}><Text>—</Text></View>
    );
  }

  const Icon = colis.transport_mode === 'air' ? Plane : Ship;

  return (
    <SafeAreaView style={styles.container} edges={['top']} testID="colis-detail-screen">
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} testID="detail-back"><ChevronLeft size={26} color={colors.text} /></TouchableOpacity>
        <Text style={styles.headerTitle}>{t('package.title')}</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <PhotoCarousel photos={colis.photos} packageId={colis.id} fallbackUrl={PLACEHOLDER} />

        <View style={[styles.card, { marginTop: spacing.lg }]}>
          <View style={styles.trackRow}>
            <Text style={styles.tracking} selectable testID="detail-tracking">{colis.tracking_number}</Text>
            <TouchableOpacity onPress={onCopyTracking} onLongPress={onCopyTracking} style={styles.copyBtn} testID="detail-copy">
              <Copy size={16} color={colors.primary} />
            </TouchableOpacity>
          </View>
          <View style={styles.titleRow}>
            <Text style={styles.desc}>{colis.description}</Text>
            <Icon size={20} color={colors.textSecondary} />
          </View>
          <StatusBadge status={colis.status} />
        </View>

        <Text style={styles.sectionTitle}>{t('package.timeline')}</Text>
        <View style={styles.card}>
          <Timeline steps={colis.timeline} currentStatus={colis.status} />
        </View>

        <Text style={styles.sectionTitle}>{t('package.details')}</Text>
        <View style={styles.grid}>
          <Info label={t('package.weight_real')} value={`${colis.weight_real} kg`} Icon={Scale} color="#3b82f6" />
          <Info label={t('package.weight_vol')} value={`${colis.weight_volumetric} kg`} Icon={Box} color="#0ea5e9" />
          <Info label={t('package.dimensions')} value={`${colis.dimensions?.l ?? 0}×${colis.dimensions?.w ?? 0}×${colis.dimensions?.h ?? 0}`} Icon={Ruler} color="#8b5cf6" />
          <Info label={t('package.category')} value={t(`categories.${colis.category}`)} Icon={Tag} color="#10b981" />
          <Info label={t('package.supplier')} value={colis.supplier_name || '-'} Icon={Store} color="#f59e0b" />
          <Info label={t('package.platform')} value={colis.platform || '-'} Icon={Globe} color="#6366f1" />
          <Info label={t('package.declared_value')} value={formatDeclaredValue(colis.declared_value, colis.currency)} Icon={DollarSign} color="#f43f5e" />
          <Info label={t('form.insurance')} value={colis.insurance_enabled ? t('common.yes') : t('common.no')} Icon={ShieldCheck} color={colis.insurance_enabled ? "#10b981" : "#9ca3af"} />
        </View>

        {colis.container_number && (
          <View style={styles.containerCard}>
            <Container size={22} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.cLabel}>{t('package.container')}</Text>
              <Text style={styles.cValue}>{colis.container_number}</Text>
              {colis.estimated_arrival && (
                <Text style={styles.cEta}>{t('package.eta')}: {new Date(colis.estimated_arrival).toLocaleDateString()}</Text>
              )}
            </View>
          </View>
        )}

        <Text style={styles.sectionTitle}>MARQUAGE & ADRESSE</Text>
        <ShippingMark 
          name={user?.full_name || ''} 
          phone={user?.phone || ''} 
          city={user?.city || ''} 
        />

        <View style={styles.actions}>

          <TouchableOpacity 
            style={[styles.actionBtn, (colis.status === 'pending_reception' || colis.invoice_status === 'none') && styles.actionBtnDisabled]} 
            disabled={downloading || colis.status === 'pending_reception' || colis.invoice_status === 'none'}
            onPress={onDownloadInvoice} 
            testID="detail-pdf-invoice"
          >
            {downloading ? <ActivityIndicator size="small" color={colors.primary} /> : <Receipt size={18} color={(colis.status === 'pending_reception' || colis.invoice_status === 'none') ? colors.textSecondary : colors.primary} />}
            <Text style={[styles.actionText, (colis.status === 'pending_reception' || colis.invoice_status === 'none') && styles.actionTextDisabled]}>{downloading ? 'Téléchargement...' : t('package.download_invoice')}</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.actionBtn, styles.support]} 
            onPress={onContactSupport} 
            testID="detail-support"
          >
            <MessageCircle size={18} color="#fff" />
            <Text style={[styles.actionText, { color: '#fff' }]}>{t('package.contact_support')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Info({ label, value, Icon, color }: { label: string; value: string; Icon: any; color: string }) {
  return (
    <View style={styles.infoBox}>
      <View style={[styles.iconWrap, { backgroundColor: `${color}15` }]}>
        <Icon size={16} color={color} />
      </View>
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue} numberOfLines={2} ellipsizeMode="tail">{value || '—'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loaderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  scroll: { padding: spacing.lg, paddingTop: 0, paddingBottom: 40 },
  card: { backgroundColor: '#fff', borderRadius: radii.card, padding: spacing.lg, ...shadow.card },
  trackRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  tracking: { fontFamily: fonts.mono, fontSize: 16, fontWeight: '700', color: colors.primary, letterSpacing: 0.5 },
  copyBtn: { padding: 6, backgroundColor: colors.background, borderRadius: 6 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  desc: { fontSize: 16, fontWeight: '700', color: colors.text, flex: 1, marginRight: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  infoBox: { backgroundColor: '#fff', borderRadius: radii.card, padding: spacing.md, width: '48.5%', ...shadow.card, flexDirection: 'row', alignItems: 'center', gap: 12 },
  infoContent: { flex: 1, minWidth: 0 },
  iconWrap: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  infoLabel: { fontSize: 10, color: colors.textSecondary, fontWeight: '700', textTransform: 'uppercase' },
  infoValue: { fontSize: 13, color: '#1A1A1A', fontWeight: '800', marginTop: 2 },
  containerCard: { backgroundColor: '#fff', borderRadius: radii.card, padding: spacing.lg, marginTop: spacing.md, flexDirection: 'row', gap: spacing.md, ...shadow.card, alignItems: 'center', borderLeftWidth: 4, borderLeftColor: colors.primary },
  cLabel: { color: colors.textSecondary, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  cValue: { color: colors.primary, fontFamily: fonts.mono, fontWeight: '700', fontSize: 14, marginTop: 2 },
  cEta: { color: colors.textSecondary, fontSize: 12, marginTop: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: spacing.lg, marginBottom: spacing.sm },
  actions: { gap: spacing.sm, marginTop: spacing.lg },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#fff', paddingVertical: 14, borderRadius: radii.button, ...shadow.card },
  actionBtnDisabled: { backgroundColor: colors.border, opacity: 0.6, shadowOpacity: 0 },
  actionText: { color: colors.primary, fontWeight: '700', fontSize: 14 },
  actionTextDisabled: { color: colors.textSecondary },
  support: { backgroundColor: colors.success },
});
