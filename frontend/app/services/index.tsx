import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, ShieldCheck } from 'lucide-react-native';
import { SERVICES } from '../../src/constants/services';
import { colors, fonts, spacing } from '../../src/constants/theme';

export default function ServicesHubScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerBrand}>M.O.G Services</Text>
          <Text style={styles.headerTitle}>{t('services.menu', { defaultValue: 'Nos services' })}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.introCard}>
          <ShieldCheck size={18} color={colors.primary} />
          <Text style={styles.intro}>
            {t('services.intro', {
              defaultValue: 'Choisissez un service et complétez le formulaire sécurisé. Un opérateur M.O.G vous rappellera avec un dossier déjà préparé.',
            })}
          </Text>
        </View>

        <View style={styles.grid}>
          {SERVICES.map((s) => (
            <TouchableOpacity
              key={s.slug}
              style={styles.card}
              activeOpacity={0.88}
              onPress={() => router.push(s.href as any)}
            >
              <View style={[styles.accent, { backgroundColor: s.color }]} />
              <View style={[styles.icon, { backgroundColor: `${s.color}14` }]}>
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
  container: { flex: 1, backgroundColor: '#F3F5F8' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E8ECF1',
  },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerBrand: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    fontFamily: fonts.heading,
  },
  scroll: { padding: spacing.lg, paddingBottom: 40 },
  introCard: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#EEF4FF',
    borderRadius: 14,
    padding: 14,
    marginBottom: spacing.lg,
    alignItems: 'flex-start',
  },
  intro: { flex: 1, color: '#1E3A5F', fontSize: 13, lineHeight: 19, fontWeight: '500' },
  grid: { gap: 10 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 14,
    paddingRight: 14,
    paddingLeft: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: '#E8ECF1',
    overflow: 'hidden',
  },
  accent: {
    position: 'absolute',
    left: 0,
    top: 12,
    bottom: 12,
    width: 3,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
  },
  icon: { width: 46, height: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginLeft: 4 },
  rowTitle: { fontSize: 14, fontWeight: '800', color: colors.text },
  rowSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
});
