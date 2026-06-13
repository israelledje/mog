import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronDown, Save, MapPin, User as UserIcon, Phone, Building2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Toast from 'react-native-toast-message';
import { useAuthStore } from '../../src/store/authStore';
import { formatErr } from '../../src/api/client';
import { colors, fonts, radii, shadow, spacing } from '../../src/constants/theme';

const CITIES = ['Douala', 'Yaoundé', 'Bafoussam', 'Garoua', 'Maroua', 'Bamenda', 'Bertoua', 'Autre'];

export default function EditProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const updateProfile = useAuthStore((s) => s.updateProfile);

  const [form, setForm] = useState({
    full_name: user?.full_name || '',
    phone: user?.phone || '',
    city: user?.city || 'Douala',
    default_delivery_address: user?.default_delivery_address || '',
  });
  const [showCity, setShowCity] = useState(false);
  const [saving, setSaving] = useState(false);

  const update = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const onSave = async () => {
    setSaving(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await updateProfile(form);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Toast.show({ type: 'success', text1: t('profile.saved') });
      router.back();
    } catch (e: any) {
      Toast.show({ type: 'error', text1: formatErr(e, t('errors.server')) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']} testID="edit-profile-screen">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} testID="edit-back">
            <ChevronLeft size={26} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>{t('profile.edit')}</Text>
          <View style={{ width: 26 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Field icon={<UserIcon size={18} color={colors.textSecondary} />} label={t('auth.full_name')}>
              <TextInput
                style={styles.input}
                value={form.full_name}
                onChangeText={(v) => update('full_name', v)}
                placeholder={t('auth.full_name')}
                placeholderTextColor={colors.textSecondary}
                testID="edit-name"
              />
            </Field>

            <Field icon={<Phone size={18} color={colors.textSecondary} />} label={t('auth.phone')}>
              <TextInput
                style={styles.input}
                value={form.phone}
                onChangeText={(v) => update('phone', v)}
                keyboardType="phone-pad"
                placeholder={t('auth.phone')}
                placeholderTextColor={colors.textSecondary}
                testID="edit-phone"
              />
            </Field>

            <Field icon={<Building2 size={18} color={colors.textSecondary} />} label={t('auth.city')}>
              <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowCity((s) => !s)} testID="edit-city">
                <Text style={styles.pickerText}>{form.city}</Text>
                <ChevronDown size={18} color={colors.textSecondary} />
              </TouchableOpacity>
              {showCity && (
                <View style={styles.dropdown}>
                  {CITIES.map((c) => (
                    <TouchableOpacity
                      key={c}
                      style={styles.dropItem}
                      onPress={() => { update('city', c); setShowCity(false); Haptics.selectionAsync(); }}
                    >
                      <Text style={styles.dropItemText}>{c}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </Field>

            <Field icon={<MapPin size={18} color={colors.textSecondary} />} label={t('profile.default_address')}>
              <TextInput
                style={[styles.input, { height: 90, textAlignVertical: 'top' }]}
                value={form.default_delivery_address}
                onChangeText={(v) => update('default_delivery_address', v)}
                multiline
                placeholder={t('profile.default_address')}
                placeholderTextColor={colors.textSecondary}
                testID="edit-address"
              />
            </Field>
          </View>

          <View style={styles.readOnly}>
            <Text style={styles.roLabel}>{t('profile.client_code')}</Text>
            <Text style={styles.roValue}>{user?.client_code}</Text>
          </View>
          <View style={styles.readOnly}>
            <Text style={styles.roLabel}>Email</Text>
            <Text style={styles.roValue}>{user?.email}</Text>
          </View>

          <TouchableOpacity style={styles.save} onPress={onSave} disabled={saving} testID="edit-save">
            <Save size={18} color="#fff" />
            <Text style={styles.saveText}>{saving ? t('common.loading') : t('profile.save')}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      <View style={styles.fieldHead}>
        {icon}
        <Text style={styles.fieldLabel}>{label}</Text>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  scroll: { padding: spacing.lg, paddingTop: 0, paddingBottom: 40 },
  card: { backgroundColor: '#fff', borderRadius: radii.card, padding: spacing.lg, ...shadow.card },
  fieldHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4 },
  input: { backgroundColor: colors.background, borderRadius: radii.input, paddingHorizontal: spacing.md, paddingVertical: 12, fontSize: 15, color: colors.text },
  pickerBtn: { backgroundColor: colors.background, borderRadius: radii.input, paddingHorizontal: spacing.md, height: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pickerText: { fontSize: 15, color: colors.text },
  dropdown: { backgroundColor: '#fff', borderRadius: radii.input, marginTop: 4, borderWidth: 1, borderColor: colors.border },
  dropItem: { padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  dropItemText: { fontSize: 14, color: colors.text },
  readOnly: { backgroundColor: '#fff', borderRadius: radii.card, padding: spacing.md, marginTop: spacing.md, ...shadow.card, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  roLabel: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase' },
  roValue: { fontSize: 14, color: colors.text, fontWeight: '600' },
  save: { backgroundColor: colors.primary, paddingVertical: 16, borderRadius: radii.button, marginTop: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  saveText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
