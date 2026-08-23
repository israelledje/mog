import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  KeyboardAvoidingView, 
  Platform, 
  ScrollView, 
  Keyboard, 
  TouchableWithoutFeedback, 
  Image, 
  ImageBackground, 
  Linking,
  Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { Mail, Lock, Fingerprint, Copy, Plane, Anchor, MapPin, ExternalLink, X, PhoneCall, CheckCircle2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import Toast from 'react-native-toast-message';
import LanguageSelector from '../../src/components/LanguageSelector';
import { useAuthStore } from '../../src/store/authStore';
import { formatErr, saveTokens } from '../../src/api/client';
import { zodResolver } from '../../src/utils/zodResolver';
import { biometricService } from '../../src/api/biometrics';
import { colors, fonts, radii, shadow, spacing } from '../../src/constants/theme';
import { CHINA_WAREHOUSE_ADDRESS } from '../../src/constants/warehouse';

type LoginForm = { email: string; password: string };

type AddressItem = {
  id: string;
  title: string;
  badge: string;
  icon: any;
  color: string;
  address: string;
};

const AIR_CARGO_ADDRESS = `广东省广州市越秀区广园西路83号宇航大厦添越中心负二层205A档 18802010441`;
const DOUALA_ADDRESS = `DOUALA : New Bell, Avant Commissariat 6ème. Tél : 655 367 619 / 694 534 159`;
const YAOUNDE_ADDRESS = `YAOUNDE : Messa, En Face total. Tél : 699 242 986 / 698 32 11 87`;

const ADDRESSES: AddressItem[] = [
  {
    id: 'air',
    title: 'Air Cargo',
    badge: 'CHINE (GUANGZHOU)',
    icon: Plane,
    color: '#3B82F6',
    address: AIR_CARGO_ADDRESS,
  },
  {
    id: 'sea',
    title: 'Maritime',
    badge: 'CHINE (FOSHAN)',
    icon: Anchor,
    color: '#10B981',
    address: CHINA_WAREHOUSE_ADDRESS,
  },
  {
    id: 'douala',
    title: 'Douala',
    badge: 'CAMEROUN',
    icon: MapPin,
    color: '#F59E0B',
    address: DOUALA_ADDRESS,
  },
  {
    id: 'yaounde',
    title: 'Yaoundé',
    badge: 'CAMEROUN',
    icon: MapPin,
    color: '#8B5CF6',
    address: YAOUNDE_ADDRESS,
  },
];

export default function LoginScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const loading = useAuthStore((s) => s.loading);
  const [error, setError] = useState<string | null>(null);
  const [bioEnabled, setBioEnabled] = useState(false);
  
  // State pour la modale d'adresse
  const [selectedAddress, setSelectedAddress] = useState<AddressItem | null>(null);

  const schema = z.object({
    email: z.string().min(1, t('errors.required')).refine((val) => {
      const cleanVal = val.trim();
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanVal);
      const isPhone = /^[0-9+\s-]{6,15}$/.test(cleanVal);
      return isEmail || isPhone;
    }, { message: t('errors.invalid_email') }),
    password: z.string().min(6, t('errors.password_min')),
  });

  const { control, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
    mode: 'onTouched',
  });

  React.useEffect(() => {
    (async () => {
      const enabled = await biometricService.isEnabled();
      setBioEnabled(enabled);
      if (enabled) {
        setTimeout(handleBiometric, 500);
      }
    })();
  }, []);

  const handleBiometric = async () => {
    try {
      const refreshToken = await biometricService.authenticate();
      if (refreshToken) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        await saveTokens('', refreshToken);
        await useAuthStore.getState().bootstrap();
        
        const authedUser = useAuthStore.getState().user;
        if (authedUser) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          if (authedUser.role === 'operator' || authedUser.role === 'admin') {
            router.replace('/(operator)');
          } else {
            router.replace('/(tabs)');
          }
        } else {
          Toast.show({ type: 'error', text1: 'Session biométrique expirée, veuillez vous reconnecter.' });
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const onSubmit = handleSubmit(async ({ email, password }) => {
    Keyboard.dismiss();
    setError(null);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const user = await login(email.trim(), password);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (user.role === 'operator') {
        router.replace('/(operator)');
      } else if (user.role === 'admin') {
        const { getAdminUiMode } = await import('../../src/utils/adminMode');
        const mode = await getAdminUiMode();
        router.replace(mode === 'client' ? '/(tabs)' : '/(operator)');
      } else {
        router.replace('/(tabs)');
      }
    } catch (e: any) {
      const msg = formatErr(e, t('errors.invalid_credentials'));
      setError(msg.includes('Invalid') ? t('errors.invalid_credentials') : msg);
      Toast.show({ type: 'error', text1: t('errors.invalid_credentials') });
    }
  });

  const copyToClipboard = async (text: string) => {
    await Clipboard.setStringAsync(text);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Toast.show({
      type: 'success',
      text1: 'Adresse copiée !',
      text2: 'Collez-la directement pour votre fournisseur ou livreur.',
    });
  };

  const openSocialLink = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch (err) {
      console.error('Failed to open url:', err);
    }
  };

  return (
    <ImageBackground
      source={require('../../assets/images/logistics-transportation-container-cargo-ship-cargo-plane-with-working-crane-bridge-shipyard-sunrise-logistic-import-export-transport-industry-background-ai-generative.jpg')}
      style={styles.bgImage}
      resizeMode="cover"
    >
      {/* Superposition sombre renforcée pour une excellente lisibilité du texte */}
      <View style={styles.bgOverlay} />
      
      <SafeAreaView style={styles.container} edges={['top', 'bottom']} testID="login-screen">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              
              <View style={styles.langRow}>
                <LanguageSelector />
              </View>

              <View style={styles.brandWrap}>
                <View style={styles.logoWrap}>
                  <Image source={require('../../assets/images/logo_MOG.jpeg')} style={styles.logoImg} resizeMode="contain" />
                </View>
                <Text style={styles.brandTitle}>{t('auth.brand_name')}</Text>
                <Text style={styles.brandSubtitle}>{t('auth.welcome_subtitle')}</Text>
                <Text style={styles.brandSlogan}>{t('auth.brand_slogan')}</Text>
              </View>

              {/* Formulaire Compact & Moderne */}
              <View style={styles.card}>
                <Text style={styles.welcome}>{t('auth.welcome_back')}</Text>

                <Controller
                  control={control}
                  name="email"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <View style={[styles.inputWrap, errors.email && styles.inputError]}>
                      <Mail size={18} color={colors.textSecondary} />
                      <TextInput
                        testID="login-email"
                        style={styles.input}
                        placeholder="Email ou N° Téléphone"
                        placeholderTextColor={colors.textSecondary}
                        autoCapitalize="none"
                        keyboardType="email-address"
                        value={value}
                        onChangeText={onChange}
                        onBlur={onBlur}
                      />
                    </View>
                  )}
                />
                {errors.email && <Text style={styles.fieldError} testID="login-email-error">{errors.email.message}</Text>}

                <Controller
                  control={control}
                  name="password"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <View style={[styles.inputWrap, errors.password && styles.inputError]}>
                      <Lock size={18} color={colors.textSecondary} />
                      <TextInput
                        testID="login-password"
                        style={styles.input}
                        placeholder={t('auth.password')}
                        placeholderTextColor={colors.textSecondary}
                        secureTextEntry
                        value={value}
                        onChangeText={onChange}
                        onBlur={onBlur}
                      />
                    </View>
                  )}
                />
                {errors.password && <Text style={styles.fieldError} testID="login-password-error">{errors.password.message}</Text>}

                <TouchableOpacity onPress={() => router.push('/(auth)/forgot-password')} style={styles.forgotBtn} testID="login-forgot">
                  <Text style={styles.forgotText}>{t('auth.forgot_password')}</Text>
                </TouchableOpacity>

                {error && <Text style={styles.error}>{error}</Text>}

                <View style={styles.submitRow}>
                  <TouchableOpacity style={styles.submit} onPress={onSubmit} disabled={loading} testID="login-submit-button" accessibilityRole="button" accessibilityLabel={t('auth.sign_in')}>
                    <Text style={styles.submitText}>{loading ? t('common.loading') : t('auth.sign_in')}</Text>
                  </TouchableOpacity>
                  
                  {bioEnabled && (
                    <TouchableOpacity style={styles.bioBtn} onPress={handleBiometric} accessibilityRole="button" accessibilityLabel={t('profile.biometrics')}>
                      <Fingerprint size={26} color={colors.primary} />
                    </TouchableOpacity>
                  )}
                </View>

                <View style={styles.bottomRow}>
                  <Text style={styles.bottomText}>{t('auth.no_account')} </Text>
                  <Link href="/(auth)/register" asChild>
                    <TouchableOpacity testID="login-go-register">
                      <Text style={styles.link}>{t('auth.sign_up')}</Text>
                    </TouchableOpacity>
                  </Link>
                </View>

                <View style={styles.dividerWrap}>
                  <View style={styles.divider} />
                  <Text style={styles.dividerText}>{t('common.or')}</Text>
                  <View style={styles.divider} />
                </View>

                <TouchableOpacity 
                  style={styles.operatorBtn} 
                  onPress={() => router.push('/(auth)/operator-login')} 
                  testID="login-operator"
                  accessibilityRole="button"
                  accessibilityLabel={t('auth.operator_login')}
                >
                  <Text style={styles.operatorBtnText}>{t('auth.operator_login')}</Text>
                </TouchableOpacity>
              </View>

              {/* Grille d'Icônes pour les Entrepôts & Agences */}
              <View style={styles.addressSection}>
                <Text style={styles.addressSectionTitle}>Nos Entrepôts & Agences</Text>
                <View style={styles.addressGrid}>
                  {ADDRESSES.map((item) => {
                    const IconComp = item.icon;
                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={styles.gridItem}
                        onPress={() => {
                          Haptics.selectionAsync();
                          setSelectedAddress(item);
                        }}
                        activeOpacity={0.75}
                      >
                        <View style={[styles.gridIconWrap, { backgroundColor: item.color + '20' }]}>
                          <IconComp size={22} color={item.color} />
                        </View>
                        <Text style={styles.gridItemTitle}>{item.title}</Text>
                        <Text style={styles.gridItemSub}>{item.badge}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Réseaux Sociaux MOG */}
              <View style={styles.socialCard}>
                <Text style={styles.socialTitle}>Rejoignez-nous sur nos réseaux</Text>
                <View style={styles.socialRow}>
                  <TouchableOpacity 
                    style={[styles.socialPill, { backgroundColor: '#E1306C' }]} 
                    onPress={() => openSocialLink('https://www.instagram.com/mog_group_multiservice?igsh=MXJrejc0a2gwYTZkOQ==')}
                  >
                    <ExternalLink size={13} color="#fff" />
                    <Text style={styles.socialText}>Instagram</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[styles.socialPill, { backgroundColor: '#1877F2' }]} 
                    onPress={() => openSocialLink('https://www.facebook.com/share/1BjDRxHTdF/?mibextid=wwXIfr')}
                  >
                    <ExternalLink size={13} color="#fff" />
                    <Text style={styles.socialText}>Facebook</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[styles.socialPill, { backgroundColor: '#000000' }]} 
                    onPress={() => openSocialLink('https://www.tiktok.com/@moggroupmultiservice4?_r=1&_t=ZS-98POD5Aaq0a')}
                  >
                    <ExternalLink size={13} color="#fff" />
                    <Text style={styles.socialText}>TikTok</Text>
                  </TouchableOpacity>
                </View>
              </View>

            </ScrollView>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>

        {/* Modale d'Affichage & Copie d'Adresse */}
        <Modal
          visible={!!selectedAddress}
          transparent
          animationType="fade"
          onRequestClose={() => setSelectedAddress(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <View style={styles.modalTitleRow}>
                  {selectedAddress && (
                    <View style={[styles.modalIconWrap, { backgroundColor: selectedAddress.color + '20' }]}>
                      <selectedAddress.icon size={20} color={selectedAddress.color} />
                    </View>
                  )}
                  <View>
                    <Text style={styles.modalTitle}>{selectedAddress?.title}</Text>
                    <Text style={styles.modalBadge}>{selectedAddress?.badge}</Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setSelectedAddress(null)}>
                  <X size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <View style={styles.modalBody}>
                <Text style={styles.modalAddressText}>{selectedAddress?.address}</Text>
              </View>

              <View style={styles.modalFooter}>
                <TouchableOpacity 
                  style={styles.modalCopyBtn} 
                  onPress={() => {
                    if (selectedAddress) {
                      copyToClipboard(selectedAddress.address);
                    }
                  }}
                >
                  <Copy size={18} color="#fff" />
                  <Text style={styles.modalCopyBtnText}>Copier l'adresse</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bgImage: { flex: 1, width: '100%', height: '100%' },
  // Assombrissement renforcé de l'arrière plan (0.78)
  bgOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(11, 19, 36, 0.78)' },
  container: { flex: 1 },
  scroll: { flexGrow: 1, padding: spacing.lg, paddingBottom: spacing.xxl },
  langRow: { alignItems: 'flex-end' },
  brandWrap: { alignItems: 'center', marginTop: spacing.xs, marginBottom: spacing.sm },
  logoWrap: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center', ...shadow.floating,
    padding: 4,
  },
  logoImg: { width: '100%', height: '100%', borderRadius: 32 },
  brandTitle: { fontSize: 24, fontWeight: '900', color: '#FFFFFF', marginTop: spacing.sm, fontFamily: fonts.heading, letterSpacing: 0.5 },
  brandSubtitle: { fontSize: 12, color: '#CBD5E1', marginTop: 2, textAlign: 'center', paddingHorizontal: 16, lineHeight: 17 },
  brandSlogan: { fontSize: 11, color: '#60A5FA', marginTop: 4, fontWeight: '700', textAlign: 'center', fontStyle: 'italic' },
  
  /* Formulaire compact & moderne */
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderRadius: radii.card + 4,
    padding: spacing.md + 2,
    ...shadow.floating,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
  },
  welcome: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: spacing.md },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: '#F8FAFC', borderRadius: radii.input, paddingHorizontal: spacing.md,
    marginBottom: spacing.sm, height: 46, borderWidth: 1, borderColor: '#E2E8F0',
  },
  input: { flex: 1, fontSize: 14, color: colors.text },
  inputError: { borderWidth: 1, borderColor: colors.danger },
  fieldError: { color: colors.danger, fontSize: 11, marginTop: -spacing.xs, marginBottom: spacing.xs, marginLeft: spacing.xs },
  forgotBtn: { alignSelf: 'flex-end', marginBottom: spacing.sm },
  forgotText: { color: colors.primary, fontSize: 12, fontWeight: '600' },
  error: { color: colors.danger, fontSize: 12, marginBottom: spacing.xs },
  submitRow: { flexDirection: 'row', gap: 10 },
  submit: { flex: 1, backgroundColor: colors.primary, borderRadius: radii.button, paddingVertical: 12, alignItems: 'center' },
  submitText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  bioBtn: { width: 46, height: 46, borderRadius: radii.button, borderWidth: 1.5, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EFF6FF' },
  bottomRow: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.md },
  bottomText: { color: colors.textSecondary, fontSize: 13 },
  link: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  dividerWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginVertical: spacing.md },
  divider: { flex: 1, height: 1, backgroundColor: colors.borderLight },
  dividerText: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
  operatorBtn: { 
    borderWidth: 1, 
    borderColor: '#BFDBFE', 
    borderRadius: radii.button, 
    paddingVertical: 10, 
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
  },
  operatorBtnText: { color: colors.primary, fontWeight: '700', fontSize: 14 },

  /* Grille des adresses entrepôts & agences */
  addressSection: {
    marginTop: spacing.md,
  },
  addressSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#E2E8F0',
    marginBottom: spacing.xs + 2,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  addressGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  gridItem: {
    width: '48%',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: radii.card,
    padding: spacing.md,
    alignItems: 'center',
    ...shadow.card,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
  gridIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  gridItemTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },
  gridItemSub: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
    marginTop: 2,
  },

  /* Social Media */
  socialCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: radii.card,
    padding: spacing.md,
    marginTop: spacing.md,
    alignItems: 'center',
    ...shadow.card,
  },
  socialTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  socialRow: {
    flexDirection: 'row',
    gap: spacing.xs + 2,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  socialPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  socialText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },

  /* Modal Adresse */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: radii.card + 6,
    padding: spacing.lg,
    ...shadow.floating,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  modalIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  modalBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalBody: {
    backgroundColor: '#F8FAFC',
    borderRadius: radii.input,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: spacing.lg,
  },
  modalAddressText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 22,
    fontFamily: fonts.body,
    fontWeight: '500',
  },
  modalFooter: {},
  modalCopyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: radii.button,
  },
  modalCopyBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});


