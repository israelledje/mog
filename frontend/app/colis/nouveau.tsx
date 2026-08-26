import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView, 
  KeyboardAvoidingView, 
  Platform, 
  Alert, 
  Switch,
  Image 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { 
  X, 
  ChevronRight, 
  ChevronLeft, 
  Plane, 
  Ship, 
  Copy, 
  Share2, 
  FileText, 
  Check, 
  ShieldCheck, 
  Smartphone, 
  Building2, 
  Sparkles,
  DollarSign
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';
import { useAuthStore } from '../../src/store/authStore';
import { useColisStore } from '../../src/store/colisStore';
import { useSettingsStore } from '../../src/store/settingsStore';
import { colisApi } from '../../src/api/colis';
import { paymentsApi } from '../../src/api/payments';
import { formatErr } from '../../src/api/client';
import PaymentMethodSelector, { PaymentMethodKey } from '../../src/components/PaymentMethodSelector';
import { parseDeclaredValue } from '../../src/utils/format';
import { colors, fonts, radii, shadow, spacing } from '../../src/constants/theme';

import ShippingMark from '../../src/components/ShippingMark';
import { CategoryChips } from '../../src/components/ui/HorizontalChips';
import {
  freightCategoriesForMode,
  defaultFreightCategoryKey,
  freightCategoryLabel,
} from '../../src/constants/freightCategories';

const PLATFORMS = ['Alibaba', '1688', 'Taobao', 'Other'];
const CATEGORIES = ['electronics', 'clothing', 'shoes', 'cosmetics', 'food', 'construction', 'toys', 'appliances', 'other'];

export default function NewColisScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const addColis = useColisStore((s) => s.addColis);
  const settings = useSettingsStore((s) => s.settings);
  const fetchSettings = useSettingsStore((s) => s.fetchSettings);

  useEffect(() => {
    if (!settings) {
      fetchSettings();
    }
  }, [settings, fetchSettings]);

  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [createdTracking, setCreatedTracking] = useState<string | null>(null);
  const [createdColis, setCreatedColis] = useState<any>(null);

  const [form, setForm] = useState({
    supplier_name: '',
    platform: 'Alibaba',
    order_ref: '',
    supplier_tracking: '',
    description: '',
    category: 'electronics',
    declared_value: '',
    currency: 'CNY' as 'CNY' | 'USD',
    transport_mode: 'sea' as 'sea' | 'air',
    category_key: 'standard',
    delivery_address: user?.default_delivery_address || '',
    insurance_enabled: false,
    instructions: '',
  });

  const [photos, setPhotos] = useState<string[]>([]);

  // Insurance Payment State
  const [payInsuranceNow, setPayInsuranceNow] = useState(true);
  const [insuranceMethod, setInsuranceMethod] = useState<'om' | 'momo' | 'bank'>('om');
  const [insurancePhone, setInsurancePhone] = useState(user?.phone || '');

  // Calcul dynamique du coût de l'assurance 3.5%
  const declaredValNum = parseDeclaredValue(form.declared_value);
  const insuranceRate = 0.035; // 3.5%
  const insuranceCostCurrency = declaredValNum * insuranceRate;

  const cnyRate = settings?.exchange_rate_cny_xaf_under_1m || 100;
  const usdRate = 620; // Taux de référence USD / XAF
  const rateToXaf = form.currency === 'USD' ? usdRate : cnyRate;
  const insuranceCostXaf = Math.round(insuranceCostCurrency * rateToXaf);

  const update = (k: string, v: any) => setForm((f) => {
    if (k === 'transport_mode') {
      const nextKey = defaultFreightCategoryKey(v);
      const keys = freightCategoriesForMode(v).map((c) => c.key);
      return {
        ...f,
        transport_mode: v,
        category_key: keys.includes(f.category_key) ? f.category_key : nextKey,
      };
    }
    return { ...f, [k]: v };
  });

  const onPickImage = async () => {
    if (photos.length >= 3) {
      Toast.show({ type: 'error', text1: t('form.photos_max3', { defaultValue: 'Maximum 3 photos' }) });
      return;
    }
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
      setPhotos((p) => [...p, data].slice(0, 3));
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
      if (!form.supplier_name || !form.description || !form.supplier_tracking.trim()) {
        Toast.show({ type: 'error', text1: t('errors.required') });
        return false;
      }
      if (photos.length < 1) {
        Toast.show({
          type: 'error',
          text1: t('form.photos_required', { defaultValue: 'Ajoutez 1 à 3 photos du colis' }),
        });
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

    if (form.insurance_enabled && payInsuranceNow && insuranceCostXaf > 0 && (insuranceMethod === 'om' || insuranceMethod === 'momo')) {
      if (!insurancePhone || insurancePhone.trim().length < 8) {
        Toast.show({ type: 'error', text1: 'Numéro de téléphone requis pour le paiement Mobile Money' });
        return;
      }
    }

    setSubmitting(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      const payload = {
        ...form,
        declared_value: declaredValNum,
        insurance_enabled: form.insurance_enabled,
        insurance_rate: insuranceRate,
        insurance_amount: form.insurance_enabled ? insuranceCostXaf : 0,
        weight_real: 0,
        weight_volumetric: 0,
        dimensions: { l: 0, w: 0, h: 0 },
        photos,
      };

      // 1. Créer le colis
      const c = await colisApi.create(payload);
      addColis(c);
      setCreatedColis(c);
      setCreatedTracking(c.tracking_number);

      // 2. Déclencher le paiement de l'assurance si demandé
      if (form.insurance_enabled && payInsuranceNow && insuranceCostXaf > 0) {
        try {
          if (insuranceMethod === 'bank') {
            await paymentsApi.payBank({
              package_id: c.id,
              amount: insuranceCostXaf,
              payment_type: 'insurance',
              reference: `ASSUR-${c.tracking_number}`,
            });
            Toast.show({ 
              type: 'success', 
              text1: 'Colis créé et virement assurance enregistré', 
              text2: 'Validation sous 3 jours' 
            });
          } else {
            await paymentsApi.payMobile({
              package_id: c.id,
              amount: insuranceCostXaf,
              phone: insurancePhone.trim(),
              method: insuranceMethod,
              payment_type: 'insurance',
            });
            Toast.show({ 
              type: 'success', 
              text1: t('form.insurance_payment_success', { defaultValue: 'Assurance initiée avec succès !' }),
              text2: 'Validez la transaction sur votre téléphone'
            });
          }
        } catch (payErr: any) {
          Toast.show({ 
            type: 'info', 
            text1: 'Colis créé !', 
            text2: 'Paiement assurance en attente dans l\'espace colis' 
          });
        }
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
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

            {form.insurance_enabled && (
              <View style={styles.insuranceSuccessBadge}>
                <ShieldCheck size={18} color="#10B981" />
                <Text style={styles.insuranceSuccessText}>
                  Assurance 3.5% enregistrée ({insuranceCostXaf.toLocaleString()} FCFA)
                </Text>
              </View>
            )}
          </View>

          <Text style={styles.instrSectionTitle}>MARQUAGE À FOURNIR AU FOURNISSEUR</Text>
          
          <ShippingMark 
            name={user?.full_name || ''} 
            phone={user?.phone || ''} 
            city={user?.city || ''} 
            transportMode={form.transport_mode}
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

              <FieldLabel label={t('form.supplier_tracking', { defaultValue: 'Tracking fournisseur' })} required />
              <TextInput
                style={styles.input}
                value={form.supplier_tracking}
                onChangeText={(v) => update('supplier_tracking', v)}
                placeholder={t('form.supplier_tracking_ph', { defaultValue: 'N° de suivi donné par le fournisseur' })}
                placeholderTextColor={colors.textSecondary}
                testID="step1-supplier-tracking"
              />

              <FieldLabel label={t('form.photos', { defaultValue: 'Photos du colis (1 à 3)' })} required />
              <View style={styles.photoRow}>
                {photos.map((uri, idx) => (
                  <View key={idx} style={styles.photoThumbWrap}>
                    <Image source={{ uri }} style={styles.photoThumb} />
                    <TouchableOpacity style={styles.photoRemove} onPress={() => onRemovePhoto(idx)}>
                      <X size={10} color="#fff" />
                    </TouchableOpacity>
                  </View>
                ))}
                {photos.length < 3 && (
                  <TouchableOpacity style={styles.photoAdd} onPress={onPickImage} testID="step1-add-photo">
                    <Text style={styles.photoAddText}>+</Text>
                  </TouchableOpacity>
                )}
              </View>
              <Text style={styles.instr}>{t('form.photos_hint', { defaultValue: `${photos.length}/3 photos — obligatoires pour la déclaration` })}</Text>

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

              <FieldLabel
                label={t('form.freight_category', { defaultValue: 'Catégorie tarifaire' })}
                required
              />
              <Text style={styles.instr}>
                {t('form.freight_category_hint', {
                  defaultValue: 'Même grille que le simulateur de fret (Express, Normal, Balles…)',
                })}
              </Text>
              <CategoryChips
                items={freightCategoriesForMode(form.transport_mode)}
                activeKey={form.category_key}
                onSelect={(key) => update('category_key', key)}
              />

              <FieldLabel label={t('form.delivery_address')} />
              <TextInput style={[styles.input, { height: 80 }]} multiline value={form.delivery_address} onChangeText={(v) => update('delivery_address', v)} />

              {/* CARTE D'ASSURANCE 3.5% ULTRA-MODERNE & CLAIRE */}
              <View style={[styles.insuranceCardContainer, form.insurance_enabled && styles.insuranceCardActive]}>
                <View style={styles.insuranceTopRow}>
                  <View style={styles.insuranceTitleWrap}>
                    <View style={[styles.insuranceIconBadge, form.insurance_enabled ? { backgroundColor: '#10B981' } : { backgroundColor: '#E2E8F0' }]}>
                      <ShieldCheck size={20} color={form.insurance_enabled ? '#FFFFFF' : '#64748B'} strokeWidth={2.4} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.insuranceCardTitle}>Assurance Cargo</Text>
                        <View style={styles.rateTag}>
                          <Text style={styles.rateTagText}>3.5%</Text>
                        </View>
                      </View>
                      <Text style={styles.insuranceCardSub}>
                        {t('form.insurance_desc', { defaultValue: 'Protection intégrale 100% contre perte ou avarie' })}
                      </Text>
                    </View>
                  </View>
                  <Switch 
                    value={form.insurance_enabled} 
                    onValueChange={(v) => {
                      Haptics.selectionAsync();
                      update('insurance_enabled', v);
                    }} 
                    trackColor={{ true: '#10B981', false: '#D1D5DB' }} 
                    thumbColor="#fff" 
                  />
                </View>

                {form.insurance_enabled && (
                  <View style={styles.insuranceCalculationBox}>
                    <View style={styles.calcRow}>
                      <Text style={styles.calcLabel}>Valeur déclarée :</Text>
                      <Text style={styles.calcValue}>{declaredValNum.toLocaleString()} {form.currency}</Text>
                    </View>
                    <View style={styles.calcRow}>
                      <Text style={styles.calcLabel}>Prime d'assurance (3.5%) :</Text>
                      <Text style={styles.calcHighlight}>
                        {insuranceCostCurrency.toFixed(2)} {form.currency} ({insuranceCostXaf.toLocaleString()} FCFA)
                      </Text>
                    </View>
                  </View>
                )}
              </View>

              <FieldLabel label={t('form.instructions')} />
              <TextInput style={[styles.input, { height: 80 }]} multiline value={form.instructions} onChangeText={(v) => update('instructions', v)} />
            </View>
          )}

          {step === 2 && (
            <View style={styles.card}>
              <Text style={styles.recap}>{t('form.recap')}</Text>
              <RecapRow label={t('form.supplier_name')} value={form.supplier_name} />
              <RecapRow label={t('form.supplier_tracking', { defaultValue: 'Tracking fournisseur' })} value={form.supplier_tracking} />
              <RecapRow label={t('form.platform')} value={form.platform} />
              <RecapRow label={t('form.description')} value={form.description} />
              <RecapRow label={t('form.photos', { defaultValue: 'Photos' })} value={`${photos.length} photo(s)`} />
              <RecapRow label={t('form.category')} value={t(`categories.${form.category}`)} />
              <RecapRow
                label={t('form.freight_category', { defaultValue: 'Catégorie tarifaire' })}
                value={freightCategoryLabel(form.transport_mode, form.category_key)}
              />
              <RecapRow label={t('form.declared_value')} value={`${form.declared_value || 0} ${form.currency}`} />
              <RecapRow label={t('form.transport_mode')} value={t(`transport.${form.transport_mode}`)} />
              <RecapRow 
                label={t('form.insurance')} 
                value={form.insurance_enabled ? `Oui (3.5% = ${insuranceCostXaf.toLocaleString()} FCFA)` : t('common.no')} 
              />

              {photos.length > 0 && (
                <View style={[styles.photoRow, { marginTop: spacing.md }]}>
                  {photos.map((uri, idx) => (
                    <Image key={idx} source={{ uri }} style={styles.photoThumb} />
                  ))}
                </View>
              )}

              {/* MODULE DE PAIEMENT DIRECT DE L'ASSURANCE DANS LE FLUX DE CREATION */}
              {form.insurance_enabled && insuranceCostXaf > 0 && (
                <View style={styles.insurancePaymentSection}>
                  <View style={styles.insurancePaymentHeader}>
                    <ShieldCheck size={20} color="#2563EB" />
                    <Text style={styles.insurancePaymentTitle}>Règlement de l'assurance (3.5%)</Text>
                  </View>
                  <Text style={styles.insurancePaymentSub}>
                    Montant à régler : <Text style={{ fontWeight: '900', color: '#0F172A' }}>{insuranceCostXaf.toLocaleString()} FCFA</Text>
                  </Text>

                  {/* Choix mode de paiement */}
                  <PaymentMethodSelector
                    selectedMethod={insuranceMethod}
                    onSelectMethod={(m) => setInsuranceMethod(m)}
                    phone={insurancePhone}
                    onSuggestMethod={(m) => setInsuranceMethod(m)}
                  />

                  {(insuranceMethod === 'om' || insuranceMethod === 'momo') && (
                    <View style={styles.phoneInputWrap}>
                      <Text style={styles.phoneLabel}>
                        Numéro {insuranceMethod === 'om' ? 'Orange Money' : 'MTN MoMo'} pour validation :
                      </Text>
                      <TextInput
                        style={styles.phoneInput}
                        value={insurancePhone}
                        onChangeText={setInsurancePhone}
                        placeholder="Ex: 6XXXXXXXX"
                        placeholderTextColor="#94A3B8"
                        keyboardType="phone-pad"
                      />
                    </View>
                  )}

                  {insuranceMethod === 'bank' && (
                    <View style={styles.bankNoteWrap}>
                      <Text style={styles.bankNoteText}>
                        Les coordonnées bancaires MOG GROUP vous seront affichées après confirmation.
                      </Text>
                    </View>
                  )}
                </View>
              )}

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
          <TouchableOpacity 
            style={[styles.nextBtn, step === 0 && { flex: 1 }]} 
            onPress={step < 2 ? onNext : onSubmit} 
            disabled={submitting} 
            testID="step-next"
          >
            <Text style={styles.nextText}>
              {submitting 
                ? t('common.loading') 
                : (step < 2 
                    ? t('form.next') 
                    : (form.insurance_enabled 
                        ? `Confirmer & Payer l'assurance (${insuranceCostXaf.toLocaleString()} F)` 
                        : t('form.confirm')))}
            </Text>
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

  /* Carte Assurance 3.5% */
  insuranceCardContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: radii.card,
    padding: spacing.md,
    marginTop: spacing.md,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  insuranceCardActive: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
  },
  insuranceTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  insuranceTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 8,
  },
  insuranceIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  insuranceCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  rateTag: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  rateTagText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#16A34A',
  },
  insuranceCardSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 15,
  },
  insuranceCalculationBox: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#DCFCE7',
  },
  calcRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  calcLabel: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '500',
  },
  calcValue: {
    fontSize: 12,
    color: '#0F172A',
    fontWeight: '700',
  },
  calcHighlight: {
    fontSize: 13,
    color: '#15803D',
    fontWeight: '900',
  },

  /* Module Paiement de l'assurance */
  insurancePaymentSection: {
    backgroundColor: '#EFF6FF',
    borderRadius: radii.card,
    padding: spacing.md,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  insurancePaymentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  insurancePaymentTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E3A8A',
  },
  insurancePaymentSub: {
    fontSize: 12,
    color: '#3B82F6',
    marginBottom: 12,
  },
  paymentMethodsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  paymentMethodBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    borderRadius: radii.input,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  paymentMethodBtnActive: {
    borderColor: '#2563EB',
    backgroundColor: '#DBEAFE',
  },
  paymentMethodText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  paymentMethodTextActive: {
    color: '#1E3A8A',
  },
  phoneInputWrap: {
    marginTop: 4,
  },
  phoneLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E3A8A',
    marginBottom: 4,
  },
  phoneInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: radii.input,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '700',
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  bankNoteWrap: {
    backgroundColor: '#FFFFFF',
    padding: 8,
    borderRadius: 8,
    marginTop: 4,
  },
  bankNoteText: {
    fontSize: 11,
    color: '#475569',
    fontStyle: 'italic',
  },

  recap: { fontSize: 14, color: colors.textSecondary, fontWeight: '600', textTransform: 'uppercase', marginBottom: spacing.sm },
  recapRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  recapLabel: { color: colors.textSecondary, fontSize: 13, flex: 1 },
  recapValue: { color: colors.text, fontWeight: '600', fontSize: 13, flex: 1, textAlign: 'right' },
  instr: { color: colors.textSecondary, fontSize: 12, fontStyle: 'italic', lineHeight: 18 },
  footer: { flexDirection: 'row', gap: spacing.md, padding: spacing.lg, backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.borderLight },
  backBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: spacing.lg, paddingVertical: 14, borderRadius: radii.button, gap: 4 },
  backText: { color: colors.text, fontWeight: '600' },
  nextBtn: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: colors.primary, paddingVertical: 14, borderRadius: radii.button, gap: 4 },
  nextText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  successWrap: { alignItems: 'center', paddingVertical: spacing.xl },
  successIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  successTitle: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: spacing.sm },
  tracking: { fontFamily: fonts.mono, fontSize: 16, fontWeight: '700', color: colors.primary, backgroundColor: colors.background, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  insuranceSuccessBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  insuranceSuccessText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#065F46',
  },
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
