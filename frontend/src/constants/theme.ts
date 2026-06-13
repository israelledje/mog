import { Platform } from 'react-native';

export const darkColors = {
  primary: '#3366CC',
  primaryDark: '#2852A3',
  secondary: '#00B33C',
  accent: '#00B33C',
  success: '#10B981',
  background: '#111827',
  card: '#1F2937',
  text: '#F9FAFB',
  textSecondary: '#9CA3AF',
  textInverse: '#1A1A1A',
  border: '#374151',
  borderLight: '#1F2937',
  danger: '#EF4444',
  dangerBg: '#7F1D1D',
  warning: '#F59E0B',
  overlay: 'rgba(0,0,0,0.8)',
};

export const colors = {
  primary: '#3366CC',
  primaryDark: '#2852A3',
  secondary: '#009933',
  accent: '#009933',
  success: '#009933',
  background: '#F4F6F9',
  card: '#FFFFFF',
  text: '#1A1A1A',
  textSecondary: '#6B7280',
  textInverse: '#FFFFFF',
  border: '#E5E7EB',
  borderLight: '#F3F4F6',
  danger: '#DC2626',
  dangerBg: '#FEE2E2',
  warning: '#F59E0B',
  overlay: 'rgba(0,0,0,0.5)',
};

export const statusColors: Record<string, { bg: string; text: string }> = {
  pending_reception: { bg: '#F3F4F6', text: '#4B5563' },
  received: { bg: '#DBEAFE', text: '#1D4ED8' },
  damaged: { bg: '#FEE2E2', text: '#B91C1C' },
  quoted: { bg: '#FFEDD5', text: '#C2410C' },
  grouped: { bg: '#E0E7FF', text: '#4338CA' },
  loading: { bg: '#FEF3C7', text: '#B45309' },
  loaded: { bg: '#FEF3C7', text: '#B45309' },
  closed: { bg: '#E0E7FF', text: '#4338CA' },
  departed: { bg: '#3366CC', text: '#FFFFFF' },
  in_transit: { bg: '#3366CC', text: '#FFFFFF' },
  arrived: { bg: '#DCFCE7', text: '#15803D' },
  distributed: { bg: '#DCFCE7', text: '#15803D' },
  delivered: { bg: '#009933', text: '#FFFFFF' },
};

export const radii = {
  card: 12,
  input: 8,
  button: 8,
  pill: 999,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const fonts = {
  body: Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' }) as string,
  heading: Platform.select({ ios: 'System', android: 'sans-serif-medium', default: 'System' }) as string,
  mono: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }) as string,
};

export const shadow = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  floating: {
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 8,
  },
};
