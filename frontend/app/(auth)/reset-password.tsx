import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { ChevronLeft, Lock } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Toast from 'react-native-toast-message';
import { authApi } from '../../src/api/auth';
import { formatErr } from '../../src/api/client';
import { colors, radii, shadow, spacing } from '../../src/constants/theme';

const paramSchema = z.object({
  email: z.string().email(),
  code: z.string().min(1),
});

export default function ResetPassword() {
  const { t } = useTranslation();
  const router = useRouter();
  const rawParams = useLocalSearchParams();
  const parsed = paramSchema.safeParse(rawParams);
  
  if (!parsed.success) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={styles.error}>Lien invalide ou expiré.</Text>
      </SafeAreaView>
    );
  }
  
  const { email, code } = parsed.data;
  const [pwd, setPwd] = useState('');
  const [pwd2, setPwd2] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    Keyboard.dismiss();
    setError(null);
    if (pwd.length < 6) { setError(t('errors.password_min')); return; }
    if (pwd !== pwd2) { setError(t('errors.required')); return; }
    setLoading(true);
    try {
      await authApi.resetPassword(email as string, code as string, pwd);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Toast.show({ type: 'success', text1: t('auth.reset_success') });
      router.replace('/(auth)/login');
    } catch (e: any) {
      setError(formatErr(e, t('errors.server')));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']} testID="reset-screen">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}><ChevronLeft size={26} color={colors.text} /></TouchableOpacity>
          <Text style={styles.title}>{t('auth.reset_title')}</Text>
          <View style={{ width: 26 }} />
        </View>
        <View style={styles.content}>
          <View style={styles.iconWrap}><Lock size={48} color={colors.primary} strokeWidth={1.5} /></View>
          <View style={styles.card}>
            <TextInput style={styles.input} placeholder={t('auth.new_password')} placeholderTextColor={colors.textSecondary}
              secureTextEntry value={pwd} onChangeText={setPwd} testID="reset-pwd" />
            <TextInput style={styles.input} placeholder={t('auth.confirm_password')} placeholderTextColor={colors.textSecondary}
              secureTextEntry value={pwd2} onChangeText={setPwd2} testID="reset-pwd2" />
            {error && <Text style={styles.error}>{error}</Text>}
            <TouchableOpacity style={styles.submit} onPress={onSubmit} disabled={loading} testID="reset-submit">
              <Text style={styles.submitText}>{loading ? t('common.loading') : t('common.confirm')}</Text>
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
  card: { width: '100%', backgroundColor: '#fff', borderRadius: radii.card, padding: spacing.lg, ...shadow.card },
  input: { backgroundColor: colors.background, borderRadius: radii.input, paddingHorizontal: spacing.md, height: 50, marginBottom: spacing.md, fontSize: 15, color: colors.text },
  error: { color: colors.danger, fontSize: 13, marginBottom: spacing.sm },
  submit: { backgroundColor: colors.primary, borderRadius: radii.button, paddingVertical: 16, alignItems: 'center' },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
