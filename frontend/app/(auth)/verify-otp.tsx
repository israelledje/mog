import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ChevronLeft } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Toast from 'react-native-toast-message';
import { authApi } from '../../src/api/auth';
import { colors, fonts, radii, shadow, spacing } from '../../src/constants/theme';

export default function VerifyOtp() {
  const { t } = useTranslation();
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [seconds, setSeconds] = useState(60);
  const [error, setError] = useState<string | null>(null);
  const refs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, []);

  const onChange = (i: number, v: string) => {
    const cleaned = v.replace(/\D/g, '').slice(0, 1);
    const next = [...digits];
    next[i] = cleaned;
    setDigits(next);
    if (cleaned && i < 5) refs.current[i + 1]?.focus();
  };

  const code = digits.join('');

  const onSubmit = async () => {
    Keyboard.dismiss();
    setError(null);
    if (code.length !== 6) { setError(t('errors.required')); return; }
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await authApi.verifyOtp(email as string, code);
      router.push({ pathname: '/(auth)/reset-password', params: { email: email as string, code } });
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(t('errors.invalid_otp'));
      Toast.show({ type: 'error', text1: t('errors.invalid_otp') });
    }
  };

  const onResend = async () => {
    if (seconds > 0) return;
    try {
      const res = await authApi.forgotPassword(email as string);
      if (res.dev_code) Toast.show({ type: 'success', text1: `Code: ${res.dev_code}` });
      setSeconds(60);
    } catch {}
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']} testID="otp-screen">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <ChevronLeft size={26} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>{t('auth.otp_title')}</Text>
          <View style={{ width: 26 }} />
        </View>
        <View style={styles.content}>
          <Text style={styles.subtitle}>{t('auth.otp_subtitle', { email })}</Text>
          <View style={styles.row}>
            {digits.map((d, i) => (
              <TextInput
                key={i}
                ref={(r) => { refs.current[i] = r; }}
                style={styles.digit}
                value={d}
                keyboardType="number-pad"
                maxLength={1}
                onChangeText={(v) => onChange(i, v)}
                onKeyPress={(e) => {
                  if (e.nativeEvent.key === 'Backspace' && !d && i > 0) refs.current[i - 1]?.focus();
                }}
                testID={`otp-digit-${i}`}
              />
            ))}
          </View>
          {error && <Text style={styles.error}>{error}</Text>}
          <TouchableOpacity style={styles.submit} onPress={onSubmit} testID="otp-verify">
            <Text style={styles.submitText}>{t('auth.verify_code')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onResend} disabled={seconds > 0} style={styles.resendBtn} testID="otp-resend">
            <Text style={[styles.resend, seconds > 0 && styles.resendDisabled]}>
              {seconds > 0 ? t('auth.resend_in', { seconds }) : t('auth.resend')}
            </Text>
          </TouchableOpacity>
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
  subtitle: { color: colors.textSecondary, fontSize: 14, textAlign: 'center', marginBottom: spacing.xl },
  row: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: spacing.lg },
  digit: {
    width: 48, height: 56, borderRadius: radii.input, backgroundColor: '#fff', textAlign: 'center',
    fontSize: 24, fontWeight: '700', color: colors.primary, fontFamily: fonts.mono, ...shadow.card,
  },
  error: { color: colors.danger, fontSize: 13, marginBottom: spacing.sm },
  submit: { backgroundColor: colors.primary, borderRadius: radii.button, paddingVertical: 16, alignItems: 'center', alignSelf: 'stretch' },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  resendBtn: { marginTop: spacing.lg },
  resend: { color: colors.secondary, fontSize: 14, fontWeight: '600' },
  resendDisabled: { color: colors.textSecondary },
});
