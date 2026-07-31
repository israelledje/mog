import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ChevronRight, Grid3X3 } from 'lucide-react-native';
import { SERVICES } from '../../constants/services';
import { colors, fonts, spacing } from '../../constants/theme';

export default function HomeServicesMenu() {
  const { t } = useTranslation();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const gap = 10;
  const cardWidth = (width - spacing.lg * 2 - gap) / 2;

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>
          {t('services.assistants_title', { defaultValue: 'Assistants & Services' })}
        </Text>
        <TouchableOpacity onPress={() => router.push('/services')} style={styles.seeAll} activeOpacity={0.85}>
          <Grid3X3 size={14} color={colors.primary} />
          <Text style={styles.seeAllText}>{t('services.all', { defaultValue: 'Tous' })}</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.sub}>
        {t('services.home_hint', { defaultValue: 'Demandez en ligne — un opérateur vous rappelle' })}
      </Text>

      <View style={styles.grid}>
        {SERVICES.map((s) => (
          <TouchableOpacity
            key={s.slug}
            style={[styles.card, { width: cardWidth, backgroundColor: `${s.color}12` }]}
            activeOpacity={0.85}
            onPress={() => router.push(s.href as any)}
          >
            <View style={styles.cardTop}>
              <View style={[styles.iconWrap, { backgroundColor: '#fff' }]}>
                <s.Icon size={20} color={s.color} strokeWidth={2.1} />
              </View>
              <ChevronRight size={16} color={s.color} strokeWidth={2.2} />
            </View>

            <Text style={styles.cardTitle} numberOfLines={1}>
              {t(`services.${s.slug}_short`, { defaultValue: s.shortTitle })}
            </Text>
            <Text style={styles.cardSub} numberOfLines={2}>
              {t(`services.${s.slug}_sub`, { defaultValue: s.subtitle })}
            </Text>

            <View style={[styles.accentBar, { backgroundColor: s.color }]} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: spacing.xl,
    paddingTop: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    gap: 12,
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    fontFamily: fonts.heading,
  },
  sub: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  card: {
    borderRadius: 16,
    paddingTop: 14,
    paddingLeft: 16,
    paddingRight: 12,
    paddingBottom: 14,
    minHeight: 118,
    overflow: 'hidden',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 3,
  },
  cardSub: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  accentBar: {
    position: 'absolute',
    left: 0,
    top: 14,
    bottom: 14,
    width: 3,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
  },
});
