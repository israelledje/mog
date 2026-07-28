import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ViewStyle,
} from 'react-native';
import { colors, spacing, shadow } from '../../constants/theme';

export type ChipItem = {
  key: string;
  label: string;
  icon?: React.ReactNode;
  activeColor?: string;
};

type Props = {
  items: ChipItem[];
  activeKey?: string | null;
  activeKeys?: string[];
  onSelect: (key: string) => void;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
  size?: 'sm' | 'md';
};

/** Chips filtres horizontaux — style app M.O.G */
export function FilterChips({ items, activeKey, activeKeys, onSelect, style, contentStyle, size = 'md' }: Props) {
  const padV = size === 'sm' ? 8 : 10;
  const padH = size === 'sm' ? 12 : 14;
  const actives = new Set(activeKeys?.length ? activeKeys : activeKey ? [activeKey] : []);
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={style}
      contentContainerStyle={[styles.row, contentStyle]}
    >
      {items.map((item) => {
        const active = actives.has(item.key);
        const bg = active ? (item.activeColor || colors.primary) : '#fff';
        return (
          <TouchableOpacity
            key={item.key}
            onPress={() => onSelect(item.key)}
            activeOpacity={0.85}
            style={[
              styles.chip,
              { paddingVertical: padV, paddingHorizontal: padH, backgroundColor: bg, borderColor: active ? bg : colors.border },
              active && shadow.sm,
            ]}
          >
            {item.icon ? <View style={styles.icon}>{item.icon}</View> : null}
            <Text style={[styles.label, active && styles.labelActive]}>{item.label}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

export type CategoryChip = {
  key: string;
  label: string;
  icon: string;
  desc?: string;
  color: string;
};

type CatProps = {
  items: CategoryChip[];
  activeKey: string;
  onSelect: (key: string) => void;
};

/** Tuiles catégorie (simulateur) — scroll horizontal, lisibles */
export function CategoryChips({ items, activeKey, onSelect }: CatProps) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catRow} nestedScrollEnabled>
      {items.map((cat) => {
        const active = activeKey === cat.key;
        return (
          <TouchableOpacity
            key={cat.key}
            onPress={() => onSelect(cat.key)}
            activeOpacity={0.88}
            style={[
              styles.catChip,
              active && { backgroundColor: cat.color, borderColor: cat.color },
            ]}
          >
            <Text style={styles.catIcon}>{cat.icon}</Text>
            <Text style={[styles.catLabel, active && styles.catLabelActive]} numberOfLines={1}>
              {cat.label}
            </Text>
            {cat.desc ? (
              <Text style={[styles.catDesc, active && styles.catDescActive]} numberOfLines={2}>
                {cat.desc}
              </Text>
            ) : null}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    gap: 6,
  },
  icon: { marginRight: 0 },
  label: { fontSize: 13, fontWeight: '600', color: colors.text },
  labelActive: { color: '#fff' },

  catRow: { gap: 10, paddingRight: 4 },
  catChip: {
    width: 112,
    minHeight: 88,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    borderWidth: 1.5,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  catIcon: { fontSize: 22 },
  catLabel: { fontSize: 12, fontWeight: '800', color: colors.text, textAlign: 'center' },
  catLabelActive: { color: '#fff' },
  catDesc: { fontSize: 9, fontWeight: '600', color: colors.textSecondary, textAlign: 'center', lineHeight: 12 },
  catDescActive: { color: 'rgba(255,255,255,0.85)' },
});
