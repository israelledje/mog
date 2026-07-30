import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, TextInput, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, ShoppingCart } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { marketplaceApi, type MarketplaceProduct } from '../../src/api/marketplace';
import { growthApi } from '../../src/api/growth';
import { formatErr } from '../../src/api/client';
import { resolveMediaUrl } from '../../src/utils/mediaUrl';
import { colors, radii, spacing, fonts } from '../../src/constants/theme';

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

  useEffect(() => {
    if (!id) return;
    marketplaceApi.getProduct(id)
      .then(setProduct)
      .catch(() => setProduct(null))
      .finally(() => setLoading(false));
  }, [id]);

  const subtotal = (product?.price_xaf || 0) * Math.max(1, Number(qty) || 1);
  const total = Math.max(0, subtotal - discount);

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

  const onBuy = async () => {
    if (!product) return;
    setBuying(true);
    try {
      const res = await marketplaceApi.purchase({
        product_id: product.id,
        quantity: Math.max(1, Number(qty) || 1),
        promo_code: promo.trim() || undefined,
        delivery_city: city || 'Douala',
      });
      Toast.show({ type: 'success', text1: 'Commande créée', text2: res?.package?.tracking_number });
      Alert.alert(
        'Achat confirmé',
        `Colis ${res?.package?.tracking_number || ''} créé. Il sera groupé puis réceptionnable au Cameroun.`,
        [
          { text: 'Voir le colis', onPress: () => router.replace(`/colis/${res.package.id}` as any) },
          { text: 'OK', onPress: () => router.replace('/marketplace' as any) },
        ],
      );
    } catch (e: any) {
      Toast.show({ type: 'error', text1: formatErr(e, 'Achat impossible') });
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

  const img = product.images?.[0] ? resolveMediaUrl(product.images[0]) : null;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><ChevronLeft size={24} color={colors.text} /></TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{product.title}</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        {img ? <Image source={{ uri: img }} style={styles.hero} /> : <View style={[styles.hero, styles.heroEmpty]} />}
        <Text style={styles.name}>{product.title}</Text>
        <Text style={styles.price}>{Number(product.price_xaf).toLocaleString('fr-FR')} XAF</Text>
        <Text style={styles.desc}>{product.description || 'Article marketplace — livraison via groupage MOG.'}</Text>
        <Text style={styles.meta}>
          Origine {product.origin_city || 'Chine'} · {(product.transport_mode || 'sea') === 'sea' ? 'Maritime' : 'Aérien'} · Stock {product.stock ?? 0}
        </Text>

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
      </ScrollView>

      <TouchableOpacity style={styles.cta} onPress={onBuy} disabled={buying}>
        {buying ? <ActivityIndicator color="#fff" /> : (
          <>
            <ShoppingCart size={18} color="#fff" />
            <Text style={styles.ctaText}>Acheter & créer le colis</Text>
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
  scroll: { padding: spacing.lg, paddingBottom: 24 },
  hero: { width: '100%', height: 220, borderRadius: 18, backgroundColor: '#E8EEF5' },
  heroEmpty: {},
  name: { marginTop: 16, fontSize: 22, fontWeight: '900', color: colors.text, fontFamily: fonts.heading },
  price: { marginTop: 6, fontSize: 18, fontWeight: '900', color: colors.primary },
  desc: { marginTop: 10, color: colors.textSecondary, lineHeight: 20 },
  meta: { marginTop: 8, fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  label: { marginTop: 16, marginBottom: 6, fontSize: 12, fontWeight: '800', color: colors.textSecondary, textTransform: 'uppercase' },
  input: {
    backgroundColor: '#fff', borderRadius: radii.input, paddingHorizontal: 14, paddingVertical: 12,
    color: colors.text, marginBottom: 8,
  },
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
