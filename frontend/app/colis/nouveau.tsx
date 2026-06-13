import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Alert, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { X, ChevronRight, ChevronLeft, Plane, Ship, Copy, Share2, FileText, Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'react-native';
import Toast from 'react-native-toast-message';
import { useAuthStore } from '../../src/store/authStore';
import { useColisStore } from '../../src/store/colisStore';
import { colisApi } from '../../src/api/colis';
import { formatErr } from '../../src/api/client';
import { colors, fonts, radii, shadow, spacing } from '../../src/constants/theme';

import ShippingMark from '../../src/components/ShippingMark';

const PLATFORMS = ['Alibaba', '1688', 'Taobao', 'Other'];
const CATEGORIES = ['electronics', 'clothing', 'shoes', 'cosmetics', 'food', 'construction', 'toys', 'appliances', 'other'];
const WAREHOUSE_ADDR_TEXT = `收件人 : MOG
电话 : 18802010441
导航输入 : MOG
地址 : 广东省佛山市南海区大步村发展路1号 (天福药业有限公司院内2号楼)`;

export default function NewColisScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const addColis = useColisStore((s) => s.addColis);

  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [createdTracking, setCreatedTracking] = useState<string | null>(null);

  const [form, setForm] = useState({
    supplier_name: '',
    platform: 'Alibaba',
    order_ref: '',
    description: '',
    category: 'electronics',
    declared_value: '',
    currency: 'CNY' as 'CNY' | 'USD',
    transport_mode: 'sea' as 'sea' | 'air',
    delivery_address: user?.default_delivery_address || '',
    insurance_enabled: false,
    instructions: '',
  });
  const [photos, setPhotos] = useState<string[]>([]);

  const update = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const onPickImage = async () => {
    Haptics.selectionAsync();
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Toast.show({ type: 'error', text1: 'Permission denied' });
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: false,
        quality: 0.6,
        base64: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const data = asset.base64
        ? `data:image/jpeg;base64,${asset.base64}`
        : asset.uri;
      setPhotos((p) => [...p, data].slice(0, 5));
    } catch (e: any) {
      Toast.show({ type: 'error', text1: t('errors.upload_failed') });
    }
  };

  const onRemovePhoto = (idx: number) => {
    Haptics.selectionAsync();
    setPhotos((p) => p.filter((_, i) => i !== idx));
  };

  const validateStep = (): boolean => {
    if (step === 0) {
      if (!form.supplier_name || !form.description) {
        Toast.show({ type: 'error', text1: t('errors.required') });
        return false;
      }
    }
    return true;
  };

  const onNext = () => {
    Haptics.selectionAsync();
    if (!validateStep()) return;
    setStep((s) => Math.min(s + 1, 2));
  };

  const onBack = () => {
    Haptics.selectionAsync();
    setStep((s) => Math.max(s - 1, 0));
  };

  const onSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      const payload = {
        ...form,
        declared_value: parseFloat(form.declared_value) || 0,
        weight_real: 0,
        weight_volumetric: 0,
        dimensions: { l: 0, w: 0, h: 0 },
        photos,
      };
      const c = await colisApi.create(payload);
      addColis(c);
      setCreatedTracking(c.tracking_number);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Toast.show({ type: 'error', text1: formatErr(e, t('errors.server')) });
    } finally {
      setSubmitting(false);
    }
  };

  const onClose = () => {
    if (createdTracking) router.replace('/(tabs)/colis');
    else router.back();
  };

  // Confirmation success screen
  if (createdTracking) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']} testID="new-colis-success">
        <View style={styles.header}>
          <View style={{ width: 26 }} />
          <Text style={styles.headerTitle}>{t('form.step3')}</Text>
          <TouchableOpacity onPress={onClose} testID="new-colis-close"><X size={24} color={colors.text} /></TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.successWrap}>
            <View style={styles.successIcon}><Check size={48} color="#fff" strokeWidth={3} /></View>
            <Text style={styles.successTitle}>{t('common.confirm')} ✓</Text>
            <Text style={styles.tracking}>{createdTracking}</Text>
          </View>

          <Text style={styles.instrSectionTitle}>MARQUAGE À FOURNIR AU FOURNISSEUR</Text>
          
          <ShippingMark 
            name={user?.full_name || ''} 
            phone={user?.phone || ''} 
            city={user?.city || ''} 
          />

          <TouchableOpacity style={styles.primary} onPress={onClose} testID="new-colis-done">
            <Text style={styles.primaryText}>{t('common.confirm')}</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']} testID="new-colis-screen">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} testID="new-colis-back-x"><X size={24} color={colors.text} /></TouchableOpacity>
          <Text style={styles.headerTitle}>{t('package.new_package')}</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.stepper}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={styles.stepItem}>
              <View style={[styles.stepCircle, step >= i && styles.stepCircleActive]}>
                <Text style={[styles.stepNum, step >= i && { color: '#fff' }]}>{i + 1}</Text>
              </View>
              {i < 2 && <View style={[styles.stepLine, step > i && styles.stepLineActive]} />}
            </View>
          ))}
        </View>
        <View style={styles.stepLabels}>
          <Text style={[styles.stepLabel, step === 0 && styles.stepLabelActive]}>{t('form.step1')}</Text>
          <Text style={[styles.stepLabel, step === 1 && styles.stepLabelActive]}>{t('form.step2')}</Text>
          <Text style={[styles.stepLabel, step === 2 && styles.stepLabelActive]}>{t('form.step3')}</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {step === 0 && (
            <View style={styles.card}>
              <FieldLabel label={t('form.supplier_name')} required />
              <TextInput style={styles.input} value={form.supplier_name} onChangeText={(v) => update('supplier_name', v)} testID="step1-supplier" />

              <FieldLabel label={t('form.platform')} />
              <View style={styles.row}>
                {PLATFORMS.map((p) => (
                  <TouchableOpacity key={p} style={[styles.chip, form.platform === p && styles.chipActive]} onPress={() => update('platform', p)}>
                    <Text style={[styles.chipText, form.platform === p && { color: '#fff' }]}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <FieldLabel label={t('form.order_ref')} />
              <TextInput style={styles.input} value={form.order_ref} onChangeText={(v) => update('order_ref', v)} />

              <FieldLabel label={t('form.description')} required />
              <TextInput style={[styles.input, { height: 80 }]} multiline value={form.description} onChangeText={(v) => update('description', v)} testID="step1-description" />

              <FieldLabel label={t('form.category')} />
              <View style={styles.row}>
                {CATEGORIES.map((c) => (
                  <TouchableOpacity key={c} style={[styles.chip, form.category === c && styles.chipActive]} onPress={() => update('category', c)}>
                    <Text style={[styles.chipText, form.category === c && { color: '#fff' }]}>{t(`categories.${c}`)}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <FieldLabel label={t('form.declared_value')} />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput style={[styles.input, { flex: 2 }]} keyboardType="numeric" value={form.declared_value} onChangeText={(v) => update('declared_value', v)} testID="step1-value" />
                <View style={[styles.row, { flex: 1 }]}>
                  {(['CNY', 'USD'] as const).map((c) => (
                    <TouchableOpacity key={c} style={[styles.chip, form.currency === c && styles.chipActive]} onPress={() => update('currency', c)}>
                      <Text style={[styles.chipText, form.currency === c && { color: '#fff' }]}>{c}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          )}

          {step === 1 && (
            <View style={styles.card}>
              <FieldLabel label={t('form.transport_mode')} required />
              <View style={{ flexDirection: 'row', gap: 12 }}>
                {(['sea', 'air'] as const).map((m) => {
                  const Icon = m === 'air' ? Plane : Ship;
                  const active = form.transport_mode === m;
                  return (
                    <TouchableOpacity
                      key={m}
                      style={[styles.transportCard, active && styles.transportActive]}
                      onPress={() => update('transport_mode', m)}
                      testID={`step2-${m}`}
                    >
                      <Icon size={32} color={active ? '#fff' : colors.primary} strokeWidth={1.6} />
                      <Text style={[styles.transportTitle, active && { color: '#fff' }]}>{t(`transport.${m}`)}</Text>
                      <Text style={[styles.transportDesc, active && { color: 'rgba(255,255,255,0.8)' }]}>{t(`transport.${m}_desc`)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <FieldLabel label={t('form.delivery_address')} />
              <TextInput style={[styles.input, { height: 80 }]} multiline value={form.delivery_address} onChangeText={(v) => update('delivery_address', v)} />

              <View style={styles.insuranceRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.insuranceTitle}>{t('form.insurance')}</Text>
                  <Text style={styles.insuranceSub}>{t('form.insurance_cost')}</Text>
                </View>
                <Switch value={form.insurance_enabled} onValueChange={(v) => update('insurance_enabled', v)} trackColor={{ true: colors.primary, false: '#D1D5DB' }} thumbColor="#fff" />
              </View>

              <FieldLabel label={t('form.instructions')} />
              <TextInput style={[styles.input, { height: 80 }]} multiline value={form.instructions} onChangeText={(v) => update('instructions', v)} />
            </View>
          )}

          {step === 2 && (
            <View style={styles.card}>
              <Text style={styles.recap}>{t('form.recap')}</Text>
              <RecapRow label={t('form.supplier_name')} value={form.supplier_name} />
              <RecapRow label={t('form.platform')} value={form.platform} />
              <RecapRow label={t('form.description')} value={form.description} />
              <RecapRow label={t('form.category')} value={t(`categories.${form.category}`)} />
              <RecapRow label={t('form.declared_value')} value={`${form.declared_value || 0} ${form.currency}`} />
              <RecapRow label={t('form.transport_mode')} value={t(`transport.${form.transport_mode}`)} />
              <RecapRow label={t('form.insurance')} value={form.insurance_enabled ? t('common.yes') : t('common.no')} />
              <Text style={[styles.instr, { marginTop: spacing.md }]}>{t('form.instruction_message')}</Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          {step > 0 && (
            <TouchableOpacity style={styles.backBtn} onPress={onBack} testID="step-back">
              <ChevronLeft size={18} color={colors.text} />
              <Text style={styles.backText}>{t('form.back')}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.nextBtn, step === 0 && { flex: 1 }]} onPress={step < 2 ? onNext : onSubmit} disabled={submitting} testID="step-next">
            <Text style={styles.nextText}>{submitting ? t('common.loading') : (step < 2 ? t('form.next') : t('form.confirm'))}</Text>
            {step < 2 && <ChevronRight size={18} color="#fff" />}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return <Text style={styles.fieldLabel}>{label}{required && <Text style={{ color: colors.danger }}> *</Text>}</Text>;
}

function RecapRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.recapRow}>
      <Text style={styles.recapLabel}>{label}</Text>
      <Text style={styles.recapValue} numberOfLines={2}>{value || '—'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl, marginBottom: 4 },
  stepItem: { flexDirection: 'row', alignItems: 'center' },
  stepCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  stepCircleActive: { backgroundColor: colors.primary },
  stepNum: { color: colors.textSecondary, fontWeight: '700', fontSize: 12 },
  stepLine: { width: 50, height: 2, backgroundColor: '#E5E7EB' },
  stepLineActive: { backgroundColor: colors.primary },
  stepLabels: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  stepLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
  stepLabelActive: { color: colors.primary, fontWeight: '700' },
  scroll: { padding: spacing.lg, paddingTop: 0, paddingBottom: 40 },
  card: { backgroundColor: '#fff', borderRadius: radii.card, padding: spacing.lg, ...shadow.card },
  fieldLabel: { fontSize: 12, color: colors.textSecondary, fontWeight: '600', textTransform: 'uppercase', marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: colors.background, borderRadius: radii.input, paddingHorizontal: spacing.md, paddingVertical: 12, fontSize: 15, color: colors.text },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.background },
  chipActive: { backgroundColor: colors.primary },
  chipText: { color: colors.text, fontSize: 12, fontWeight: '600' },
  transportCard: { flex: 1, backgroundColor: colors.background, borderRadius: radii.card, padding: spacing.lg, alignItems: 'center', gap: 6, borderWidth: 2, borderColor: 'transparent' },
  transportActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  transportTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  transportDesc: { fontSize: 11, color: colors.textSecondary, textAlign: 'center' },
  insuranceRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background, borderRadius: radii.input, padding: spacing.md, marginTop: spacing.md },
  insuranceTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  insuranceSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  recap: { fontSize: 14, color: colors.textSecondary, fontWeight: '600', textTransform: 'uppercase', marginBottom: spacing.sm },
  recapRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  recapLabel: { color: colors.textSecondary, fontSize: 13, flex: 1 },
  recapValue: { color: colors.text, fontWeight: '600', fontSize: 13, flex: 1, textAlign: 'right' },
  instr: { color: colors.textSecondary, fontSize: 12, fontStyle: 'italic', lineHeight: 18 },
  footer: { flexDirection: 'row', gap: spacing.md, padding: spacing.lg, backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.borderLight },
  backBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: spacing.lg, paddingVertical: 14, borderRadius: radii.button, gap: 4 },
  backText: { color: colors.text, fontWeight: '600' },
  nextBtn: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: colors.primary, paddingVertical: 14, borderRadius: radii.button, gap: 4 },
  nextText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  successWrap: { alignItems: 'center', paddingVertical: spacing.xl },
  successIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  successTitle: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: spacing.sm },
  tracking: { fontFamily: fonts.mono, fontSize: 16, fontWeight: '700', color: colors.primary, backgroundColor: colors.background, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  addrCard: { backgroundColor: '#fff', borderRadius: radii.card, padding: spacing.lg, ...shadow.card, marginBottom: spacing.md, borderLeftWidth: 4, borderLeftColor: colors.accent },
  addrTitle: { fontSize: 12, color: colors.textSecondary, fontWeight: '700', textTransform: 'uppercase', marginBottom: 8 },
  addrText: { color: colors.text, fontSize: 14, lineHeight: 22, fontFamily: fonts.mono, marginBottom: spacing.md },
  action: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, backgroundColor: '#fff', paddingVertical: 14, borderRadius: radii.button, ...shadow.card, marginBottom: spacing.sm },
  actionText: { color: colors.primary, fontWeight: '700' },
  primary: { backgroundColor: colors.primary, paddingVertical: 16, borderRadius: radii.button, alignItems: 'center', marginTop: spacing.md },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  photoThumbWrap: { position: 'relative' },
  photoThumb: { width: 64, height: 64, borderRadius: 8, backgroundColor: colors.background },
  photoRemove: { position: 'absolute', top: -4, right: -4, width: 18, height: 18, borderRadius: 9, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' },
  photoAdd: { width: 64, height: 64, borderRadius: 8, backgroundColor: colors.background, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  photoAddText: { color: colors.textSecondary, fontSize: 28, fontWeight: '300' },
  instrSectionTitle: { fontSize: 13, fontWeight: '800', color: colors.textSecondary, marginTop: spacing.lg, textAlign: 'center' },
});
