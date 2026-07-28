import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Grid3X3 } from 'lucide-react-native';
import { SERVICES } from '../../constants/services';
import { colors, spacing, shadow } from '../../constants/theme';

export default function HomeServicesMenu() {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>{t('services.assistants_title', { defaultValue: 'Assistants & Services' })}</Text>
          <Text style={styles.sub}>Demandez en ligne — un opérateur vous rappelle</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/services')} style={styles.seeAll} activeOpacity={0.85}>
          <Grid3X3 size={15} color={colors.primary} />
          <Text style={styles.seeAllText}>{t('services.all', { defaultValue: 'Tous' })}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroller}
        decelerationRate="fast"
        snapToInterval={132}
      >
        {SERVICES.map((s) => (
          <TouchableOpacity
            key={s.slug}
            style={styles.tile}
            activeOpacity={0.88}
            onPress={() => router.push(s.href as any)}
          >
            <View style={[styles.iconWrap, { backgroundColor: `${s.color}18` }]}>
              <s.Icon size={22} color={s.color} strokeWidth={2.2} />
            </View>
            <Text style={styles.tileTitle} numberOfLines={1}>{s.shortTitle}</Text>
            <Text style={styles.tileSub} numberOfLines={2}>{s.subtitle}</Text>
            <View style={[styles.dot, { backgroundColor: s.color }]} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingBottom: spacing.lg },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
    gap: 12,
  },
  title: { fontSize: 18, fontWeight: '800', color: colors.text },
  sub: { fontSize: 12, color: colors.textSecondary, marginTop: 2, maxWidth: 220 },
  seeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
  },
  seeAllText: { color: colors.primary, fontWeight: '700', fontSize: 12 },
  scroller: { paddingHorizontal: spacing.lg, gap: 10 },
  tile: {
    width: 122,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadow.sm,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  tileTitle: { fontSize: 13, fontWeight: '800', color: colors.text },
  tileSub: { fontSize: 11, color: colors.textSecondary, marginTop: 3, lineHeight: 14, minHeight: 28 },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 10 },
});
