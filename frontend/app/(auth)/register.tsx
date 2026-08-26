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
  Modal
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { ChevronLeft, ChevronDown, Eye, EyeOff, User, Mail, Lock, Gift, MapPin } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Toast from 'react-native-toast-message';
import LanguageSelector from '../../src/components/LanguageSelector';
import { useAuthStore } from '../../src/store/authStore';
import { formatErr } from '../../src/api/client';
import PhoneInput from '../../src/components/PhoneInput';
import { buildFullPhone, parsePhone } from '../../src/utils/phone';
import { colors, fonts, radii, shadow, spacing } from '../../src/constants/theme';

const CITIES = ['Douala', 'Yaoundé', 'Bafoussam', 'Garoua', 'Maroua', 'Bamenda', 'Bertoua', 'Autre'];

type FieldErrors = Partial<Record<'full_name' | 'email' | 'nationalNumber' | 'password', string>>;

export default function RegisterScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const register = useAuthStore((s) => s.register);
  const loading = useAuthStore((s) => s.loading);
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    dialCode: parsePhone().country.dial,
    nationalNumber: '',
    password: '',
    city: 'Douala',
    referral_code: '',
  });
  const [showCity, setShowCity] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const onChange = (k: string, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setFieldErrors((e) => ({ ...e, [k]: undefined }));
  };

  const schema = z.object({
    full_name: z.string().trim().min(2, t('errors.required')),
    email: z.string().min(1, t('errors.required')).email(t('errors.invalid_email')),
    nationalNumber: z.string().trim().min(6, t('errors.required')),
    password: z.string().min(6, t('errors.password_min')),
  });

  const onSubmit = async () => {
    Keyboard.dismiss();
    setError(null);
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const errs: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FieldErrors;
        if (key && !errs[key]) errs[key] = issue.message;
      }
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await register({
        full_name: form.full_name,
        email: form.email,
        phone: buildFullPhone(form.dialCode, form.nationalNumber),
        password: form.password,
        city: form.city,
        preferred_language: i18n.language,
        referral_code: form.referral_code.trim() || undefined,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(tabs)');
    } catch (e: any) {
      const msg = formatErr(e, t('errors.server'));
      setError(msg);
      Toast.show({ type: 'error', text1: msg });
    }
  };

  return (
    <LinearGradient
      colors={['#F0F5FF', '#F8FAFC', '#F1F5F9', '#EFF6FF']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.screenBg}
      testID="register-screen"
    >
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            
            {/* Header bleu royal élégant identique à login.tsx */}
            <ImageBackground
              source={require('../../assets/images/home.jpg')}
              style={styles.heroHeader}
              resizeMode="cover"
            >
              <View style={styles.heroOverlay} />
              <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
                <View style={styles.headerTopRow}>
                  <TouchableOpacity onPress={() => router.push('/(auth)/login')} style={styles.backBtn} testID="register-back">
                    <ChevronLeft size={24} color="#FFFFFF" />
                  </TouchableOpacity>
                  <LanguageSelector />
                </View>

                <View style={styles.heroBrandArea}>
                  <View style={styles.brandBadgeSquare}>
                    <Image source={require('../../assets/images/logo_MOG.jpeg')} style={styles.logoImgSquare} resizeMode="contain" />
                  </View>
                  <Text style={styles.heroTitleMain}>{t('auth.brand_name')}</Text>
                  <Text style={styles.heroSloganSub}>{t('auth.brand_slogan')}</Text>
                  <Text style={styles.heroSubtitleDesc}>{t('auth.create_account_subtitle')}</Text>
                </View>
              </SafeAreaView>
            </ImageBackground>

            {/* Carte Blanche de Formulaire 100% Full Width (Identique Connexion) */}
            <View style={styles.cardContainer}>
              <View style={styles.authCard}>
                
                {/* Segmented Switcher Log In / Sign Up */}
                <View style={styles.tabSwitcher}>
                  <TouchableOpacity 
                    style={styles.tabBtn} 
                    onPress={() => {
                      Haptics.selectionAsync();
                      router.push('/(auth)/login');
                    }}
                  >
                    <Text style={styles.tabText}>{t('auth.login')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.tabBtn, styles.tabBtnActive]}>
                    <Text style={[styles.tabText, styles.tabTextActive]}>{t('auth.register')}</Text>
                  </TouchableOpacity>
                </View>

                {/* Champ Nom Complet */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>{t('auth.full_name')}</Text>
                  <View style={[styles.inputBox, fieldErrors.full_name && styles.inputError]}>
                    <User size={18} color="#64748B" style={{ marginRight: 8 }} />
                    <TextInput
                      style={styles.input}
                      placeholder="Ex: Jean Dupont"
                      placeholderTextColor="#94A3B8"
                      value={form.full_name}
                      onChangeText={(v) => onChange('full_name', v)}
                      testID="register-name"
                    />
                  </View>
                  {fieldErrors.full_name && <Text style={styles.fieldError} testID="register-name-error">{fieldErrors.full_name}</Text>}
                </View>

                {/* Champ Téléphone */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>{t('auth.phone')}</Text>
                  <PhoneInput
                    dialCode={form.dialCode}
                    nationalNumber={form.nationalNumber}
                    onDialCodeChange={(v) => onChange('dialCode', v)}
                    onNationalNumberChange={(v) => onChange('nationalNumber', v)}
                    placeholder={t('auth.phone')}
                    testID="register-phone"
                  />
                  {fieldErrors.nationalNumber && <Text style={styles.fieldError} testID="register-phone-error">{fieldErrors.nationalNumber}</Text>}
                </View>

                {/* Champ Email */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>{t('auth.email')}</Text>
                  <View style={[styles.inputBox, fieldErrors.email && styles.inputError]}>
                    <Mail size={18} color="#64748B" style={{ marginRight: 8 }} />
                    <TextInput
                      style={styles.input}
                      placeholder="exemple@email.com"
                      placeholderTextColor="#94A3B8"
                      autoCapitalize="none"
                      keyboardType="email-address"
                      value={form.email}
                      onChangeText={(v) => onChange('email', v)}
                      testID="register-email"
                    />
                  </View>
                  {fieldErrors.email && <Text style={styles.fieldError} testID="register-email-error">{fieldErrors.email}</Text>}
                </View>

                {/* Champ Mot de passe avec Toggle Œil */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>{t('auth.password')}</Text>
                  <View style={[styles.inputBox, fieldErrors.password && styles.inputError]}>
                    <Lock size={18} color="#64748B" style={{ marginRight: 8 }} />
                    <TextInput
                      style={styles.input}
                      placeholder="••••••••"
                      placeholderTextColor="#94A3B8"
                      secureTextEntry={!showPassword}
                      value={form.password}
                      onChangeText={(v) => onChange('password', v)}
                      testID="register-password"
                    />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ padding: 4 }}>
                      {showPassword ? <EyeOff size={18} color="#64748B" /> : <Eye size={18} color="#64748B" />}
                    </TouchableOpacity>
                  </View>
                  {fieldErrors.password && <Text style={styles.fieldError} testID="register-password-error">{fieldErrors.password}</Text>}
                </View>

                {/* Sélecteur de Ville */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Ville de livraison</Text>
                  <TouchableOpacity style={styles.pickerBox} onPress={() => setShowCity((s) => !s)} testID="register-city">
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <MapPin size={18} color="#64748B" />
                      <Text style={styles.pickerText}>{form.city || t('auth.select_city')}</Text>
                    </View>
                    <ChevronDown size={18} color="#64748B" />
                  </TouchableOpacity>

                  {showCity && (
                    <View style={styles.dropdown}>
                      {CITIES.map((c) => (
                        <TouchableOpacity key={c} style={styles.dropItem} onPress={() => { onChange('city', c); setShowCity(false); }}>
                          <Text style={styles.dropItemText}>{c}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>

                {/* Code Parrainage (Optionnel) */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Code Parrainage (Optionnel)</Text>
                  <View style={styles.inputBox}>
                    <Gift size={18} color="#64748B" style={{ marginRight: 8 }} />
                    <TextInput
                      style={styles.input}
                      placeholder="Ex: MOG2026"
                      placeholderTextColor="#94A3B8"
                      autoCapitalize="characters"
                      value={form.referral_code}
                      onChangeText={(v) => onChange('referral_code', v)}
                      testID="register-referral"
                    />
                  </View>
                </View>

                {error && <Text style={styles.errorText}>{error}</Text>}

                {/* Bouton de Soumission Vibrant Bleu */}
                <TouchableOpacity 
                  style={styles.primaryBtn} 
                  onPress={onSubmit} 
                  disabled={loading} 
                  testID="register-submit-button" 
                  accessibilityRole="button" 
                  accessibilityLabel={t('auth.sign_up')}
                >
                  <Text style={styles.primaryBtnText}>{loading ? t('common.loading') : t('auth.sign_up')}</Text>
                </TouchableOpacity>

                <View style={styles.bottomRow}>
                  <Text style={styles.bottomText}>{t('auth.already_account')} </Text>
                  <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
                    <Text style={styles.linkText}>{t('auth.sign_in')}</Text>
                  </TouchableOpacity>
                </View>

              </View>
            </View>

          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screenBg: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    paddingBottom: spacing.xxl,
  },

  /* Header Hero Sombre avec home.jpg */
  heroHeader: {
    width: '100%',
    minHeight: 240,
    backgroundColor: '#0F172A',
  },
  heroOverlay: {
    ...(StyleSheet.absoluteFill as object),
    backgroundColor: 'rgba(15, 23, 42, 0.94)',
  },
  headerSafeArea: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 40,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBrandArea: {
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  brandBadgeSquare: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 5,
    ...shadow.floating,
    borderWidth: 2,
    borderColor: '#3B82F6',
  },
  logoImgSquare: {
    width: '100%',
    height: '100%',
    borderRadius: 13,
  },
  heroTitleMain: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: spacing.xs + 4,
    fontFamily: fonts.heading,
    letterSpacing: 1,
    textAlign: 'center',
    textShadowColor: '#000000',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  heroSloganSub: {
    fontSize: 11,
    color: '#60A5FA',
    marginTop: 2,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  heroSubtitleDesc: {
    fontSize: 12,
    color: '#CBD5E1',
    marginTop: 4,
    textAlign: 'center',
    fontWeight: '500',
    paddingHorizontal: 20,
  },

  /* Carte Blanche de Formulaire 100% Full Width */
  cardContainer: {
    width: '100%',
    marginTop: -24,
  },
  authCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: spacing.lg,
    paddingTop: spacing.xl,
    ...shadow.floating,
    minHeight: 480,
  },

  /* Segmented Tab Switcher (Log In / Sign Up) */
  tabSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 4,
    marginBottom: spacing.lg,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabBtnActive: {
    backgroundColor: '#FFFFFF',
    ...shadow.sm,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  tabTextActive: {
    color: '#1E293B',
    fontWeight: '800',
  },

  /* Champs de saisie */
  fieldGroup: {
    marginBottom: spacing.md,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: radii.input + 2,
    paddingHorizontal: spacing.md,
    height: 50,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '500',
  },
  inputError: {
    borderColor: colors.danger,
  },
  fieldError: {
    color: colors.danger,
    fontSize: 11,
    marginTop: 4,
    marginLeft: 2,
  },

  /* Sélecteur de ville */
  pickerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: radii.input + 2,
    paddingHorizontal: spacing.md,
    height: 50,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  pickerText: {
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '500',
  },
  dropdown: {
    backgroundColor: '#FFFFFF',
    borderRadius: radii.input + 2,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...shadow.card,
  },
  dropItem: {
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  dropItemText: {
    fontSize: 14,
    color: '#334155',
    fontWeight: '500',
  },

  errorText: {
    color: colors.danger,
    fontSize: 13,
    marginBottom: spacing.md,
  },

  /* Bouton Soumission */
  primaryBtn: {
    backgroundColor: '#2563EB',
    borderRadius: radii.button + 2,
    paddingVertical: 15,
    alignItems: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
    marginTop: spacing.xs,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },

  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  bottomText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '500',
  },
  linkText: {
    color: '#2563EB',
    fontSize: 14,
    fontWeight: '800',
  },
});
