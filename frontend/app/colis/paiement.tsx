import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Smartphone, Building2, Gift } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { paymentsApi } from '../../src/api/payments';
import { colisApi } from '../../src/api/colis';
import { formatErr } from '../../src/api/client';
import { colors, radii, spacing } from '../../src/constants/theme';

type Method = 'om' | 'momo' | 'bank';

export default function PaymentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const [method, setMethod] = useState<Method>('om');
  const [phone, setPhone] = useState('');
  const [reference, setReference] = useState('');
  const [amount, setAmount] = useState('');
  const [loyalty, setLoyalty] = useState({ points: 0, value_xaf: 0, point_value_xaf: 20 });
  const [usePoints, setUsePoints] = useState(0);
  const [loading, setLoading] = useState(false);
  const [bankInfo, setBankInfo] = useState<any>(null);

  useEffect(() => {
    (async () => {
      try {
        const [loy, bank, colis] = await Promise.all([
          paymentsApi.loyalty(),
          paymentsApi.bankInfo(),
          id ? colisApi.get(id) : Promise.resolve(null),
        ]);
        setLoyalty(loy);
        setBankInfo(bank);
        if (colis?.total_price) setAmount(String(colis.total_price));
      } catch {}
    })();
  }, [id]);

  const amountNum = Number(amount) || 0;
  const discount = usePoints * (loyalty.point_value_xaf || 20);
  const due = Math.max(0, amountNum - discount);

  const onSubmit = async () => {
    if (amountNum <= 0) {
      Toast.show({ type: 'error', text1: 'Montant invalide' });
      return;
    }
    if ((method === 'om' || method === 'momo') && phone.length < 8) {
      Toast.show({ type: 'error', text1: 'Numéro de téléphone requis' });
      return;
    }
    setLoading(true);
    try {
      if (method === 'bank') {
        await paymentsApi.payBank({
          package_id: id,
          amount: amountNum,
          reference,
          loyalty_points: usePoints,
        });
        Toast.show({
          type: 'success',
          text1: 'Virement enregistré',
          text2: 'Validation sous 3 jours ouvrés',
        });
      } else {
        await paymentsApi.payMobile({
          package_id: id,
          amount: amountNum,
          phone,
          method,
          loyalty_points: usePoints,
        });
        Toast.show({ type: 'success', text1: 'Paiement initié', text2: 'Validez sur votre téléphone' });
      }
      router.back();
    } catch (e: any) {
      Toast.show({ type: 'error', text1: formatErr(e, 'Erreur paiement') });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><ChevronLeft size={24} color={colors.text} /></TouchableOpacity>
        <Text style={styles.title}>{t('payment.title', { defaultValue: 'Paiement' })}</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.loyaltyCard}>
          <Gift size={20} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.loyaltyTitle}>{loyalty.points} points</Text>
            <Text style={styles.loyaltySub}>
              ≈ {loyalty.value_xaf.toLocaleString()} FCFA (1 pt = {loyalty.point_value_xaf} F)
            </Text>
            <Text style={[styles.loyaltySub, { marginTop: 4 }]}>
              100 pts / CBM · Air : poids taxable ÷ 167
            </Text>
          </View>
        </View>

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

        <Text style={styles.label}>Montant (FCFA)</Text>
        <TextInput style={styles.input} keyboardType="numeric" value={amount} onChangeText={setAmount} />

        {loyalty.points > 0 && (
          <>
            <Text style={styles.label}>Utiliser des points (max {loyalty.points})</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={String(usePoints || '')}
              onChangeText={(v) => setUsePoints(Math.min(loyalty.points, Math.max(0, parseInt(v || '0', 10))))}
            />
          </>
        )}

        {(method === 'om' || method === 'momo') && (
          <>
            <Text style={styles.label}>Téléphone {method === 'om' ? 'Orange' : 'MTN'}</Text>
            <TextInput style={styles.input} keyboardType="phone-pad" value={phone} onChangeText={setPhone} placeholder="6XXXXXXXX" placeholderTextColor={colors.textSecondary} />
          </>
        )}

        {method === 'bank' && (
          <View style={styles.bankBox}>
            <Text style={styles.bankTitle}>{bankInfo?.account_name || 'M.O.G GROUP'}</Text>
            {!!bankInfo?.bank_name && <Text style={styles.bankLine}>{bankInfo.bank_name}</Text>}
            {!!bankInfo?.iban && <Text style={styles.bankLine}>{bankInfo.iban}</Text>}
            <Text style={styles.bankNote}>{bankInfo?.note || 'Vérification sous 3 jours, validation opérateur.'}</Text>
            <Text style={styles.label}>Référence virement</Text>
            <TextInput style={styles.input} value={reference} onChangeText={setReference} />
          </View>
        )}

        <View style={styles.dueBox}>
          <Text style={styles.dueLabel}>À payer</Text>
          <Text style={styles.dueValue}>{due.toLocaleString()} FCFA</Text>
          {discount > 0 && <Text style={styles.dueDisc}>-{discount.toLocaleString()} F (points)</Text>}
        </View>

        <TouchableOpacity style={styles.cta} onPress={onSubmit} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>Confirmer</Text>}
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
  loyaltyCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#EEF2FF', padding: 14, borderRadius: 14, marginBottom: spacing.lg },
  loyaltyTitle: { fontWeight: '800', color: colors.text, fontSize: 16 },
  loyaltySub: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  label: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', marginBottom: 6, marginTop: 12 },
  methods: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  methodBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 999, borderWidth: 1, borderColor: colors.border },
  methodActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  methodTxt: { fontWeight: '700', fontSize: 12, color: colors.text },
  input: { backgroundColor: '#fff', borderRadius: radii.input, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: colors.text },
  bankBox: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginTop: 8 },
  bankTitle: { fontWeight: '800', fontSize: 15, color: colors.text },
  bankLine: { color: colors.textSecondary, marginTop: 4 },
  bankNote: { fontSize: 12, color: colors.accent, marginTop: 8, marginBottom: 8 },
  dueBox: { marginTop: spacing.lg, backgroundColor: colors.primary, borderRadius: 14, padding: 16, alignItems: 'center' },
  dueLabel: { color: 'rgba(255,255,255,0.8)', fontWeight: '600' },
  dueValue: { color: '#fff', fontSize: 28, fontWeight: '900', marginTop: 4 },
  dueDisc: { color: '#BBF7D0', marginTop: 4, fontWeight: '600' },
  cta: { marginTop: spacing.lg, backgroundColor: colors.accent, paddingVertical: 16, borderRadius: radii.button, alignItems: 'center' },
  ctaText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
