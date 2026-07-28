import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { SERVICES } from '../../src/constants/services';
import { colors, spacing, shadow } from '../../src/constants/theme';

export default function ServicesHubScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('services.menu', { defaultValue: 'Services' })}</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.intro}>
          {t('services.intro', {
            defaultValue: 'Choisissez un service et remplissez le formulaire. Un opérateur M.O.G vous rappellera avec les informations déjà collectées.',
          })}
        </Text>

        <View style={styles.grid}>
          {SERVICES.map((s) => (
            <TouchableOpacity
              key={s.slug}
              style={styles.card}
              activeOpacity={0.88}
              onPress={() => router.push(s.href as any)}
            >
              <View style={[styles.icon, { backgroundColor: `${s.color}18` }]}>
                <s.Icon size={22} color={s.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{s.title}</Text>
                <Text style={styles.rowSub}>{s.subtitle}</Text>
              </View>
              <ChevronRight size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '800', color: colors.text },
  scroll: { padding: spacing.lg },
  intro: { color: colors.textSecondary, fontSize: 14, lineHeight: 20, marginBottom: spacing.lg },
  grid: { gap: 10 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadow.sm,
  },
  icon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 14, fontWeight: '800', color: colors.text },
  rowSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
});
