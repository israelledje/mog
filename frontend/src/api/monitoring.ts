import { Platform } from 'react-native';

/**
 * Wrapper autour de Sentry.
 * - Actif uniquement en production ET si un DSN est fourni via EXPO_PUBLIC_SENTRY_DSN.
 * - No-op silencieux sinon (dev, Expo Go, DSN absent) pour éviter tout crash.
 */

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;
let Sentry: typeof import('@sentry/react-native') | null = null;
let enabled = false;

export function initMonitoring() {
  // On n'active Sentry qu'en build de production avec un DSN configuré.
  if (__DEV__ || !DSN || Platform.OS === 'web') return;
  try {
    Sentry = require('@sentry/react-native');
    Sentry!.init({
      dsn: DSN,
      // Échantillonnage des traces de performance (10%).
      tracesSampleRate: 0.1,
      // Ne pas envoyer les données personnelles par défaut.
      sendDefaultPii: false,
    });
    enabled = true;
  } catch (e) {
    console.warn('[Monitoring] Sentry init failed', e);
  }
}

export function captureException(error: unknown, context?: Record<string, any>) {
  if (!enabled || !Sentry) {
    if (__DEV__) console.error('[Monitoring:dev]', error, context);
    return;
  }
  try {
    Sentry.captureException(error, context ? { extra: context } : undefined);
  } catch {}
}

export function captureMessage(message: string, context?: Record<string, any>) {
  if (!enabled || !Sentry) return;
  try {
    Sentry.captureMessage(message, context ? { extra: context } : undefined);
  } catch {}
}

export function setUserContext(user: { id?: string; email?: string; role?: string } | null) {
  if (!enabled || !Sentry) return;
  try {
    Sentry.setUser(user ? { id: user.id, email: user.email, role: user.role } : null);
  } catch {}
}

export function isMonitoringEnabled() {
  return enabled;
}
