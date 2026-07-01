import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ship, Plane } from 'lucide-react-native';
import { groupagesApi } from '../../api/colis';
import { colors, fonts, radii, shadow, spacing } from '../../constants/theme';
import type { Groupage } from '../../types';

type SettingsSlice = {
  sea_delay_days?: number;
  air_delay_days?: number;
};

function daysUntil(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  if (Number.isNaN(target.getTime())) return null;
  const diff = Math.ceil((target.getTime() - Date.now()) / 86400000);
  return diff;
}

function formatDeparture(groupage: Groupage | null | undefined, fallbackDays: number, imminentLabel: string): string {
  const d = daysUntil(groupage?.departure_date);
  if (d === null) return `~${fallbackDays}j`;
  if (d <= 0) return imminentLabel;
  return `${d}j`;
}

export default function HomeBottomPanels({ settings }: { settings: SettingsSlice | null }) {
  const { t } = useTranslation();
  const [next, setNext] = useState<{ sea?: Groupage | null; air?: Groupage | null }>({});

  useEffect(() => {
    groupagesApi.next().then(setNext).catch(() => {});
  }, []);

  const seaLabel = formatDeparture(next.sea, settings?.sea_delay_days ?? 45, t('home.departure_imminent'));
  const airLabel = formatDeparture(next.air, settings?.air_delay_days ?? 7, t('home.departure_imminent'));

  return (
    <View style={styles.wrap}>
      <Text style={styles.sectionTitle}>{t('home.next_departures')}</Text>
      <View style={styles.row}>
        <View style={[styles.depCard, { backgroundColor: '#E8F1FC' }]}>
          <View style={styles.depIconWrap}>
            <Ship size={20} color={colors.secondary} strokeWidth={2.5} />
          </View>
          <Text style={styles.depLabel}>{t('home.next_sea')}</Text>
          <Text style={styles.depValue}>{seaLabel}</Text>
          {next.sea?.destination_city ? (
            <Text style={styles.depSub}>{next.sea.destination_city}</Text>
          ) : null}
        </View>
        <View style={[styles.depCard, { backgroundColor: '#FCECE8' }]}>
          <View style={styles.depIconWrap}>
            <Plane size={20} color={colors.accent} strokeWidth={2.5} />
          </View>
          <Text style={styles.depLabel}>{t('home.next_air')}</Text>
          <Text style={styles.depValue}>{airLabel}</Text>
          {next.air?.destination_city ? (
            <Text style={styles.depSub}>{next.air.destination_city}</Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: spacing.lg, marginBottom: spacing.lg },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: colors.text, fontFamily: fonts.heading, marginBottom: spacing.md },
  row: { flexDirection: 'row', gap: 12 },
  depCard: { flex: 1, borderRadius: 20, padding: 16, ...shadow.card },
  depIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  depLabel: { fontSize: 11, fontWeight: '700', color: colors.textSecondary, marginBottom: 4 },
  depValue: { fontSize: 22, fontWeight: '900', color: colors.text, fontFamily: fonts.heading },
  depSub: { fontSize: 11, fontWeight: '600', color: colors.textSecondary, marginTop: 4 },
});
