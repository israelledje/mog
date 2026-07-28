// Deux "projects" Jest :
//  - "logic"      : tests de logique pure (utils) en environnement node, rapides.
//  - "components" : tests d'écrans via jest-expo + React Native Testing Library.
const rntlTransformIgnore = [
  'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|@sentry/.*|zustand|react-hook-form|react-i18next|i18next|lucide-react-native))',
];

module.exports = {
  projects: [
    {
      displayName: 'logic',
      testEnvironment: 'node',
      transform: { '^.+\\.[jt]sx?$': 'babel-jest' },
      transformIgnorePatterns: ['node_modules/(?!(zod)/)'],
      testMatch: ['<rootDir>/__tests__/*.test.ts'],
      moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
    },
    {
      displayName: 'components',
      preset: 'jest-expo',
      testMatch: ['<rootDir>/__tests__/components/**/*.test.tsx'],
      setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
      transformIgnorePatterns: rntlTransformIgnore,
      // Le premier rendu transforme beaucoup de modules RN/Expo : marge confortable.
      testTimeout: 30000,
    },
  ],
};
