import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronDown } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Toast from 'react-native-toast-message';
import { useAuthStore } from '../../src/store/authStore';
import { formatErr } from '../../src/api/client';
import { colors, fonts, radii, shadow, spacing } from '../../src/constants/theme';

const CITIES = ['Douala', 'Yaoundé', 'Bafoussam', 'Garoua', 'Maroua', 'Bamenda', 'Bertoua', 'Autre'];

export default function RegisterScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const register = useAuthStore((s) => s.register);
  const loading = useAuthStore((s) => s.loading);
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', password: '', city: 'Douala' });
  const [showCity, setShowCity] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onChange = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const onSubmit = async () => {
    Keyboard.dismiss();
    setError(null);
    if (!form.full_name || !form.email || !form.password || !form.phone) {
      setError(t('errors.required'));
      return;
    }
    if (form.password.length < 6) {
      setError(t('errors.password_min'));
      return;
    }
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await register({ ...form, preferred_language: i18n.language });
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
          <TouchableOpacity onPress={() => router.back()} testID="register-back">
            <ChevronLeft size={26} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>{t('auth.sign_up')}</Text>
          <View style={{ width: 26 }} />
        </View>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.subtitle}>{t('auth.create_account_subtitle')}</Text>
          <View style={styles.card}>
            <TextInput style={styles.input} placeholder={t('auth.full_name')} placeholderTextColor={colors.textSecondary}
              value={form.full_name} onChangeText={(v) => onChange('full_name', v)} testID="register-name" />
            <View style={styles.phoneContainer}>
              <TouchableOpacity style={styles.countrySelector} activeOpacity={0.7}>
                <Text style={styles.countryText}>🇨🇲 +237</Text>
                <ChevronDown size={14} color={colors.textSecondary} />
              </TouchableOpacity>
              <TextInput 
                style={[styles.input, { flex: 1, marginBottom: 0 }]} 
                placeholder={t('auth.phone')} 
                placeholderTextColor={colors.textSecondary}
                keyboardType="phone-pad" 
                value={form.phone} 
                onChangeText={(v) => onChange('phone', v)} 
                testID="register-phone" 
              />
            </View>

            <TextInput style={styles.input} placeholder={t('auth.email')} placeholderTextColor={colors.textSecondary}
              autoCapitalize="none" keyboardType="email-address" value={form.email} onChangeText={(v) => onChange('email', v)} testID="register-email" />
            <TextInput style={styles.input} placeholder={t('auth.password')} placeholderTextColor={colors.textSecondary}
              secureTextEntry value={form.password} onChangeText={(v) => onChange('password', v)} testID="register-password" />

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

            <TouchableOpacity style={styles.submit} onPress={onSubmit} disabled={loading} testID="register-submit-button">
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
  submit: { backgroundColor: colors.primary, borderRadius: radii.button, paddingVertical: 16, alignItems: 'center', marginTop: spacing.sm },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  bottomRow: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.lg },
  bottomText: { color: colors.textSecondary, fontSize: 14 },
  link: { color: colors.accent, fontSize: 14, fontWeight: '700' },
});
