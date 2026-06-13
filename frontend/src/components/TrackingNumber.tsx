import React from 'react';
import { Text, TextStyle, StyleProp } from 'react-native';
import { fonts, colors } from '../constants/theme';

export default function TrackingNumber({ value, style }: { value: string; style?: StyleProp<TextStyle> }) {
  return (
    <Text
      style={[{ fontFamily: fonts.mono, fontSize: 14, fontWeight: '700', color: colors.primary, letterSpacing: 0.5 }, style]}
      selectable
    >
      {value}
    </Text>
  );
}
