import React, { useState, useEffect } from 'react';
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
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Mail, Lock, Eye, EyeOff, Fingerprint, Copy, ExternalLink, X, CheckSquare, Square, Phone } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import LanguageSelector from '../../src/components/LanguageSelector';
import PhoneInput from '../../src/components/PhoneInput';
import { useAuthStore } from '../../src/store/authStore';
import { formatErr, saveTokens } from '../../src/api/client';
import { biometricService } from '../../src/api/biometrics';
import { buildFullPhone, parsePhone } from '../../src/utils/phone';
import { colors, fonts, radii, shadow, spacing } from '../../src/constants/theme';
import { CHINA_WAREHOUSE_ADDRESS } from '../../src/constants/warehouse';

type AddressItem = {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  flag: string;
  iconName: keyof typeof MaterialCommunityIcons.glyphMap;
  gradientColors: [string, string];
  accentColor: string;
  address: string;
};

const AIR_CARGO_ADDRESS = `广东省广州市越秀区广园西路83号宇航大厦添越中心负二层205A档 18802010441`;
const DOUALA_ADDRESS = `DOUALA : New Bell, Avant Commissariat 6ème. Tél : 655 367 619 / 694 534 159`;
const YAOUNDE_ADDRESS = `YAOUNDE : Messa, En Face total. Tél : 699 242 986 / 698 32 11 87`;

const ADDRESSES: AddressItem[] = [
  {
    id: 'air',
    title: 'Air Cargo',
    subtitle: 'Fret Aérien Express',
    badge: 'Guangzhou',
    flag: '🇨🇳',
    iconName: 'airplane-takeoff',
    gradientColors: ['#1E3A8A', '#2563EB'],
    accentColor: '#60A5FA',
    address: AIR_CARGO_ADDRESS,
  },
  {
    id: 'sea',
    title: 'Entrepot Maritime',
    subtitle: 'Groupage Conteneur',
    badge: 'Foshan',
    flag: '🇨🇳',
    iconName: 'ferry',
    gradientColors: ['#064E3B', '#059669'],
    accentColor: '#34D399',
    address: CHINA_WAREHOUSE_ADDRESS,
  },
  {
    id: 'douala',
    title: 'Agence Douala',
    subtitle: 'Livraison & Retrait',
    badge: 'New Bell',
    flag: '🇨🇲',
    iconName: 'store-marker-outline',
    gradientColors: ['#78350F', '#D97706'],
    accentColor: '#FBBF24',
    address: DOUALA_ADDRESS,
  },
  {
    id: 'yaounde',
    title: 'Agence Yaoundé',
    subtitle: 'Livraison & Retrait',
    badge: 'Messa',
    flag: '🇨🇲',
    iconName: 'map-marker-radius-outline',
    gradientColors: ['#4C1D95', '#7C3AED'],
    accentColor: '#A78BFA',
    address: YAOUNDE_ADDRESS,
  },
];

