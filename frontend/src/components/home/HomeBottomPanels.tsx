import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { groupagesApi } from '../../api/colis';
import { colors, fonts, shadow, spacing } from '../../constants/theme';
import type { Groupage } from '../../types';

type SettingsSlice = {
  sea_delay_days?: number;
  air_delay_days?: number;
  air_express_delay_days?: number;
};

function daysUntil(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  if (Number.isNaN(target.getTime())) return null;
  const diff = Math.ceil((target.getTime() - Date.now()) / 86400000);
  return Math.max(0, diff);
}

export default function HomeBottomPanels({ settings }: { settings: SettingsSlice | null }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [next, setNext] = useState<{
    sea?: (Groupage & { days_remaining?: number; active?: boolean }) | null;
    air?: (Groupage & { days_remaining?: number; active?: boolean }) | null;
    air_express?: (Groupage & { days_remaining?: number; active?: boolean }) | null;
  }>({});

  useEffect(() => {
    groupagesApi.next().then(setNext).catch(() => {});
  }, []);

  const getDepartureInfo = (
    groupage?: (Groupage & { days_remaining?: number; active?: boolean }) | null,
    fallbackDest: string = 'Douala'
  ) => {
    if (!groupage) {
      return {
        isActive: false,
        daysBadge: null,
        destination: fallbackDest,
      };
    }
    const days =
      groupage.days_remaining !== undefined
        ? groupage.days_remaining
        : daysUntil(groupage.departure_date);

    const daysBadge = days !== null ? `${days}j` : '0j';
    const destination = groupage.destination_city || fallbackDest;
    return {
      isActive: true,
      daysBadge,
      destination,
    };
  };

  const seaInfo = getDepartureInfo(next.sea, 'Douala');
  const airInfo = getDepartureInfo(next.air, 'Douala');
  const expressInfo = getDepartureInfo(next.air_express, 'Douala');

  const gap = 12;
  const itemWidth = (width - spacing.lg * 2 - gap * 2) / 3;

  const departures = [
    {
      key: 'sea',
      title: t('home.next_sea', { defaultValue: 'Maritime' }),
      isActive: seaInfo.isActive,
      badgeText: seaInfo.daysBadge,
      sub: seaInfo.destination,
      icon3d: require('../../../assets/images/3d/cargoship.jpg'),
    },
    {
      key: 'air',
      title: t('home.next_air', { defaultValue: 'Aérien' }),
      isActive: airInfo.isActive,
      badgeText: airInfo.daysBadge,
      sub: airInfo.destination,
      icon3d: require('../../../assets/images/3d/airplane.jpg'),
    },
    {
      key: 'air_express',
      title: 'Aérien Express',
      isActive: expressInfo.isActive,
      badgeText: expressInfo.daysBadge,
      sub: expressInfo.destination,
      icon3d: require('../../../assets/images/3d/airexpress.jpg'),
    },
  ];

  return (
    <View style={styles.wrap}>
      <Text style={styles.sectionTitle}>{t('home.next_departures')}</Text>
      <View style={styles.grid}>
        {departures.map((d) => (
          <TouchableOpacity
            key={d.key}
            style={[styles.itemContainer, { width: itemWidth }]}
            activeOpacity={0.85}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/(tabs)/expeditions');
            }}
          >
            {/* Card avec icône 3D prenant 100% de la surface */}
            <View style={styles.iconCard}>
              <View style={styles.imageClip}>
                <Image source={d.icon3d} style={styles.icon3dImage} resizeMode="cover" />
              </View>

              {/* Cercle rouge vif en haut à droite comme une notification si groupage actif */}
              {d.isActive && d.badgeText && (
                <View style={styles.notifBadge}>
                  <Text style={styles.notifBadgeText}>{d.badgeText}</Text>
                </View>
              )}
            </View>

            {/* Titre et sous-titre en dehors de la card en bas */}
            <Text style={styles.itemTitle} numberOfLines={1}>
              {d.title}
            </Text>
            <Text style={styles.itemSub} numberOfLines={1}>
              {d.sub}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.text,
    fontFamily: fonts.heading,
    marginBottom: spacing.md,
    letterSpacing: -0.3,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  itemContainer: {
    alignItems: 'center',
    marginBottom: 4,
  },
  iconCard: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.95)',
    position: 'relative',
    ...shadow.card,
  },
  imageClip: {
    width: '100%',
    height: '100%',
    borderRadius: 23,
    overflow: 'hidden',
  },
  icon3dImage: {
    width: '100%',
    height: '100%',
  },
  notifBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#EF4444', // Rouge vif éclatant notification
    paddingHorizontal: 6,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.5,
    shadowRadius: 5,
    elevation: 6,
    zIndex: 20,
  },
  notifBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 14,
    includeFontPadding: false,
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
  itemSub: {
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 1,
    fontWeight: '500',
  },
});
