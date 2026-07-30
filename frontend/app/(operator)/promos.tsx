import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Modal,
  ActivityIndicator, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, Plus } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { growthApi } from '../../src/api/growth';
import { formatErr } from '../../src/api/client';
import { darkColors as colors, radii, spacing } from '../../src/constants/theme';

export default function OperatorPromosScreen() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    code: '', label: '', discount_type: 'percent', discount_value: '', applicable_to: 'all',
  });

  const load = useCallback(async () => {
    try {
      const data = await growthApi.listPromos();
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!form.code.trim() || !form.discount_value) {
      Toast.show({ type: 'error', text1: 'Code et valeur requis' });
      return;
    }
    setSaving(true);
    try {
      await growthApi.createPromo({
        code: form.code.trim().toUpperCase(),
        label: form.label,
        discount_type: form.discount_type,
        discount_value: Number(form.discount_value),
        applicable_to: form.applicable_to,
        active: true,
      });
      setShow(false);
      setForm({ code: '', label: '', discount_type: 'percent', discount_value: '', applicable_to: 'all' });
      setLoading(true);
      load();
      Toast.show({ type: 'success', text1: 'Code promo créé' });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: formatErr(e, 'Erreur') });
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (item: any) => {
    try {
      await growthApi.updatePromo(item.id, { active: !item.active });
      load();
    } catch (e: any) {
      Toast.show({ type: 'error', text1: formatErr(e, 'Erreur') });
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><ChevronLeft size={24} color={colors.text} /></TouchableOpacity>
        <Text style={styles.title}>Codes promo</Text>
        <TouchableOpacity onPress={() => setShow(true)}><Plus size={22} color={colors.primary} /></TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: spacing.lg }}
          ListEmptyComponent={<Text style={styles.empty}>Aucun code promo</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => toggle(item)}>
              <Text style={styles.code}>{item.code}</Text>
              <Text style={styles.meta}>
                {item.discount_type === 'percent' ? `${item.discount_value}%` : `${item.discount_value} XAF`}
                {' · '}{item.used_count || 0} utilisations · {item.active ? 'Actif' : 'Inactif'}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}

      <Modal visible={show} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalBox}>
            <Text style={styles.modalTitle}>Nouveau code</Text>
            <TextInput style={styles.input} placeholder="CODE" placeholderTextColor={colors.textSecondary} autoCapitalize="characters" value={form.code} onChangeText={(v) => setForm({ ...form, code: v })} />
            <TextInput style={styles.input} placeholder="Libellé" placeholderTextColor={colors.textSecondary} value={form.label} onChangeText={(v) => setForm({ ...form, label: v })} />
            <TextInput style={styles.input} placeholder="Valeur" placeholderTextColor={colors.textSecondary} keyboardType="numeric" value={form.discount_value} onChangeText={(v) => setForm({ ...form, discount_value: v })} />
            <View style={styles.row}>
              {(['percent', 'fixed'] as const).map((t) => (
                <TouchableOpacity key={t} style={[styles.chip, form.discount_type === t && styles.chipOn]} onPress={() => setForm({ ...form, discount_type: t })}>
                  <Text style={[styles.chipText, form.discount_type === t && { color: '#fff' }]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.cta} onPress={create} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>Créer</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShow(false)} style={{ marginTop: 12 }}>
              <Text style={{ color: colors.textSecondary, textAlign: 'center', fontWeight: '700' }}>Annuler</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg },
  title: { fontSize: 18, fontWeight: '800', color: colors.text },
  card: { backgroundColor: colors.card, borderRadius: 14, padding: 14, marginBottom: 10 },
  code: { fontWeight: '900', color: colors.primary, fontFamily: 'monospace', fontSize: 16 },
  meta: { marginTop: 4, fontSize: 12, color: colors.textSecondary },
  empty: { textAlign: 'center', color: colors.textSecondary, marginTop: 40 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40 },
  modalTitle: { fontSize: 18, fontWeight: '900', color: colors.text, marginBottom: 16 },
  input: { backgroundColor: colors.background, borderRadius: radii.input, padding: 12, color: colors.text, marginBottom: 10 },
  row: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.background },
  chipOn: { backgroundColor: colors.primary },
  chipText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, textTransform: 'capitalize' },
  cta: { backgroundColor: colors.primary, borderRadius: radii.button, paddingVertical: 14, alignItems: 'center' },
  ctaText: { color: '#fff', fontWeight: '800' },
});
