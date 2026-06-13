import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { setAppLanguage, SupportedLang } from '../i18n';
import { colors, radii, fonts } from '../constants/theme';

const LANGS: { code: SupportedLang; flag: string; label: string }[] = [
  { code: 'fr', flag: '🇫🇷', label: 'FR' },
  { code: 'en', flag: '🇬🇧', label: 'EN' },
  { code: 'zh', flag: '🇨🇳', label: '中文' },
];

export default function LanguageSelector({ compact = false }: { compact?: boolean }) {
  const { i18n } = useTranslation();
  const onChange = async (code: SupportedLang) => {
    Haptics.selectionAsync();
    await setAppLanguage(code);
  };
  return (
    <View style={[styles.wrap, compact && styles.compact]} testID="language-selector">
      {LANGS.map((l) => {
        const active = i18n.language === l.code;
        return (
          <TouchableOpacity
            key={l.code}
            onPress={() => onChange(l.code)}
            style={[styles.pill, active && styles.pillActive]}
            testID={`lang-${l.code}`}
          >
            <Text style={[styles.label, active && styles.labelActive]}>
              {l.flag} {l.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: '#fff',
    padding: 4,
    borderRadius: radii.pill,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.border,
  },
  compact: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
  },
  pillActive: {
    backgroundColor: colors.primary,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
    fontFamily: fonts.body,
  },
  labelActive: {
    color: '#fff',
  },
});
