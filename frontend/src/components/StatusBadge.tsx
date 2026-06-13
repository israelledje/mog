import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { statusColors, fonts } from '../constants/theme';
import type { ColisStatus } from '../types';

export default function StatusBadge({ status, small = false }: { status: ColisStatus; small?: boolean }) {
  const { t } = useTranslation();
  const c = statusColors[status] || statusColors.pending_reception;
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }, small && styles.small]} testID={`status-badge-${status}`}>
      <Text style={[styles.text, { color: c.text }, small && styles.textSmall]} numberOfLines={1}>
        {t(`status.${status}`)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  small: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: fonts.body,
    letterSpacing: 0.3,
  },
  textSmall: {
    fontSize: 10,
  },
});
