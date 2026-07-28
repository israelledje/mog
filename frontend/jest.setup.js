/* Setup commun aux tests de composants (React Native Testing Library). */

// Le premier rendu transforme de nombreux modules RN/Expo (coût élevé) : marge large.
jest.setTimeout(60000);

// Expo (winter runtime) installe des globals "paresseux" (fetch, URL, structuredClone…)
// via des getters qui font un require au premier accès. Pendant le teardown de Jest,
// cet accès différé lève "require outside of the scope of the test code".
// On les lit une fois ici (dans le scope du test) pour matérialiser leur valeur réelle,
// de sorte qu'aucun require ne soit déclenché plus tard.
[
  'TextDecoder',
  'TextEncoder',
  'TextDecoderStream',
  'TextEncoderStream',
  'URL',
  'URLSearchParams',
  'DOMException',
  '__ExpoImportMetaRegistry',
  'structuredClone',
  'Headers',
  'Request',
  'Response',
  'FormData',
  'Blob',
  'fetch',
].forEach((key) => {
  try {
    // Lire la propriété suffit à déclencher le getter paresseux -> valeur figée.
    void globalThis[key];
  } catch {}
});

// i18n : t renvoie la clé (suffit pour cibler via testID / vérifier la logique).
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, opts) => (opts && opts.defaultValue) || key,
    i18n: { language: 'fr', changeLanguage: jest.fn() },
  }),
  initReactI18next: { type: '3rdParty', init: jest.fn() },
  Trans: ({ children }) => children,
}));

// Toasts
jest.mock('react-native-toast-message', () => ({
  __esModule: true,
  default: { show: jest.fn(), hide: jest.fn() },
}));

// Haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

// AsyncStorage (mock officiel)
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// Silence les warnings d'animation/act non pertinents pour ces tests.
jest.spyOn(console, 'warn').mockImplementation(() => {});
