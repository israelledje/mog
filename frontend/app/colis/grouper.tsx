import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, CheckSquare, Square, Layers } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { useColisStore } from '../../src/store/colisStore';
import { api, formatErr } from '../../src/api/client';
import { colors, radii, spacing } from '../../src/constants/theme';
import { airBilledKgForPackages, airChargeableKgRaw, packageCbm } from '../../src/utils/freightBilling';

export default function GroupPackagesScreen() {
  const router = useRouter();
  const colis = useColisStore((s) => s.colis);
  const fetchColis = useColisStore((s) => s.fetchColis);
  const [selected, setSelected] = useState<string[]>([]);
  const [label, setLabel] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchColis();
  }, [fetchColis]);

  const eligible = colis.filter((c) =>
    ['pending_reception', 'received', 'quoted', 'grouped'].includes(c.status) && !c.container_id,
  );

  const selectedPkgs = useMemo(
    () => eligible.filter((c) => selected.includes(c.id)),
    [eligible, selected],
  );

  const airPreview = useMemo(() => {
    const air = selectedPkgs.filter((c) => {
      const m = String(c.transport_mode || '').toLowerCase();
      return m === 'air' || m === 'air_express';
    });
    if (air.length < 1) return null;
    const { rawSum, billedKg, note } = airBilledKgForPackages(air);
    const alone = air.reduce((s, p) => s + (airChargeableKgRaw(p) > 0 ? Math.ceil(airChargeableKgRaw(p)) : 0), 0);
    return { rawSum, billedKg, note, alone, saved: Math.max(0, alone - billedKg) };
  }, [selectedPkgs]);

  const seaPreview = useMemo(() => {
    const sea = selectedPkgs.filter((c) => {
      const m = String(c.transport_mode || 'sea').toLowerCase();
      return m !== 'air' && m !== 'air_express';
    });
    if (!sea.length) return null;
    const cbm = sea.reduce((s, p) => s + packageCbm(p), 0);
    return { cbm };
  }, [selectedPkgs]);

  const toggle = (id: string) => {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };

  const onGroup = async () => {
    if (selected.length < 2) {
      Toast.show({ type: 'error', text1: 'Sélectionnez au moins 2 colis' });
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/colis/group-client', {
        package_ids: selected,
        label: label || undefined,
        promo_code: promoCode.trim() || undefined,
      });
      const discount = res?.data?.promo_discount_xaf;
      const billedNote = res?.data?.billing_note;
      Toast.show({
        type: 'success',
        text1: 'Expédition groupée créée',
        text2: billedNote
          || (discount ? `Réduction promo : −${Number(discount).toLocaleString()} XAF` : undefined),
      });
      await fetchColis();
      router.back();
    } catch (e: any) {
      Toast.show({ type: 'error', text1: formatErr(e, 'Impossible de grouper') });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><ChevronLeft size={24} color={colors.text} /></TouchableOpacity>
        <Text style={styles.title}>Grouper mes colis</Text>
        <View style={{ width: 24 }} />
      </View>
      <Text style={styles.hint}>
        Regroupez plusieurs colis : en aérien, les kilos sont additionnés puis arrondis une seule fois
        (ex. 1,3 + 0,7 → 2 kg facturés, pas 3).
      </Text>
      <TextInput
        style={styles.input}
        placeholder="Nom de l'expédition (optionnel)"
        placeholderTextColor={colors.textSecondary}
        value={label}
        onChangeText={setLabel}
      />
      <TextInput
        style={styles.input}
        placeholder="Code promo (optionnel)"
        placeholderTextColor={colors.textSecondary}
        autoCapitalize="characters"
        value={promoCode}
        onChangeText={setPromoCode}
      />

      {airPreview && airPreview.rawSum > 0 && (
        <View style={styles.preview}>
          <Text style={styles.previewTitle}>Aérien — kilos groupés</Text>
          <Text style={styles.previewLine}>
            Poids : {airPreview.rawSum.toFixed(2)} kg → {airPreview.billedKg} kg facturés
          </Text>
          {airPreview.saved > 0 && (
            <Text style={styles.previewSave}>
              Économie vs facturation séparée : −{airPreview.saved} kg
              (sinon {airPreview.alone} kg)
            </Text>
          )}
        </View>
      )}
      {seaPreview && seaPreview.cbm > 0 && (
        <View style={styles.preview}>
          <Text style={styles.previewTitle}>Maritime — volume</Text>
          <Text style={styles.previewLine}>{seaPreview.cbm.toFixed(3)} CBM (somme)</Text>
        </View>
      )}

      <FlatList
        data={eligible}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: spacing.lg }}
        ListEmptyComponent={<Text style={styles.empty}>Aucun colis regroupable</Text>}
        renderItem={({ item }) => {
          const on = selected.includes(item.id);
          const raw = airChargeableKgRaw(item);
          const isAir = ['air', 'air_express'].includes(String(item.transport_mode || '').toLowerCase());
          return (
            <TouchableOpacity style={[styles.row, on && styles.rowOn]} onPress={() => toggle(item.id)}>
              {on ? <CheckSquare size={22} color={colors.primary} /> : <Square size={22} color={colors.textSecondary} />}
              <View style={{ flex: 1 }}>
                <Text style={styles.tracking}>{item.tracking_number}</Text>
                <Text style={styles.desc} numberOfLines={1}>{item.description}</Text>
                <Text style={styles.meta}>
                  {isAir
                    ? (raw > 0 ? `${raw} kg` : 'Poids à réception')
                    : `${packageCbm(item).toFixed(3)} CBM`}
                  {item.category_key ? ` · ${item.category_key}` : ''}
                </Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />
      <TouchableOpacity style={styles.cta} onPress={onGroup} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : (
          <>
            <Layers size={18} color="#fff" />
            <Text style={styles.ctaText}>Créer l'expédition ({selected.length})</Text>
          </>
        )}
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FB' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, backgroundColor: '#fff' },
  title: { fontSize: 18, fontWeight: '800', color: colors.text },
  hint: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, color: colors.textSecondary, fontSize: 13, lineHeight: 18 },
  input: { marginHorizontal: spacing.lg, marginTop: spacing.md, backgroundColor: '#fff', borderRadius: radii.input, paddingHorizontal: 14, paddingVertical: 12, color: colors.text },
  preview: {
    marginHorizontal: spacing.lg, marginTop: spacing.md, backgroundColor: '#ECFDF5',
    borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#A7F3D0',
  },
  previewTitle: { fontWeight: '800', color: '#065F46', marginBottom: 4, fontSize: 13 },
  previewLine: { color: '#047857', fontWeight: '700', fontSize: 14 },
  previewSave: { color: '#059669', marginTop: 4, fontSize: 12, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', padding: 14, borderRadius: 12, marginBottom: 8 },
  rowOn: { borderWidth: 1.5, borderColor: colors.primary },
  tracking: { fontWeight: '800', color: colors.text },
  desc: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  meta: { color: colors.primary, fontSize: 11, fontWeight: '700', marginTop: 4 },
  empty: { textAlign: 'center', color: colors.textSecondary, marginTop: 40 },
  cta: { margin: spacing.lg, backgroundColor: colors.primary, borderRadius: radii.button, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  ctaText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
