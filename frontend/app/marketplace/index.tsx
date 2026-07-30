import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Image, TextInput,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, ShoppingBag, Search } from 'lucide-react-native';
import { marketplaceApi, type MarketplaceProduct } from '../../src/api/marketplace';
import { resolveMediaUrl } from '../../src/utils/mediaUrl';
import { colors, radii, spacing, fonts } from '../../src/constants/theme';

const CATEGORIES = [
  { id: '', label: 'Tous' },
  { id: 'vehicle', label: 'Véhicules' },
  { id: 'electronics', label: 'Électro' },
  { id: 'fashion', label: 'Mode' },
  { id: 'other', label: 'Autre' },
];

export default function MarketplaceScreen() {
  const router = useRouter();
  const [items, setItems] = useState<MarketplaceProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [category, setCategory] = useState('');
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await marketplaceApi.listProducts({
        category: category || undefined,
        q: q.trim() || undefined,
      });
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [category, q]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const formatPrice = (n: number) => `${Number(n || 0).toLocaleString('fr-FR')} XAF`;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTitleRow}>
          <ShoppingBag size={18} color={colors.primary} />
          <Text style={styles.title}>Marketplace</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/marketplace/orders' as any)}>
          <Text style={styles.link}>Commandes</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchWrap}>
        <Search size={16} color={colors.textSecondary} />
        <TextInput
          style={styles.search}
          placeholder="Rechercher un article…"
          placeholderTextColor={colors.textSecondary}
          value={q}
          onChangeText={setQ}
          returnKeyType="search"
          onSubmitEditing={load}
        />
      </View>

      <View style={styles.chips}>
        {CATEGORIES.map((c) => (
          <TouchableOpacity
            key={c.id || 'all'}
            style={[styles.chip, category === c.id && styles.chipOn]}
            onPress={() => setCategory(c.id)}
          >
            <Text style={[styles.chipText, category === c.id && styles.chipTextOn]}>{c.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          numColumns={2}
          columnWrapperStyle={{ gap: 12 }}
          contentContainerStyle={{ padding: spacing.lg, gap: 12, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <Text style={styles.empty}>Aucun article disponible pour le moment</Text>
          }
          renderItem={({ item }) => {
            const img = item.images?.[0] ? resolveMediaUrl(item.images[0]) : null;
            return (
              <TouchableOpacity
                style={styles.card}
                activeOpacity={0.9}
                onPress={() => router.push(`/marketplace/${item.id}` as any)}
              >
                {img ? (
                  <Image source={{ uri: img }} style={styles.image} />
                ) : (
                  <View style={[styles.image, styles.imagePlaceholder]}>
                    <ShoppingBag size={28} color={colors.textSecondary} />
                  </View>
                )}
                <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                <Text style={styles.price}>{formatPrice(item.price_xaf)}</Text>
                <Text style={styles.meta}>
                  {(item.transport_mode === 'air' || item.transport_mode === 'air_express') ? 'Aérien' : 'Maritime'}
                  {item.stock != null ? ` · Stock ${item.stock}` : ''}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FB' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: '#fff',
  },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 18, fontWeight: '800', color: colors.text, fontFamily: fonts.heading },
  link: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: spacing.lg, marginTop: spacing.md,
    backgroundColor: '#fff', borderRadius: radii.input, paddingHorizontal: 12, height: 46,
  },
  search: { flex: 1, color: colors.text, fontSize: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: '#fff' },
  chipOn: { backgroundColor: colors.primary },
  chipText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  chipTextOn: { color: '#fff' },
  card: {
    flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 10, maxWidth: '48%',
  },
  image: { width: '100%', height: 110, borderRadius: 12, backgroundColor: '#EEF2F7' },
  imagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  cardTitle: { marginTop: 8, fontWeight: '800', color: colors.text, fontSize: 13, minHeight: 34 },
  price: { marginTop: 4, fontWeight: '900', color: colors.primary, fontSize: 13 },
  meta: { marginTop: 2, fontSize: 11, color: colors.textSecondary },
  empty: { textAlign: 'center', color: colors.textSecondary, marginTop: 48 },
});
