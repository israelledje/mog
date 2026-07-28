import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { ChevronLeft, ChevronDown } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Toast from 'react-native-toast-message';
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
  });
  const [showCity, setShowCity] = useState(false);
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
    <SafeAreaView style={styles.container} edges={['top', 'bottom']} testID="register-screen">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} testID="register-back" accessibilityRole="button" accessibilityLabel={t('common.back')}>
            <ChevronLeft size={26} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>{t('auth.sign_up')}</Text>
          <View style={{ width: 26 }} />
        </View>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.subtitle}>{t('auth.create_account_subtitle')}</Text>
          <View style={styles.card}>
            <TextInput style={[styles.input, fieldErrors.full_name && styles.inputError]} placeholder={t('auth.full_name')} placeholderTextColor={colors.textSecondary}
              value={form.full_name} onChangeText={(v) => onChange('full_name', v)} testID="register-name" />
            {fieldErrors.full_name && <Text style={styles.fieldError} testID="register-name-error">{fieldErrors.full_name}</Text>}
            <PhoneInput
              dialCode={form.dialCode}
              nationalNumber={form.nationalNumber}
              onDialCodeChange={(v) => onChange('dialCode', v)}
              onNationalNumberChange={(v) => onChange('nationalNumber', v)}
              placeholder={t('auth.phone')}
              testID="register-phone"
            />
            {fieldErrors.nationalNumber && <Text style={styles.fieldError} testID="register-phone-error">{fieldErrors.nationalNumber}</Text>}

            <TextInput style={[styles.input, fieldErrors.email && styles.inputError]} placeholder={t('auth.email')} placeholderTextColor={colors.textSecondary}
              autoCapitalize="none" keyboardType="email-address" value={form.email} onChangeText={(v) => onChange('email', v)} testID="register-email" />
            {fieldErrors.email && <Text style={styles.fieldError} testID="register-email-error">{fieldErrors.email}</Text>}
            <TextInput style={[styles.input, fieldErrors.password && styles.inputError]} placeholder={t('auth.password')} placeholderTextColor={colors.textSecondary}
              secureTextEntry value={form.password} onChangeText={(v) => onChange('password', v)} testID="register-password" />
            {fieldErrors.password && <Text style={styles.fieldError} testID="register-password-error">{fieldErrors.password}</Text>}

            <TouchableOpacity style={styles.picker} onPress={() => setShowCity((s) => !s)} testID="register-city">
              <Text style={styles.pickerText}>{form.city || t('auth.select_city')}</Text>
              <ChevronDown size={18} color={colors.textSecondary} />
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

            {error && <Text style={styles.error}>{error}</Text>}

            <TouchableOpacity style={styles.submit} onPress={onSubmit} disabled={loading} testID="register-submit-button" accessibilityRole="button" accessibilityLabel={t('auth.sign_up')}>
              <Text style={styles.submitText}>{loading ? t('common.loading') : t('auth.sign_up')}</Text>
            </TouchableOpacity>

            <View style={styles.bottomRow}>
              <Text style={styles.bottomText}>{t('auth.already_account')} </Text>
              <Link href="/(auth)/login" asChild>
                <TouchableOpacity><Text style={styles.link}>{t('auth.sign_in')}</Text></TouchableOpacity>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  scroll: { padding: spacing.lg, paddingTop: 0 },
  subtitle: { color: colors.textSecondary, fontSize: 14, marginBottom: spacing.lg },
  card: { backgroundColor: '#fff', borderRadius: radii.card, padding: spacing.lg, ...shadow.card },
  input: {
    backgroundColor: colors.background, borderRadius: radii.input, paddingHorizontal: spacing.md,
    height: 50, marginBottom: spacing.md, fontSize: 15, color: colors.text,
  },
  phoneContainer: {
    flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md
  },
  countrySelector: {
    backgroundColor: colors.background, borderRadius: radii.input, paddingHorizontal: spacing.sm,
    height: 50, flexDirection: 'row', alignItems: 'center', gap: 4, width: 90, justifyContent: 'center'
  },
  countryText: { fontSize: 14, fontWeight: '600', color: colors.text },
  picker: {
    backgroundColor: colors.background, borderRadius: radii.input, paddingHorizontal: spacing.md,
    height: 50, marginBottom: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  pickerText: { fontSize: 15, color: colors.text },
  dropdown: { backgroundColor: '#fff', borderRadius: radii.input, marginTop: -8, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  dropItem: { padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  dropItemText: { fontSize: 14, color: colors.text },
  error: { color: colors.danger, fontSize: 13, marginBottom: spacing.sm },
  inputError: { borderWidth: 1, borderColor: colors.danger },
  fieldError: { color: colors.danger, fontSize: 12, marginTop: -spacing.sm, marginBottom: spacing.md, marginLeft: spacing.xs },
  submit: { backgroundColor: colors.primary, borderRadius: radii.button, paddingVertical: 16, alignItems: 'center', marginTop: spacing.sm },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  bottomRow: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.lg },
  bottomText: { color: colors.textSecondary, fontSize: 14 },
  link: { color: colors.accent, fontSize: 14, fontWeight: '700' },
});
