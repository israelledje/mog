import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, TextInput, TouchableOpacity,
  ActivityIndicator, Dimensions, NativeScrollEvent, NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, ShoppingCart, Heart, Ruler } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { marketplaceApi, type MarketplaceProduct, type MarketplaceVariant } from '../../src/api/marketplace';
import { growthApi } from '../../src/api/growth';
import { formatErr } from '../../src/api/client';
import { resolveMediaUrl } from '../../src/utils/mediaUrl';
import { getWishlistIds, toggleWishlist } from '../../src/utils/wishlist';
import { colors, radii, spacing, fonts } from '../../src/constants/theme';

const { width: SCREEN_W } = Dimensions.get('window');

export default function MarketplaceProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [product, setProduct] = useState<MarketplaceProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState('1');
  const [promo, setPromo] = useState('');
  const [city, setCity] = useState('Douala');
  const [discount, setDiscount] = useState(0);
  const [buying, setBuying] = useState(false);
  const [variantId, setVariantId] = useState<string | null>(null);
  const [wished, setWished] = useState(false);
  const [imgIndex, setImgIndex] = useState(0);
  const galleryRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!id) return;
    marketplaceApi.getProduct(id)
      .then((p) => {
        setProduct(p);
        const variants = p.variants || [];
        if (variants.length) {
          const first = variants.find((v) => (v.stock ?? 0) > 0) || variants[0];
          setVariantId(first?.id || null);
        }
      })
      .catch(() => setProduct(null))
      .finally(() => setLoading(false));
    getWishlistIds().then((ids) => setWished(ids.includes(id)));
  }, [id]);

  const selectedVariant: MarketplaceVariant | null = useMemo(() => {
    if (!product?.variants?.length || !variantId) return null;
    return product.variants.find((v) => v.id === variantId) || null;
  }, [product, variantId]);

  const unitPrice = selectedVariant?.price_xaf != null
    ? Number(selectedVariant.price_xaf)
    : Number(product?.price_xaf || 0);
  const availableStock = selectedVariant
    ? Number(selectedVariant.stock || 0)
    : Number(product?.stock || 0);
  const subtotal = unitPrice * Math.max(1, Number(qty) || 1);
  const total = Math.max(0, subtotal - discount);
  const images = (product?.images || []).map(resolveMediaUrl).filter(Boolean);

  const onGalleryScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    setImgIndex(Math.round(x / SCREEN_W));
  };

  const onToggleWish = async () => {
    if (!id) return;
    const next = await toggleWishlist(id);
    setWished(next.includes(id));
  };

  const applyPromo = async () => {
    if (!promo.trim() || !product) return;
    try {
      const res = await growthApi.validatePromo(promo.trim(), subtotal, 'marketplace');
      setDiscount(Number(res.discount_xaf || 0));
      Toast.show({ type: 'success', text1: `Promo appliquée (−${Number(res.discount_xaf || 0).toLocaleString()} XAF)` });
    } catch (e: any) {
      setDiscount(0);
      Toast.show({ type: 'error', text1: formatErr(e, 'Code promo invalide') });
    }
  };

  const onCheckout = async () => {
    if (!product) return;
    if ((product.variants || []).length && !variantId) {
      Toast.show({ type: 'error', text1: 'Choisissez une variante' });
      return;
    }
    if (availableStock < Math.max(1, Number(qty) || 1)) {
      Toast.show({ type: 'error', text1: 'Stock insuffisant' });
      return;
    }
    setBuying(true);
    try {
      const checkout = await marketplaceApi.createCheckout({
        product_id: product.id,
        variant_id: variantId || undefined,
        quantity: Math.max(1, Number(qty) || 1),
        promo_code: promo.trim() || undefined,
        delivery_city: city || 'Douala',
      });
      router.push({ pathname: '/marketplace/checkout', params: { id: checkout.id } } as any);
    } catch (e: any) {
      Toast.show({ type: 'error', text1: formatErr(e, 'Checkout impossible') });
    } finally {
      setBuying(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (!product) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.empty}>Article introuvable</Text>
      </SafeAreaView>
    );
  }

  const variants = product.variants || [];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><ChevronLeft size={24} color={colors.text} /></TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{product.title}</Text>
        <TouchableOpacity onPress={onToggleWish} hitSlop={10}>
          <Heart size={22} color={wished ? '#E11D48' : colors.text} fill={wished ? '#E11D48' : 'transparent'} />
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <ScrollView
          ref={galleryRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onGalleryScroll}
          scrollEventThrottle={16}
          style={styles.gallery}
        >
          {(images.length ? images : ['']).map((uri, idx) => (
            <View key={`${uri}-${idx}`} style={styles.heroSlide}>
              {uri ? (
                <Image source={{ uri }} style={styles.hero} />
              ) : (
                <View style={[styles.hero, styles.heroEmpty]} />
              )}
            </View>
          ))}
        </ScrollView>
        {images.length > 1 && (
          <View style={styles.dots}>
            {images.map((_, i) => (
              <View key={i} style={[styles.dot, i === imgIndex && styles.dotOn]} />
            ))}
          </View>
        )}

        <View style={styles.body}>
          <Text style={styles.name}>{product.title}</Text>
          <Text style={styles.price}>{unitPrice.toLocaleString('fr-FR')} XAF</Text>
          <Text style={styles.desc}>{product.description || 'Article marketplace — livraison via groupage MOG.'}</Text>

          {(product.dimensions_label || product.cbm || product.length_cm) && (
            <View style={styles.dimsBox}>
              <Ruler size={16} color={colors.primary} />
              <Text style={styles.dimsText}>
                {product.dimensions_label
                  || [
                    product.length_cm && product.width_cm && product.height_cm
                      ? `${product.length_cm}×${product.width_cm}×${product.height_cm} cm`
                      : null,
                    product.cbm ? `${product.cbm} CBM` : null,
                  ].filter(Boolean).join(' · ')}
              </Text>
            </View>
          )}

          <Text style={styles.meta}>
            Origine {product.origin_city || 'Chine'} · {(product.transport_mode || 'sea') === 'sea' ? 'Maritime' : 'Aérien'} · Stock {availableStock}
          </Text>

          {variants.length > 0 && (
            <>
              <Text style={styles.label}>Variante</Text>
              <View style={styles.variantWrap}>
                {variants.map((v) => {
                  const on = v.id === variantId;
                  const disabled = (v.stock ?? 0) <= 0;
                  return (
                    <TouchableOpacity
                      key={v.id}
                      disabled={disabled}
                      style={[styles.variantChip, on && styles.variantChipOn, disabled && styles.variantDisabled]}
                      onPress={() => { setVariantId(v.id); setDiscount(0); }}
                    >
                      <Text style={[styles.variantText, on && styles.variantTextOn]}>{v.name}</Text>
                      <Text style={[styles.variantStock, on && styles.variantTextOn]}>
                        {disabled ? 'Rupture' : `Stock ${v.stock ?? 0}`}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          <Text style={styles.label}>Quantité</Text>
          <TextInput style={styles.input} keyboardType="number-pad" value={qty} onChangeText={(v) => { setQty(v); setDiscount(0); }} />

          <Text style={styles.label}>Ville de livraison</Text>
          <TextInput style={styles.input} value={city} onChangeText={setCity} placeholder="Douala" placeholderTextColor={colors.textSecondary} />

          <Text style={styles.label}>Code promo</Text>
          <View style={styles.promoRow}>
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              autoCapitalize="characters"
              value={promo}
              onChangeText={(v) => { setPromo(v); setDiscount(0); }}
              placeholder="PROMO10"
              placeholderTextColor={colors.textSecondary}
            />
            <TouchableOpacity style={styles.promoBtn} onPress={applyPromo}>
              <Text style={styles.promoBtnText}>Appliquer</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.totalBox}>
            <Text style={styles.totalLine}>Sous-total · {subtotal.toLocaleString('fr-FR')} XAF</Text>
            {discount > 0 && <Text style={styles.discount}>Réduction · −{discount.toLocaleString('fr-FR')} XAF</Text>}
            <Text style={styles.total}>Total · {total.toLocaleString('fr-FR')} XAF</Text>
          </View>
        </View>
      </ScrollView>

      <TouchableOpacity style={styles.cta} onPress={onCheckout} disabled={buying}>
        {buying ? <ActivityIndicator color="#fff" /> : (
          <>
            <ShoppingCart size={18} color="#fff" />
            <Text style={styles.ctaText}>Passer au paiement</Text>
          </>
        )}
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FB' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, backgroundColor: '#fff' },
  title: { flex: 1, textAlign: 'center', fontWeight: '800', color: colors.text, marginHorizontal: 8 },
  scroll: { paddingBottom: 24 },
  gallery: { backgroundColor: '#E8EEF5' },
  heroSlide: { width: SCREEN_W },
  hero: { width: SCREEN_W, height: 280, backgroundColor: '#E8EEF5' },
  heroEmpty: {},
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 10 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#CBD5E1' },
  dotOn: { backgroundColor: colors.primary, width: 18 },
  body: { padding: spacing.lg },
  name: { fontSize: 22, fontWeight: '900', color: colors.text, fontFamily: fonts.heading },
  price: { marginTop: 6, fontSize: 18, fontWeight: '900', color: colors.primary },
  desc: { marginTop: 10, color: colors.textSecondary, lineHeight: 20 },
  dimsBox: {
    marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#EEF4FF', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12,
  },
  dimsText: { flex: 1, fontWeight: '700', color: colors.primary, fontSize: 13 },
  meta: { marginTop: 8, fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  label: { marginTop: 16, marginBottom: 6, fontSize: 12, fontWeight: '800', color: colors.textSecondary, textTransform: 'uppercase' },
  input: {
    backgroundColor: '#fff', borderRadius: radii.input, paddingHorizontal: 14, paddingVertical: 12,
    color: colors.text, marginBottom: 8,
  },
  variantWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  variantChip: {
    backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1.5, borderColor: '#E5E7EB', minWidth: '46%',
  },
  variantChipOn: { borderColor: colors.primary, backgroundColor: '#EEF4FF' },
  variantDisabled: { opacity: 0.45 },
  variantText: { fontWeight: '800', color: colors.text, fontSize: 13 },
  variantTextOn: { color: colors.primary },
  variantStock: { marginTop: 2, fontSize: 11, color: colors.textSecondary },
  promoRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  promoBtn: { backgroundColor: colors.text, paddingHorizontal: 14, paddingVertical: 12, borderRadius: radii.button },
  promoBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  totalBox: { marginTop: 16, backgroundColor: '#fff', borderRadius: 16, padding: 16 },
  totalLine: { color: colors.textSecondary, fontWeight: '600' },
  discount: { marginTop: 4, color: '#059669', fontWeight: '700' },
  total: { marginTop: 8, fontSize: 18, fontWeight: '900', color: colors.text },
  cta: {
    margin: spacing.lg, backgroundColor: colors.primary, borderRadius: radii.button,
    paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  ctaText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  empty: { textAlign: 'center', marginTop: 40, color: colors.textSecondary },
});