export default function LoginScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const loading = useAuthStore((s) => s.loading);

  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [loginMethod, setLoginMethod] = useState<'email' | 'phone'>('phone');
  const [email, setEmail] = useState('');
  const [dialCode, setDialCode] = useState(parsePhone().country.dial);
  const [nationalNumber, setNationalNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; phone?: string; password?: string }>({});
  const [bioEnabled, setBioEnabled] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<AddressItem | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const enabled = await biometricService.isEnabled();
        setBioEnabled(enabled);

        const savedMode = await AsyncStorage.getItem('@mog_last_login_mode');
        if (savedMode === 'email' || savedMode === 'phone') {
          setLoginMethod(savedMode);
        }
        const savedDial = await AsyncStorage.getItem('@mog_last_dial_code');
        if (savedDial) {
          setDialCode(savedDial);
        }
        const isRemembered = await AsyncStorage.getItem('@mog_remember_me');
        if (isRemembered === 'true') {
          setRememberMe(true);
          const savedEmail = await AsyncStorage.getItem('@mog_last_email');
          if (savedEmail) setEmail(savedEmail);
          const savedPhone = await AsyncStorage.getItem('@mog_last_phone');
          if (savedPhone) setNationalNumber(savedPhone);
        }
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  const handleMethodChange = (mode: 'email' | 'phone') => {
    Haptics.selectionAsync();
    setLoginMethod(mode);
    setFieldErrors({});
    setError(null);
    AsyncStorage.setItem('@mog_last_login_mode', mode).catch(() => {});
  };

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

  const onSubmit = async () => {
    Keyboard.dismiss();
    setError(null);
    const errs: { email?: string; phone?: string; password?: string } = {};

    if (loginMethod === 'email') {
      const cleanEmail = email.trim();
      if (!cleanEmail) {
        errs.email = t('errors.required');
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        errs.email = t('errors.invalid_email');
      }
    } else {
      const cleanPhone = nationalNumber.replace(/\D/g, '');
      if (!cleanPhone) {
        errs.phone = t('errors.required');
      } else if (cleanPhone.length < 6) {
        errs.phone = t('errors.invalid_phone', 'Numéro de téléphone invalide (6 chiffres min)');
      }
    }

    if (!password) {
      errs.password = t('errors.required');
    } else if (password.length < 6) {
      errs.password = t('errors.password_min');
    }

    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    setFieldErrors({});
    const identifier = loginMethod === 'email'
      ? email.trim()
      : buildFullPhone(dialCode, nationalNumber);

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      // Mémorisation rapide du choix de connexion
      if (rememberMe) {
        AsyncStorage.setItem('@mog_remember_me', 'true').catch(() => {});
        AsyncStorage.setItem('@mog_last_login_mode', loginMethod).catch(() => {});
        if (loginMethod === 'email') {
          AsyncStorage.setItem('@mog_last_email', email.trim()).catch(() => {});
        } else {
          AsyncStorage.setItem('@mog_last_phone', nationalNumber.trim()).catch(() => {});
          AsyncStorage.setItem('@mog_last_dial_code', dialCode).catch(() => {});
        }
      }

      const user = await login(identifier, password);
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
  };

  const handleTabChange = (tab: 'login' | 'register') => {
    Haptics.selectionAsync();
    if (tab === 'register') {
      router.push('/(auth)/register');
    } else {
      setActiveTab('login');
    }
  };

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
    <LinearGradient
      colors={['#F0F5FF', '#F8FAFC', '#F1F5F9', '#EFF6FF']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.screenBg}
    >
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

            {/* Header bleu royal élégant avec fond home.jpg */}
            <ImageBackground
              source={require('../../assets/images/home.jpg')}
              style={styles.heroHeader}
              resizeMode="cover"
            >
              <View style={styles.heroOverlay} />
              <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
                <View style={styles.headerTopRow}>
                  <LanguageSelector />
                </View>

                <View style={styles.heroBrandArea}>
                  <View style={styles.brandBadgeSquare}>
                    <Image source={require('../../assets/images/logo_MOG.jpeg')} style={styles.logoImgSquare} resizeMode="contain" />
                  </View>
                  <Text style={styles.heroTitleMain}>{t('auth.brand_name')}</Text>
                  <Text style={styles.heroSloganSub}>{t('auth.brand_slogan')}</Text>
                  <Text style={styles.heroSubtitleDesc}>{t('auth.welcome_subtitle')}</Text>
                </View>
              </SafeAreaView>
            </ImageBackground>

            {/* Carte Blanche interactive superposée (Modèle Figma/Dribbble) */}
            <View style={styles.cardContainer}>
              <View style={styles.authCard}>

                {/* Switcher Principal Log In / Sign Up */}
                <View style={styles.tabSwitcher}>
                  <TouchableOpacity
                    style={[styles.tabBtn, activeTab === 'login' && styles.tabBtnActive]}
                    onPress={() => handleTabChange('login')}
                  >
                    <Text style={[styles.tabText, activeTab === 'login' && styles.tabTextActive]}>{t('auth.login')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.tabBtn, activeTab === 'register' && styles.tabBtnActive]}
                    onPress={() => handleTabChange('register')}
                  >
                    <Text style={[styles.tabText, activeTab === 'register' && styles.tabTextActive]}>{t('auth.register')}</Text>
                  </TouchableOpacity>
                </View>

                {/* Sélecteur de méthode rapide : Téléphone vs Email */}
                <View style={styles.methodSwitcherWrap}>
                  <TouchableOpacity
                    style={[styles.methodBtn, loginMethod === 'phone' && styles.methodBtnActive]}
                    onPress={() => handleMethodChange('phone')}
                    testID="login-method-phone"
                    activeOpacity={0.8}
                  >
                    <Phone size={15} color={loginMethod === 'phone' ? '#2563EB' : '#64748B'} />
                    <Text style={[styles.methodBtnText, loginMethod === 'phone' && styles.methodBtnTextActive]}>
                      {t('auth.phone', 'Téléphone')}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.methodBtn, loginMethod === 'email' && styles.methodBtnActive]}
                    onPress={() => handleMethodChange('email')}
                    testID="login-method-email"
                    activeOpacity={0.8}
                  >
                    <Mail size={15} color={loginMethod === 'email' ? '#2563EB' : '#64748B'} />
                    <Text style={[styles.methodBtnText, loginMethod === 'email' && styles.methodBtnTextActive]}>
                      {t('auth.email', 'Email')}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Saisie Téléphone avec Indicatif & Drapeau */}
                {loginMethod === 'phone' ? (
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>{t('auth.phone', 'Numéro de téléphone')}</Text>
                    <PhoneInput
                      dialCode={dialCode}
                      nationalNumber={nationalNumber}
                      onDialCodeChange={(dial) => {
                        setDialCode(dial);
                        AsyncStorage.setItem('@mog_last_dial_code', dial).catch(() => {});
                      }}
                      onNationalNumberChange={(v) => {
                        setNationalNumber(v);
                        if (fieldErrors.phone) setFieldErrors((e) => ({ ...e, phone: undefined }));
                      }}
                      placeholder="698 32 11 87"
                      testID="login-phone"
                      error={!!fieldErrors.phone}
                    />
                    {fieldErrors.phone && <Text style={styles.fieldError} testID="login-phone-error">{fieldErrors.phone}</Text>}
                  </View>
                ) : (
                  /* Saisie Email */
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>{t('auth.email', 'Email')}</Text>
                    <View style={[styles.inputBox, fieldErrors.email && styles.inputError]}>
                      <Mail size={18} color="#94A3B8" style={{ marginRight: 10 }} />
                      <TextInput
                        testID="login-email"
                        style={styles.input}
                        placeholder="exemple@email.com"
                        placeholderTextColor="#94A3B8"
                        autoCapitalize="none"
                        keyboardType="email-address"
                        value={email}
                        onChangeText={(v) => {
                          setEmail(v);
                          if (fieldErrors.email) setFieldErrors((e) => ({ ...e, email: undefined }));
                        }}
                      />
                    </View>
                    {fieldErrors.email && <Text style={styles.fieldError} testID="login-email-error">{fieldErrors.email}</Text>}
                  </View>
                )}

                {/* Champ Mot de passe avec Toggle Œil */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>{t('auth.password')}</Text>
                  <View style={[styles.inputBox, fieldErrors.password && styles.inputError]}>
                    <Lock size={18} color="#94A3B8" style={{ marginRight: 10 }} />
                    <TextInput
                      testID="login-password"
                      style={styles.input}
                      placeholder="••••••••"
                      placeholderTextColor="#94A3B8"
                      secureTextEntry={!showPassword}
                      value={password}
                      onChangeText={(v) => {
                        setPassword(v);
                        if (fieldErrors.password) setFieldErrors((e) => ({ ...e, password: undefined }));
                      }}
                    />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ padding: 4 }}>
                      {showPassword ? <EyeOff size={18} color="#64748B" /> : <Eye size={18} color="#64748B" />}
                    </TouchableOpacity>
                  </View>
                  {fieldErrors.password && <Text style={styles.fieldError} testID="login-password-error">{fieldErrors.password}</Text>}
                </View>

                {/* Se souvenir de moi & Mot de passe oublié */}
                <View style={styles.optionsRow}>
                  <TouchableOpacity style={styles.rememberWrap} onPress={() => setRememberMe(!rememberMe)}>
                    {rememberMe ? <CheckSquare size={18} color="#2563EB" /> : <Square size={18} color="#94A3B8" />}
                    <Text style={styles.rememberText}>Se souvenir de moi</Text>
                  </TouchableOpacity>

                  <TouchableOpacity onPress={() => router.push('/(auth)/forgot-password')} testID="login-forgot">
                    <Text style={styles.forgotText}>{t('auth.forgot_password')}</Text>
                  </TouchableOpacity>
                </View>

                {error && <Text style={styles.errorText}>{error}</Text>}

                {/* Bouton de Connexion vibrant */}
                <View style={styles.actionRow}>
                  <TouchableOpacity style={styles.primaryLoginBtn} onPress={onSubmit} disabled={loading} testID="login-submit-button" accessibilityRole="button" accessibilityLabel={t('auth.sign_in')}>
                    <Text style={styles.primaryLoginText}>{loading ? t('common.loading') : t('auth.sign_in')}</Text>
                  </TouchableOpacity>

                  {bioEnabled && (
                    <TouchableOpacity style={styles.biometricBtn} onPress={handleBiometric} accessibilityRole="button" accessibilityLabel={t('profile.biometrics')}>
                      <Fingerprint size={26} color="#2563EB" />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Séparateur et Connexion Opérateur */}
                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerLabel}>OU ACCÈS OPÉRATEUR</Text>
                  <View style={styles.dividerLine} />
                </View>

                <TouchableOpacity
                  style={styles.operatorOutlineBtn}
                  onPress={() => router.push('/(auth)/operator-login')}
                  testID="login-operator"
                  accessibilityRole="button"
                  accessibilityLabel={t('auth.operator_login')}
                >
                  <Text style={styles.operatorOutlineText}>{t('auth.operator_login')}</Text>
                </TouchableOpacity>

              </View>

              {/* Section Adresses (Carrousel Horizontal Subtil) */}
              <View style={styles.warehouseSection}>
                <View style={styles.warehouseHeadingRow}>
                  <Text style={styles.sectionHeading}>Adresses</Text>
                  <Text style={styles.sectionSubHeading}>Glissez pour voir & copier tout ➔</Text>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalScrollList}
                  decelerationRate="fast"
                >
                  {ADDRESSES.map((item) => {
                    return (
                      <TouchableOpacity
                        key={item.id}
                        onPress={() => {
                          Haptics.selectionAsync();
                          setSelectedAddress(item);
                        }}
                        activeOpacity={0.88}
                      >
                        <LinearGradient
                          colors={item.gradientColors}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.gradientCard}
                        >
                          {/* En-tête : Drapeau/Ville + Bouton Copier */}
                          <View style={styles.gradCardHeader}>
                            <View style={styles.flagPill}>
                              <Text style={styles.flagEmoji}>{item.flag}</Text>
                              <Text style={styles.flagText}>{item.badge}</Text>
                            </View>
                            <TouchableOpacity
                              style={styles.gradCopyBtn}
                              onPress={() => copyToClipboard(item.address)}
                            >
                              <Copy size={12} color="#FFFFFF" />
                              <Text style={styles.gradCopyText}>Copier</Text>
                            </TouchableOpacity>
                          </View>

                          {/* Zone centrale : Icône Material Design + Titre & Sous-titre */}
                          <View style={styles.gradCardBody}>
                            <View style={styles.gradIconWrap}>
                              <MaterialCommunityIcons name={item.iconName} size={24} color="#FFFFFF" />
                            </View>
                            <View style={styles.gradTitleWrap}>
                              <Text style={styles.gradTitle} numberOfLines={1}>{item.title}</Text>
                              <Text style={styles.gradSubtitle} numberOfLines={1}>{item.subtitle}</Text>
                            </View>
                          </View>

                          {/* Pied de carte : Aperçu d'adresse en verre dépoli */}
                          <View style={styles.gradGlassFooter}>
                            <Text style={styles.gradAddressPreview} numberOfLines={2}>{item.address}</Text>
                          </View>
                        </LinearGradient>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Réseaux Sociaux MOG */}
              <View style={styles.socialBar}>
                <Text style={styles.socialBarTitle}>Suivez MOG Group Multiservice</Text>
                <View style={styles.socialPillsWrap}>
                  <TouchableOpacity
                    style={[styles.socialPillBtn, { backgroundColor: '#E1306C' }]}
                    onPress={() => openSocialLink('https://www.instagram.com/mog_group_multiservice?igsh=MXJrejc0a2gwYTZkOQ==')}
                  >
                    <ExternalLink size={13} color="#fff" />
                    <Text style={styles.socialPillText}>Instagram</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.socialPillBtn, { backgroundColor: '#1877F2' }]}
                    onPress={() => openSocialLink('https://www.facebook.com/share/1BjDRxHTdF/?mibextid=wwXIfr')}
                  >
                    <ExternalLink size={13} color="#fff" />
                    <Text style={styles.socialPillText}>Facebook</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.socialPillBtn, { backgroundColor: '#000000' }]}
                    onPress={() => openSocialLink('https://www.tiktok.com/@moggroupmultiservice4?_r=1&_t=ZS-98POD5Aaq0a')}
                  >
                    <ExternalLink size={13} color="#fff" />
                    <Text style={styles.socialPillText}>TikTok</Text>
                  </TouchableOpacity>
                </View>
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
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalTop}>
              <View style={styles.modalTitleBlock}>
                {selectedAddress && (
                  <View style={[styles.modalIconWrap, { backgroundColor: selectedAddress.accentColor + '20' }]}>
                    <MaterialCommunityIcons name={selectedAddress.iconName} size={24} color={selectedAddress.accentColor} />
                  </View>
                )}
                <View>
                  <Text style={styles.modalMainTitle}>{selectedAddress?.title}</Text>
                  <Text style={styles.modalSubBadge}>{selectedAddress?.badge}</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.modalCloseIcon} onPress={() => setSelectedAddress(null)}>
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBodyContainer}>
              <Text style={styles.modalAddressContent}>{selectedAddress?.address}</Text>
            </View>

            <TouchableOpacity
              style={styles.modalPrimaryCopyBtn}
              onPress={() => {
                if (selectedAddress) {
                  copyToClipboard(selectedAddress.address);
                }
              }}
            >
              <Copy size={18} color="#fff" />
              <Text style={styles.modalPrimaryCopyText}>Copier l'adresse</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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

  /* Header Hero Sombre & Élégant avec accent bleu nuit */
  heroHeader: {
    width: '100%',
    minHeight: 250,
    backgroundColor: '#0F172A',
  },
  // Superposition sombre renforcée (Navy Profond 0.94) pour faire ressortir le texte & le logo 100%
  heroOverlay: {
    ...(StyleSheet.absoluteFill as object),
    backgroundColor: 'rgba(15, 23, 42, 0.94)',
  },
  headerSafeArea: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 44,
  },
  headerTopRow: {
    alignItems: 'flex-end',
    marginTop: spacing.xs,
  },
  heroBrandArea: {
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  brandBadgeSquare: {
    width: 68,
    height: 68,
    borderRadius: 20,
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
    borderRadius: 15,
  },
  heroTitleMain: {
    fontSize: 25,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: spacing.sm,
    fontFamily: fonts.heading,
    letterSpacing: 1,
    textAlign: 'center',
    textShadowColor: '#000000',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  heroSloganSub: {
    fontSize: 12,
    color: '#60A5FA',
    marginTop: 3,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  heroSubtitleDesc: {
    fontSize: 12,
    color: '#CBD5E1',
    marginTop: 6,
    textAlign: 'center',
    fontWeight: '500',
    paddingHorizontal: 24,
    lineHeight: 18,
  },

  /* Carte Blanche de Connexion superposée (100% Full Width comme Figma) */
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
    marginBottom: spacing.md,
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

  /* Sous-sélecteur de méthode (Téléphone / Email) */
  methodSwitcherWrap: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: spacing.lg,
  },
  methodBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  methodBtnActive: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  methodBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  methodBtnTextActive: {
    color: '#2563EB',
    fontWeight: '800',
  },

  /* Champs de saisie avec Labels */
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

  /* Options Row (Remember me + Forgot pwd) */
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
    marginTop: 2,
  },
  rememberWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rememberText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  forgotText: {
    fontSize: 13,
    color: '#2563EB',
    fontWeight: '700',
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    marginBottom: spacing.md,
  },

  /* Action Buttons */
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  primaryLoginBtn: {
    flex: 1,
    backgroundColor: '#2563EB',
    borderRadius: radii.button + 2,
    paddingVertical: 15,
    alignItems: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  primaryLoginText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  biometricBtn: {
    width: 50,
    height: 50,
    borderRadius: radii.button + 2,
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
  },

  /* Separator */
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginVertical: spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  dividerLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  operatorOutlineBtn: {
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: radii.button + 2,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  operatorOutlineText: {
    color: '#475569',
    fontWeight: '700',
    fontSize: 14,
  },

  /* Section Nos Entrepôts & Agences (Carrousel Horizontal Modernisé) */
  warehouseSection: {
    marginTop: spacing.xl,
  },
  warehouseHeadingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '800',
    color: '#334155',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  sectionSubHeading: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2563EB',
  },
  horizontalScrollList: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 4,
    gap: spacing.sm,
  },
  gradientCard: {
    width: 240,
    borderRadius: radii.card + 6,
    padding: spacing.md,
    ...shadow.floating,
    justifyContent: 'space-between',
  },
  gradCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  flagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
  flagEmoji: {
    fontSize: 12,
  },
  flagText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  gradCopyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  gradCopyText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  gradCardBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 4,
  },
  gradIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  gradTitleWrap: {
    flex: 1,
  },
  gradTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  gradSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 1,
  },
  gradGlassFooter: {
    backgroundColor: 'rgba(0, 0, 0, 0.22)',
    borderRadius: radii.input,
    padding: 8,
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  gradAddressPreview: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 14,
    fontFamily: fonts.body,
  },

  /* Social Bar */
  socialBar: {
    backgroundColor: '#FFFFFF',
    borderRadius: radii.card + 2,
    padding: spacing.md,
    marginTop: spacing.md,
    alignItems: 'center',
    ...shadow.sm,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  socialBarTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: spacing.xs + 2,
  },
  socialPillsWrap: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  socialPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  socialPillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },

  /* Modal */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: radii.card + 8,
    padding: spacing.lg,
    ...shadow.floating,
  },
  modalTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  modalTitleBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  modalIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalMainTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSubBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
  },
  modalCloseIcon: {
    padding: 4,
  },
  modalBodyContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: radii.input + 2,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: spacing.lg,
  },
  modalAddressContent: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 22,
    fontFamily: fonts.body,
    fontWeight: '500',
  },
  modalPrimaryCopyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    borderRadius: radii.button + 2,
  },
  modalPrimaryCopyText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});



