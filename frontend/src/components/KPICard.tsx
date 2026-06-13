import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withDelay } from 'react-native-reanimated';
import { colors, radii, shadow, fonts, spacing } from '../constants/theme';

interface Props {
  label: string;
  count: number;
  icon: React.ReactNode;
  color: string;
  testID?: string;
  index?: number;
}

export default function KPICard({ label, count, icon, color, testID, index = 0 }: Props) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);

  useEffect(() => {
    opacity.value = withDelay(index * 100, withSpring(1));
    translateY.value = withDelay(index * 100, withSpring(0));
  }, [index]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[styles.card, animatedStyle, { borderLeftColor: color }]} testID={testID}>
      <View style={[styles.iconWrap, { backgroundColor: `${color}15` }]}>{icon}</View>
      <View>
        <Text style={styles.count}>{count}</Text>
        <Text style={styles.label} numberOfLines={1}>{label}</Text>
      </View>
      <View style={[styles.glow, { backgroundColor: color, opacity: 0.05 }]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    padding: spacing.md,
    width: 130,
    minHeight: 120,
    borderLeftWidth: 5,
    ...shadow.card,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  count: {
    fontSize: 26,
    fontWeight: '900',
    color: colors.text,
    fontFamily: fonts.heading,
  },
  label: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 2,
  },
  glow: {
    position: 'absolute',
    bottom: -20,
    right: -20,
    width: 80,
    height: 80,
    borderRadius: 40,
  },
});
