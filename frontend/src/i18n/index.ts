import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';

import fr from './locales/fr.json';
import en from './locales/en.json';
import zh from './locales/zh.json';

const STORAGE_KEY = '@app_lang';

export const SUPPORTED_LANGS = ['fr', 'en', 'zh'] as const;
export type SupportedLang = typeof SUPPORTED_LANGS[number];

const detectInitialLang = async (): Promise<SupportedLang> => {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED_LANGS.includes(stored as SupportedLang)) {
      return stored as SupportedLang;
    }
  } catch {}
  // French is default per product spec
  return 'fr';
};

export const setAppLanguage = async (lang: SupportedLang) => {
  await AsyncStorage.setItem(STORAGE_KEY, lang);
  await i18n.changeLanguage(lang);
};

export const initI18n = async () => {
  const lang = await detectInitialLang();
  await i18n
    .use(initReactI18next)
    .init({
      compatibilityJSON: 'v4',
      resources: {
        fr: { translation: fr },
        en: { translation: en },
        zh: { translation: zh },
      },
      lng: lang,
      fallbackLng: 'fr',
      interpolation: { escapeValue: false },
    });
  return lang;
};

export default i18n;
