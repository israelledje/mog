import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { setAppLanguage, SupportedLang } from '../i18n';
import { colors, radii, fonts } from '../constants/theme';

const LANGS: { code: SupportedLang; flag: string; label: string }[] = [
  { code: 'fr', flag: '🇫🇷', label: 'FR' },
  { code: 'en', flag: '🇬🇧', label: 'EN' },
  { code: 'es', flag: '🇪🇸', label: 'ES' },
  { code: 'zh', flag: '🇨🇳', label: 'ZH' },
];

export default function LanguageSelector({ compact = false }: { compact?: boolean }) {
  const { i18n } = useTranslation();
  const onChange = async (code: SupportedLang) => {
    Haptics.selectionAsync();
    await setAppLanguage(code);
  };
  const activeCode = (i18n.language || 'fr').split('-')[0];

  return (
    <View style={[styles.wrap, compact && styles.compact]} testID="language-selector">
      {LANGS.map((l) => {
        const active = activeCode === l.code;
        return (
          <TouchableOpacity
            key={l.code}
            onPress={() => onChange(l.code)}
            style={[styles.pill, active && styles.pillActive]}
            testID={`lang-${l.code}`}
            activeOpacity={0.8}
          >
            <Text style={styles.flag}>{l.flag}</Text>
            <Text style={[styles.label, active && styles.labelActive]}>{l.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    backgroundColor: '#F3F4F6',
    padding: 4,
    borderRadius: radii.pill,
    alignSelf: 'stretch',
    borderWidth: 1,
    borderColor: colors.border,
  },
  compact: {
    backgroundColor: '#F3F4F6',
    borderColor: colors.border,
  },
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 8,
    borderRadius: radii.pill,
    minWidth: 0,
  },
  pillActive: {
    backgroundColor: colors.primary,
  },
  flag: {
    fontSize: 13,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
    fontFamily: fonts.body,
  },
  labelActive: {
    color: '#fff',
  },
});
