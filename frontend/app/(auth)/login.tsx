import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Keyboard, TouchableWithoutFeedback, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Mail, Lock, Ship, Fingerprint } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Toast from 'react-native-toast-message';
import LanguageSelector from '../../src/components/LanguageSelector';
import { useAuthStore } from '../../src/store/authStore';
import { formatErr } from '../../src/api/client';
import { biometricService } from '../../src/api/biometrics';
import { colors, fonts, radii, shadow, spacing } from '../../src/constants/theme';
import { saveTokens } from '../../src/api/client';

export default function LoginScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const loading = useAuthStore((s) => s.loading);
  const [email, setEmail] = useState('jean@mog.cm');
  const [password, setPassword] = useState('demo123');
  const [error, setError] = useState<string | null>(null);
  const [bioEnabled, setBioEnabled] = useState(false);

  React.useEffect(() => {
    (async () => {
      const enabled = await biometricService.isEnabled();
      setBioEnabled(enabled);
      if (enabled) {
        // Auto-trigger biometrics if enabled
        setTimeout(handleBiometric, 500);
      }
    })();
  }, []);

  const handleBiometric = async () => {
    try {
      const refreshToken = await biometricService.authenticate();
      if (refreshToken) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        // On sauvegarde le refresh token et un access token vide
        // L'intercepteur Axios tentera de rafraîchir l'access_token automatiquement
        await saveTokens('', refreshToken);
        await useAuthStore.getState().bootstrap();
        
        if (useAuthStore.getState().user) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          router.replace('/(tabs)');
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
    if (!email || !password) {
      setError(t('errors.required'));
      return;
    }
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await login(email.trim(), password);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(tabs)');
    } catch (e: any) {
      const msg = formatErr(e, t('errors.invalid_credentials'));
      setError(msg.includes('Invalid') ? t('errors.invalid_credentials') : msg);
      Toast.show({ type: 'error', text1: t('errors.invalid_credentials') });
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']} testID="login-screen">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <View style={styles.langRow}>
              <LanguageSelector />
            </View>
            <View style={styles.brandWrap}>
              <View style={styles.logo}>
                <Image source={require('../../assets/images/logo_MOG.jpeg')} style={{ width: 60, height: 60 }} resizeMode="contain" />
              </View>
              <Text style={styles.brandTitle}>MOG GROUP Multiservice</Text>
              <Text style={styles.brandSubtitle}>{t('auth.welcome_subtitle')}</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.welcome}>{t('auth.welcome_back')}</Text>

              <View style={styles.inputWrap}>
                <Mail size={18} color={colors.textSecondary} />
                <TextInput
                  testID="login-email"
                  style={styles.input}
                  placeholder={t('auth.email')}
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  value={email}
                  onChangeText={setEmail}
                />
              </View>
              <View style={styles.inputWrap}>
                <Lock size={18} color={colors.textSecondary} />
                <TextInput
                  testID="login-password"
                  style={styles.input}
                  placeholder={t('auth.password')}
                  placeholderTextColor={colors.textSecondary}
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                />
              </View>

              <TouchableOpacity onPress={() => router.push('/(auth)/forgot-password')} style={styles.forgotBtn} testID="login-forgot">
                <Text style={styles.forgotText}>{t('auth.forgot_password')}</Text>
              </TouchableOpacity>

              {error && <Text style={styles.error}>{error}</Text>}

              <View style={styles.submitRow}>
                <TouchableOpacity style={styles.submit} onPress={onSubmit} disabled={loading} testID="login-submit-button">
                  <Text style={styles.submitText}>{loading ? t('common.loading') : t('auth.sign_in')}</Text>
                </TouchableOpacity>
                
                {bioEnabled && (
                  <TouchableOpacity style={styles.bioBtn} onPress={handleBiometric}>
                    <Fingerprint size={28} color={colors.primary} />
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
              >
                <Text style={styles.operatorBtnText}>Connexion Opérateur (Badge QR)</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, padding: spacing.lg, justifyContent: 'space-between' },
  langRow: { alignItems: 'flex-end' },
  brandWrap: { alignItems: 'center', marginTop: spacing.lg },
  logo: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center', ...shadow.card,
  },
  brandTitle: { fontSize: 28, fontWeight: '800', color: colors.primary, marginTop: spacing.md, fontFamily: fonts.heading },
  brandSubtitle: { fontSize: 14, color: colors.textSecondary, marginTop: 4 },
  card: {
    backgroundColor: '#fff', borderRadius: radii.card, padding: spacing.lg, ...shadow.card,
    marginTop: spacing.lg,
  },
  welcome: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.background, borderRadius: radii.input, paddingHorizontal: spacing.md,
    marginBottom: spacing.md, height: 52,
  },
  input: { flex: 1, fontSize: 15, color: colors.text },
  forgotBtn: { alignSelf: 'flex-end', marginBottom: spacing.md },
  forgotText: { color: colors.secondary, fontSize: 13, fontWeight: '600' },
  error: { color: colors.danger, fontSize: 13, marginBottom: spacing.sm },
  submitRow: { flexDirection: 'row', gap: 12 },
  submit: { flex: 1, backgroundColor: colors.primary, borderRadius: radii.button, paddingVertical: 16, alignItems: 'center' },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  bioBtn: { width: 52, height: 52, borderRadius: radii.button, borderWidth: 2, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  bottomRow: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.lg },
  bottomText: { color: colors.textSecondary, fontSize: 14 },
  link: { color: colors.accent, fontSize: 14, fontWeight: '700' },
  dividerWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginVertical: spacing.lg },
  divider: { flex: 1, height: 1, backgroundColor: colors.borderLight },
  dividerText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  operatorBtn: { 
    borderWidth: 2, 
    borderColor: colors.primary, 
    borderRadius: radii.button, 
    paddingVertical: 14, 
    alignItems: 'center' 
  },
  operatorBtnText: { color: colors.primary, fontWeight: '700', fontSize: 15 },
});
