import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { colors, radii, shadow, spacing } from '../constants/theme';

export default function SkeletonCard() {
  const opacity = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  }, [opacity]);
  return (
    <View style={styles.card}>
      <Animated.View style={[styles.thumb, { opacity }]} />
      <View style={styles.body}>
        <Animated.View style={[styles.line, { width: '70%', opacity }]} />
        <Animated.View style={[styles.line, { width: '90%', opacity }]} />
        <Animated.View style={[styles.line, { width: '40%', opacity }]} />
      </View>
    </View>
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
    backgroundColor: '#E5E7EB',
  },
  body: {
    flex: 1,
    justifyContent: 'space-around',
  },
  line: {
    height: 12,
    borderRadius: 6,
    backgroundColor: '#E5E7EB',
  },
});
