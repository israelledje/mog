import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Grid3X3 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { SERVICES } from '../../constants/services';
import { colors, fonts, spacing, shadow } from '../../constants/theme';

export default function HomeServicesMenu() {
  const { t } = useTranslation();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const gap = 12;
  const itemWidth = (width - spacing.lg * 2 - gap * 2) / 3;

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <View style={styles.titleWithBadge}>
          <Text style={styles.title}>
            {t('services.assistants_title', { defaultValue: 'Assistants & Services' })}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push('/services');
          }}
          style={styles.seeAll}
          activeOpacity={0.85}
        >
          <Grid3X3 size={13} color={colors.primary} />
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
            style={[styles.itemContainer, { width: itemWidth }]}
            activeOpacity={0.85}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push(s.href as any);
            }}
          >
            {/* Card contenant uniquement l'icône 3D à 100% */}
            <View style={styles.iconCard}>
              {s.icon3d ? (
                <Image
                  source={s.icon3d}
                  style={styles.icon3dImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.fallbackIconWrap, { backgroundColor: `${s.color}15` }]}>
                  <s.Icon size={36} color={s.color} strokeWidth={2.2} />
                </View>
              )}
            </View>

            {/* Titre en dehors de la card, directement en bas */}
            <Text style={styles.itemTitle} numberOfLines={2}>
              {t(`services.${s.slug}_short`, { defaultValue: s.shortTitle })}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: spacing.xl,
    paddingTop: spacing.xs,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
    gap: 12,
  },
  titleWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.text,
    fontFamily: fonts.heading,
    letterSpacing: -0.3,
  },
  sub: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    lineHeight: 18,
    fontWeight: '500',
  },
  seeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.15)',
  },
  seeAllText: { color: colors.primary, fontWeight: '800', fontSize: 12 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  itemContainer: {
    alignItems: 'center',
    marginBottom: 10,
  },
  iconCard: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.95)',
    ...shadow.card,
  },
  icon3dImage: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
  },
  fallbackIconWrap: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTitle: {
    marginTop: 8,
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
    lineHeight: 16,
    fontFamily: fonts.heading,
    paddingHorizontal: 2,
  },
});
