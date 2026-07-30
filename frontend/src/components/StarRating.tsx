import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Star } from 'lucide-react-native';
import { colors } from '../constants/theme';

type Props = {
  rating: number;
  size?: number;
  count?: number;
  editable?: boolean;
  onChange?: (value: number) => void;
  showValue?: boolean;
};

export default function StarRating({
  rating,
  size = 14,
  count,
  editable = false,
  onChange,
  showValue = true,
}: Props) {
  const value = Math.max(0, Math.min(5, Number(rating) || 0));
  return (
    <View style={styles.row}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = value >= n - 0.25;
        const half = !filled && value >= n - 0.75;
        return (
          <TouchableOpacity
            key={n}
            disabled={!editable}
            onPress={() => onChange?.(n)}
            hitSlop={6}
            activeOpacity={editable ? 0.7 : 1}
          >
            <Star
              size={size}
              color={filled || half ? '#F59E0B' : '#D1D5DB'}
              fill={filled ? '#F59E0B' : 'transparent'}
              strokeWidth={2}
            />
          </TouchableOpacity>
        );
      })}
      {showValue && (
        <Text style={styles.label}>
          {value > 0 ? value.toFixed(1) : '—'}
          {count != null ? ` (${count})` : ''}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  label: { marginLeft: 6, fontSize: 11, fontWeight: '700', color: colors.textSecondary },
});
