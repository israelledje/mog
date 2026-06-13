import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { BASE } from '../api/client';
import { Plane, Ship, Package } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import StatusBadge from './StatusBadge';
import { colors, radii, shadow, fonts, spacing } from '../constants/theme';
import type { Colis } from '../types';

export default function ColisCard({ item }: { item: Colis }) {
  const router = useRouter();
  const Icon = item.transport_mode === 'air' ? Plane : Ship;

  const onPress = () => {
    Haptics.selectionAsync();
    router.push(`/colis/${item.id}` as any);
  };

  const date = new Date(item.created_at);
  const dateStr = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85} testID={`colis-card-${item.id}`}>
      <View style={styles.thumb}>
        {item.photos && item.photos.length > 0 ? (
          <Image 
            source={{ uri: item.photos[0].startsWith('http') ? item.photos[0] : `${BASE}${item.photos[0]}` }} 
            style={{ width: '100%', height: '100%', borderRadius: radii.input }} 
            resizeMode="cover" 
          />
        ) : (
          <Package size={26} color={colors.primary} strokeWidth={1.6} />
        )}
      </View>
      <View style={styles.body}>
        <View style={styles.row}>
          <Text style={styles.tracking} numberOfLines={1}>
            {item.tracking_number}
          </Text>
          <Icon size={16} color={colors.textSecondary} />
        </View>
        <Text style={styles.desc} numberOfLines={1}>
          {item.description}
        </Text>
        <View style={styles.bottomRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <StatusBadge status={item.status} small />
            {item.total_price && item.total_price > 0 ? (
              <View style={styles.pricePill}>
                <Text style={styles.priceText}>{item.total_price.toLocaleString()} FCFA</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.date}>{dateStr}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    padding: spacing.md,
    marginBottom: spacing.md,
    flexDirection: 'row',
    gap: spacing.md,
    ...shadow.card,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: radii.input,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    justifyContent: 'space-between',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tracking: {
    fontFamily: fonts.mono,
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
    flex: 1,
  },
  desc: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  date: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  pricePill: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  priceText: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '700',
  },
});
