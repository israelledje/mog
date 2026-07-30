import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Smartphone, Building2 } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { marketplaceApi } from '../../src/api/marketplace';
import { paymentsApi } from '../../src/api/payments';
import { formatErr } from '../../src/api/client';
import { resolveMediaUrl } from '../../src/utils/mediaUrl';
import { colors, radii, spacing } from '../../src/constants/theme';

type Method = 'om' | 'momo' | 'bank';

export default function MarketplaceCheckoutScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [checkout, setCheckout] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [method, setMethod] = useState<Method>('om');
  const [phone, setPhone] = useState('');
  const [reference, setReference] = useState('');
  const [bankInfo, setBankInfo] = useState<any>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const [c, bank] = await Promise.all([
          marketplaceApi.getCheckout(id),
          paymentsApi.bankInfo(),
        ]);
        setCheckout(c);
        setBankInfo(bank);
      } catch (e: any) {
        Toast.show({ type: 'error', text1: formatErr(e, 'Checkout introuvable') });
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const onPay = async () => {
    if (!id || !checkout) return;
    if ((method === 'om' || method === 'momo') && phone.trim().length < 8) {
      Toast.show({ type: 'error', text1: 'Numéro de téléphone requis' });
      return;
    }
    if (method === 'bank' && !reference.trim()) {
      Toast.show({ type: 'error', text1: 'Référence de virement requise' });
      return;
    }
    setSubmitting(true);
    try {
      const res = await marketplaceApi.payCheckout(id, {
        method,
        phone: phone.trim() || undefined,
        reference: reference.trim() || undefined,
      });
      if (res?.finalized?.package?.id) {
        Toast.show({ type: 'success', text1: 'Commande confirmée', text2: res.finalized.package.tracking_number });
        router.replace(`/colis/${res.finalized.package.id}` as any);
        return;
      }
      Toast.show({
        type: 'success',
        text1: method === 'bank' ? 'Virement enregistré' : 'Paiement soumis',
        text2: 'Validation opérateur avant création de la commande',
      });
      router.replace('/(tabs)/marketplace' as any);
    } catch (e: any) {
      Toast.show({ type: 'error', text1: formatErr(e, 'Paiement impossible') });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (!checkout) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.empty}>Checkout introuvable</Text>
      </SafeAreaView>
    );
  }

  const img = checkout.product_image ? resolveMediaUrl(checkout.product_image) : null;
  const amount = Number(checkout.total_xaf || 0);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><ChevronLeft size={24} color={colors.text} /></TouchableOpacity>
        <Text style={styles.title}>Paiement</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.summary}>
          {img ? <Image source={{ uri: img }} style={styles.thumb} /> : <View style={[styles.thumb, styles.thumbEmpty]} />}
          <View style={{ flex: 1 }}>
            <Text style={styles.productTitle}>{checkout.product_title}</Text>
            <Text style={styles.meta}>Qté {checkout.quantity} · {checkout.tracking_number}</Text>
            <Text style={styles.amount}>{amount.toLocaleString('fr-FR')} XAF</Text>
          </View>
        </View>

        <Text style={styles.hint}>
          La commande et le colis ne sont créés qu&apos;après validation du paiement (immédiat pour Mobile Money, ou validation opérateur pour virement).
        </Text>

        <Text style={styles.label}>Méthode</Text>
        <View style={styles.methods}>
          {([
            { k: 'om' as Method, label: 'Orange Money', Icon: Smartphone },
            { k: 'momo' as Method, label: 'MTN MoMo', Icon: Smartphone },
            { k: 'bank' as Method, label: 'Virement', Icon: Building2 },
          ]).map((m) => (
            <TouchableOpacity
              key={m.k}
              style={[styles.methodBtn, method === m.k && styles.methodActive]}
              onPress={() => setMethod(m.k)}
            >
              <m.Icon size={18} color={method === m.k ? '#fff' : colors.primary} />
              <Text style={[styles.methodTxt, method === m.k && { color: '#fff' }]}>{m.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {(method === 'om' || method === 'momo') && (
          <>
            <Text style={styles.label}>Téléphone {method === 'om' ? 'Orange' : 'MTN'}</Text>
            <TextInput
              style={styles.input}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
              placeholder="6XXXXXXXX"
              placeholderTextColor={colors.textSecondary}
            />
          </>
        )}

        {method === 'bank' && (
          <View style={styles.bankBox}>
            <Text style={styles.bankTitle}>{bankInfo?.account_name || 'M.O.G GROUP'}</Text>
            {!!bankInfo?.bank_name && <Text style={styles.bankLine}>{bankInfo.bank_name}</Text>}
            {!!bankInfo?.iban && <Text style={styles.bankLine}>{bankInfo.iban}</Text>}
            <Text style={styles.bankNote}>
              {bankInfo?.note || 'Indiquez la référence du virement. Un opérateur validera avant création de la commande.'}
            </Text>
            <Text style={styles.label}>Référence / N° de virement</Text>
            <TextInput
              style={styles.input}
              value={reference}
              onChangeText={setReference}
              placeholder="Ex. VIR-2026-…"
              placeholderTextColor={colors.textSecondary}
            />
          </View>
        )}

        <TouchableOpacity style={styles.cta} onPress={onPay} disabled={submitting}>
          {submitting ? <ActivityIndicator color="#fff" /> : (
            <Text style={styles.ctaText}>
              {method === 'bank' ? 'Soumettre le virement' : `Payer ${amount.toLocaleString('fr-FR')} XAF`}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FB' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, backgroundColor: '#fff' },
  title: { fontSize: 18, fontWeight: '800', color: colors.text },
  scroll: { padding: spacing.lg },
  summary: {
    flexDirection: 'row', gap: 12, backgroundColor: '#fff', borderRadius: 16, padding: 12, marginBottom: 12,
  },
  thumb: { width: 72, height: 72, borderRadius: 12, backgroundColor: '#E8EEF5' },
  thumbEmpty: {},
  productTitle: { fontWeight: '800', color: colors.text, fontSize: 15 },
  meta: { marginTop: 4, color: colors.textSecondary, fontSize: 12 },
  amount: { marginTop: 6, fontWeight: '900', color: colors.primary, fontSize: 16 },
  hint: { color: colors.textSecondary, fontSize: 13, lineHeight: 18, marginBottom: 8 },
  label: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', marginBottom: 6, marginTop: 12 },
  methods: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  methodBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff',
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: 999, borderWidth: 1, borderColor: colors.border,
  },
  methodActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  methodTxt: { fontWeight: '700', fontSize: 12, color: colors.text },
  input: { backgroundColor: '#fff', borderRadius: radii.input, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: colors.text },
  bankBox: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginTop: 8 },
  bankTitle: { fontWeight: '800', fontSize: 15, color: colors.text },
  bankLine: { color: colors.textSecondary, marginTop: 4 },
  bankNote: { fontSize: 12, color: colors.accent, marginTop: 8, marginBottom: 4 },
  cta: { marginTop: spacing.xl, backgroundColor: colors.primary, paddingVertical: 16, borderRadius: radii.button, alignItems: 'center' },
  ctaText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  empty: { textAlign: 'center', marginTop: 40, color: colors.textSecondary },
});
