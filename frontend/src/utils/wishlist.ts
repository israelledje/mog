import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'marketplace_wishlist_ids';

export async function getWishlistIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function toggleWishlist(productId: string): Promise<string[]> {
  const ids = await getWishlistIds();
  const next = ids.includes(productId) ? ids.filter((id) => id !== productId) : [...ids, productId];
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export async function isInWishlist(productId: string): Promise<boolean> {
  const ids = await getWishlistIds();
  return ids.includes(productId);
}
