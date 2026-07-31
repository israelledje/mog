import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@admin_ui_mode';

export type AdminUiMode = 'admin' | 'client';

/** Préférence d'interface pour les comptes admin uniquement. */
export async function getAdminUiMode(): Promise<AdminUiMode> {
  try {
    const v = await AsyncStorage.getItem(KEY);
    return v === 'client' ? 'client' : 'admin';
  } catch {
    return 'admin';
  }
}

export async function setAdminUiMode(mode: AdminUiMode): Promise<void> {
  await AsyncStorage.setItem(KEY, mode);
}
