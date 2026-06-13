import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Mail } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Toast from 'react-native-toast-message';
import { authApi } from '../../src/api/auth';
import { formatErr } from '../../src/api/client';
import { colors, fonts, radii, shadow, spacing } from '../../src/constants/theme';

export default function ForgotPassword() {
  const { t } = useTranslation();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    Keyboard.dismiss();
    setError(null);
    if (!email) { setError(t('errors.required')); return; }
    setLoading(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const res = await authApi.forgotPassword(email.trim());
      if (res.dev_code) {
        Toast.show({ type: 'success', text1: `Code: ${res.dev_code}`, visibilityTime: 4000 });
      }
      router.push({ pathname: '/(auth)/verify-otp', params: { email: email.trim() } });
    } catch (e: any) {
      setError(formatErr(e, t('errors.server')));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']} testID="forgot-screen">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} testID="forgot-back">
            <ChevronLeft size={26} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>{t('auth.forgot_password')}</Text>
          <View style={{ width: 26 }} />
        </View>
        <View style={styles.content}>
          <View style={styles.iconWrap}>
            <Mail size={48} color={colors.primary} strokeWidth={1.5} />
          </View>
          <Text style={styles.subtitle}>{t('auth.otp_subtitle', { email: email || '...' })}</Text>
          <View style={styles.card}>
            <TextInput style={styles.input} placeholder={t('auth.email')} placeholderTextColor={colors.textSecondary}
              autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} testID="forgot-email" />
            {error && <Text style={styles.error}>{error}</Text>}
            <TouchableOpacity style={styles.submit} onPress={onSubmit} disabled={loading} testID="forgot-submit">
              <Text style={styles.submitText}>{loading ? t('common.loading') : t('auth.send_code')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  content: { padding: spacing.lg, alignItems: 'center' },
  iconWrap: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', ...shadow.card, marginBottom: spacing.lg },
  subtitle: { color: colors.textSecondary, fontSize: 14, textAlign: 'center', marginBottom: spacing.lg, paddingHorizontal: spacing.md },
  card: { width: '100%', backgroundColor: '#fff', borderRadius: radii.card, padding: spacing.lg, ...shadow.card },
  input: { backgroundColor: colors.background, borderRadius: radii.input, paddingHorizontal: spacing.md, height: 50, marginBottom: spacing.md, fontSize: 15, color: colors.text },
  error: { color: colors.danger, fontSize: 13, marginBottom: spacing.sm },
  submit: { backgroundColor: colors.primary, borderRadius: radii.button, paddingVertical: 16, alignItems: 'center' },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
