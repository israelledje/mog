import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, TextInput,
  RefreshControl, ActivityIndicator, Dimensions, ImageBackground,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  ShoppingBag, Search, Package, ClipboardList, Heart, Store, ChevronRight,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { marketplaceApi, type MarketplaceProduct } from '../../src/api/marketplace';
import { getWishlistIds } from '../../src/utils/wishlist';
import { resolveMediaUrl } from '../../src/utils/mediaUrl';
import StarRating from '../../src/components/StarRating';
import { colors, radii, spacing, fonts, shadow } from '../../src/constants/theme';

const HEADER_BG = require('../../assets/images/logistics-transportation-container-cargo-ship-cargo-plane-with-working-crane-bridge-shipyard-sunrise-logistic-import-export-transport-industry-background-ai-generative.jpg');

type MarketTab = 'shop' | 'orders' | 'wishlist';
const COL = (Dimensions.get('window').width - spacing.lg * 2 - 12) / 2;

export default function MarketplaceTabScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const [marketTab, setMarketTab] = useState<MarketTab>('shop');
  const [items, setItems] = useState<MarketplaceProduct[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [wishlistIds, setWishlistIds] = useState<string[]>([]);
  const [wishlistItems, setWishlistItems] = useState<MarketplaceProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [category, setCategory] = useState('');
  const [q, setQ] = useState('');

  const categories = useMemo(() => ([
    { id: '', label: t('marketplace.cat_all') },
    { id: 'vehicle', label: t('marketplace.cat_vehicle') },
    { id: 'electronics', label: t('marketplace.cat_electronics') },
    { id: 'fashion', label: t('marketplace.cat_fashion') },
    { id: 'other', label: t('marketplace.cat_other') },
  ]), [t, i18n.language]);

  const load = useCallback(async () => {
    try {
      const wish = await getWishlistIds();
      setWishlistIds(wish);
      if (marketTab === 'shop') {
        const data = await marketplaceApi.listProducts({
          category: category || undefined,
          q: q.trim() || undefined,
        });
        setItems(Array.isArray(data) ? data : []);
      } else if (marketTab === 'orders') {
        const data = await marketplaceApi.myOrders();
        setOrders(Array.isArray(data) ? data : []);
      } else {
        const all = await marketplaceApi.listProducts({});
        const list = Array.isArray(all) ? all : [];
        setWishlistItems(list.filter((p) => wish.includes(p.id)));
      }
    } catch {
      if (marketTab === 'shop') setItems([]);
      else if (marketTab === 'orders') setOrders([]);
      else setWishlistItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [category, q, marketTab]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      getWishlistIds().then(setWishlistIds);
    }, []),
  );

  const formatPrice = (n: number) =>
    `${Number(n || 0).toLocaleString(i18n.language)} ${t('common.currency_xaf')}`;

  const renderProductCard = (item: MarketplaceProduct) => {
    const img = item.images?.[0] ? resolveMediaUrl(item.images[0]) : null;
    const variants = item.variants || [];
    const wished = wishlistIds.includes(item.id);
    const mode = (item.transport_mode === 'air' || item.transport_mode === 'air_express')
      ? t('marketplace.transport_air')
      : t('marketplace.transport_sea');
    return (
      <TouchableOpacity
        key={item.id}
        style={[styles.card, { width: COL }]}
        activeOpacity={0.9}
        onPress={() => router.push(`/marketplace/${item.id}` as any)}
      >
        <View>
          {img ? (
            <Image source={{ uri: img }} style={styles.image} />
          ) : (
            <View style={[styles.image, styles.imagePlaceholder]}>
              <ShoppingBag size={28} color={colors.textSecondary} />
            </View>
          )}
          {wished && (
            <View style={styles.wishBadge}>
              <Heart size={12} color="#E11D48" fill="#E11D48" />
            </View>
          )}
        </View>
        <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
        <StarRating rating={item.rating_avg || 0} count={item.rating_count || 0} size={12} />
        <Text style={styles.price}>{formatPrice(item.price_xaf)}</Text>
        <Text style={styles.meta} numberOfLines={1}>
          {item.dimensions_label || mode}
          {variants.length ? ` · ${t('marketplace.variants_count', { count: variants.length })}` : ''}
        </Text>
      </TouchableOpacity>
    );
  };

  const menus = [
    { id: 'shop' as MarketTab, label: t('marketplace.tab_shop'), Icon: Package },
    { id: 'orders' as MarketTab, label: t('marketplace.tab_orders'), Icon: ClipboardList },
    { id: 'wishlist' as MarketTab, label: t('marketplace.tab_wishlist'), Icon: Heart },
  ];

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <ImageBackground source={HEADER_BG} style={styles.topBand} imageStyle={styles.topBandImg}>
          <LinearGradient
            colors={['rgba(15,23,42,0.55)', 'rgba(15,23,42,0.88)']}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.brandRow}>
            <View style={styles.brandIcon}>
              <Store size={20} color="#fff" strokeWidth={2.2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.brandEyebrow}>{t('marketplace.brand_eyebrow')}</Text>
              <Text style={styles.brandTitle}>{t('marketplace.title')}</Text>
            </View>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => { Haptics.selectionAsync(); setMarketTab('wishlist'); }}
            >
              <Heart size={18} color={marketTab === 'wishlist' ? '#FDA4AF' : '#fff'} />
              {wishlistIds.length > 0 && (
                <View style={styles.countDot}>
                  <Text style={styles.countDotText}>{wishlistIds.length}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.menuRow}>
            {menus.map((m) => {
              const on = marketTab === m.id;
              return (
                <TouchableOpacity
                  key={m.id}
                  style={[styles.menuChip, on && styles.menuChipOn]}
                  onPress={() => { Haptics.selectionAsync(); setMarketTab(m.id); }}
                >
                  <m.Icon size={14} color={on ? '#fff' : 'rgba(255,255,255,0.75)'} />
                  <Text style={[styles.menuChipText, on && styles.menuChipTextOn]}>{m.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </ImageBackground>

        <ScrollView
          contentContainerStyle={{ paddingBottom: 120 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />
          }
          stickyHeaderIndices={marketTab === 'shop' ? [0] : undefined}
        >
          {marketTab === 'shop' && (
            <View style={styles.stickyFilters}>
              <View style={styles.searchWrap}>
                <Search size={16} color={colors.textSecondary} />
                <TextInput
                  style={styles.search}
                  placeholder={t('marketplace.search_placeholder')}
                  placeholderTextColor={colors.textSecondary}
                  value={q}
                  onChangeText={setQ}
                  returnKeyType="search"
                  onSubmitEditing={load}
                />
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                {categories.map((c) => (
                  <TouchableOpacity
                    key={c.id || 'all'}
                    style={[styles.chip, category === c.id && styles.chipOn]}
                    onPress={() => setCategory(c.id)}
                  >
                    <Text style={[styles.chipText, category === c.id && styles.chipTextOn]}>{c.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {loading ? (
            <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
          ) : marketTab === 'shop' ? (
            <View style={styles.grid}>
              {items.length ? items.map(renderProductCard) : (
                <Text style={styles.empty}>{t('marketplace.empty_shop')}</Text>
              )}
            </View>
          ) : marketTab === 'wishlist' ? (
            <View style={styles.grid}>
              {wishlistItems.length ? wishlistItems.map(renderProductCard) : (
                <View style={styles.emptyBox}>
                  <Heart size={28} color={colors.textSecondary} />
                  <Text style={styles.empty}>{t('marketplace.empty_wishlist')}</Text>
                </View>
              )}
            </View>
          ) : (
            <View style={{ padding: spacing.lg }}>
              {orders.length ? orders.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.orderCard}
                  onPress={() => item.package_id && router.push(`/colis/${item.package_id}` as any)}
                  disabled={!item.package_id}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.tracking}>{item.tracking_number}</Text>
                    <Text style={styles.orderTitle}>{item.product_title} ×{item.quantity || 1}</Text>
                    <Text style={styles.meta}>
                      {Number(item.total_xaf || 0).toLocaleString(i18n.language)} {t('common.currency_xaf')} · {item.payment_status || 'pending'}
                    </Text>
                  </View>
                  <ChevronRight size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              )) : (
                <Text style={styles.empty}>{t('marketplace.empty_orders')}</Text>
              )}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6F9' },
  safe: { flex: 1 },
  topBand: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    overflow: 'hidden',
  },
  topBandImg: { resizeMode: 'cover' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14, zIndex: 1 },
  brandIcon: {
    width: 42, height: 42, borderRadius: 14, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  brandEyebrow: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.7)', letterSpacing: 1.4 },
  brandTitle: { fontSize: 22, fontWeight: '800', color: '#fff', fontFamily: fonts.heading },
  iconBtn: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center', justifyContent: 'center',
  },
  countDot: {
    position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: '#E11D48', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  countDotText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  menuRow: { gap: 8, paddingRight: 8, zIndex: 1 },
  menuChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  menuChipOn: { backgroundColor: colors.primary },
  menuChipText: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.8)' },
  menuChipTextOn: { color: '#fff' },
  stickyFilters: { backgroundColor: '#F4F6F9', paddingBottom: 4 },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: spacing.lg, marginTop: spacing.md,
    backgroundColor: '#fff', borderRadius: radii.input, paddingHorizontal: 12, height: 46,
    ...shadow.card,
  },
  search: { flex: 1, color: colors.text, fontSize: 14 },
  chips: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: 8, paddingBottom: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: '#fff' },
  chipOn: { backgroundColor: colors.primary },
  chipText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  chipTextOn: { color: '#fff' },
  grid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 12,
    paddingHorizontal: spacing.lg, paddingTop: spacing.md,
  },
  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 10, marginBottom: 2,
  },
  image: { width: '100%', height: 118, borderRadius: 12, backgroundColor: '#EEF2F7' },
  imagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  wishBadge: {
    position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
  },
  cardTitle: { marginTop: 8, fontWeight: '800', color: colors.text, fontSize: 13, minHeight: 34 },
  price: { marginTop: 4, fontWeight: '900', color: colors.primary, fontSize: 13 },
  meta: { marginTop: 2, fontSize: 11, color: colors.textSecondary },
  empty: { textAlign: 'center', color: colors.textSecondary, marginTop: 24, width: '100%', paddingHorizontal: 24 },
  emptyBox: { width: '100%', alignItems: 'center', paddingTop: 40, gap: 12 },
  orderCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10,
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  tracking: { fontWeight: '900', color: colors.primary, fontFamily: 'monospace' },
  orderTitle: { marginTop: 4, fontWeight: '700', color: colors.text },
});
