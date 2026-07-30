import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Image, TextInput,
  RefreshControl, ActivityIndicator, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ShoppingBag, Search, Package, ClipboardList } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { marketplaceApi, type MarketplaceProduct } from '../../src/api/marketplace';
import { resolveMediaUrl } from '../../src/utils/mediaUrl';
import { colors, radii, spacing, fonts, shadow } from '../../src/constants/theme';

const CATEGORIES = [
  { id: '', label: 'Tous' },
  { id: 'vehicle', label: 'Véhicules' },
  { id: 'electronics', label: 'Électro' },
  { id: 'fashion', label: 'Mode' },
  { id: 'other', label: 'Autre' },
];

type MarketTab = 'shop' | 'orders';

export default function MarketplaceTabScreen() {
  const router = useRouter();
  const [marketTab, setMarketTab] = useState<MarketTab>('shop');
  const [items, setItems] = useState<MarketplaceProduct[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [category, setCategory] = useState('');
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    try {
      if (marketTab === 'shop') {
        const data = await marketplaceApi.listProducts({
          category: category || undefined,
          q: q.trim() || undefined,
        });
        setItems(Array.isArray(data) ? data : []);
      } else {
        const data = await marketplaceApi.myOrders();
        setOrders(Array.isArray(data) ? data : []);
      }
    } catch {
      if (marketTab === 'shop') setItems([]);
      else setOrders([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [category, q, marketTab]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const formatPrice = (n: number) => `${Number(n || 0).toLocaleString('fr-FR')} XAF`;

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        {/* Bande menu marketplace */}
        <View style={styles.topBand}>
          <View style={styles.brandRow}>
            <View style={styles.brandIcon}>
              <ShoppingBag size={18} color={colors.primary} strokeWidth={2.2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.brandEyebrow}>MOG</Text>
              <Text style={styles.brandTitle}>Marketplace</Text>
            </View>
          </View>

          <View style={styles.segment}>
            <TouchableOpacity
              style={[styles.segmentBtn, marketTab === 'shop' && styles.segmentBtnOn]}
              onPress={() => { Haptics.selectionAsync(); setMarketTab('shop'); }}
            >
              <Package size={14} color={marketTab === 'shop' ? '#fff' : colors.textSecondary} />
              <Text style={[styles.segmentText, marketTab === 'shop' && styles.segmentTextOn]}>Boutique</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.segmentBtn, marketTab === 'orders' && styles.segmentBtnOn]}
              onPress={() => { Haptics.selectionAsync(); setMarketTab('orders'); }}
            >
              <ClipboardList size={14} color={marketTab === 'orders' ? '#fff' : colors.textSecondary} />
              <Text style={[styles.segmentText, marketTab === 'orders' && styles.segmentTextOn]}>Mes commandes</Text>
            </TouchableOpacity>
          </View>
        </View>

        {marketTab === 'shop' && (
          <>
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
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={{ flexGrow: 0 }}>
              {CATEGORIES.map((c) => (
                <TouchableOpacity
                  key={c.id || 'all'}
                  style={[styles.chip, category === c.id && styles.chipOn]}
                  onPress={() => setCategory(c.id)}
                >
                  <Text style={[styles.chipText, category === c.id && styles.chipTextOn]}>{c.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}

        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
        ) : marketTab === 'shop' ? (
          <FlatList
            data={items}
            keyExtractor={(i) => i.id}
            numColumns={2}
            columnWrapperStyle={{ gap: 12 }}
            contentContainerStyle={{ padding: spacing.lg, gap: 12, paddingBottom: 120 }}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />
            }
            ListEmptyComponent={<Text style={styles.empty}>Aucun article disponible pour le moment</Text>}
            renderItem={({ item }) => {
              const img = item.images?.[0] ? resolveMediaUrl(item.images[0]) : null;
              const variants = (item as any).variants || [];
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
                    {variants.length ? ` · ${variants.length} options` : item.stock != null ? ` · Stock ${item.stock}` : ''}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        ) : (
          <FlatList
            data={orders}
            keyExtractor={(o) => o.id}
            contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />
            }
            ListEmptyComponent={<Text style={styles.empty}>Aucune commande marketplace</Text>}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.orderCard}
                onPress={() => item.package_id && router.push(`/colis/${item.package_id}` as any)}
                disabled={!item.package_id}
              >
                <Text style={styles.tracking}>{item.tracking_number}</Text>
                <Text style={styles.orderTitle}>{item.product_title} ×{item.quantity || 1}</Text>
                <Text style={styles.meta}>
                  {Number(item.total_xaf || 0).toLocaleString('fr-FR')} XAF · {item.payment_status || 'pending'}
                </Text>
              </TouchableOpacity>
            )}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FB' },
  safe: { flex: 1 },
  topBand: {
    backgroundColor: '#fff',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E8ECF1',
    ...shadow.card,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  brandIcon: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: '#E8F1FC',
    alignItems: 'center', justifyContent: 'center',
  },
  brandEyebrow: { fontSize: 10, fontWeight: '700', color: colors.primary, letterSpacing: 1.2 },
  brandTitle: { fontSize: 20, fontWeight: '800', color: colors.text, fontFamily: fonts.heading },
  segment: {
    flexDirection: 'row', backgroundColor: '#F1F4F8', borderRadius: 14, padding: 4, gap: 4,
  },
  segmentBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: 11,
  },
  segmentBtnOn: { backgroundColor: colors.primary },
  segmentText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  segmentTextOn: { color: '#fff' },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: spacing.lg, marginTop: spacing.md,
    backgroundColor: '#fff', borderRadius: radii.input, paddingHorizontal: 12, height: 46,
  },
  search: { flex: 1, color: colors.text, fontSize: 14 },
  chips: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: 8, paddingBottom: 4 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: '#fff', marginRight: 0 },
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
  orderCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10 },
  tracking: { fontWeight: '900', color: colors.primary, fontFamily: 'monospace' },
  orderTitle: { marginTop: 4, fontWeight: '700', color: colors.text },
});
