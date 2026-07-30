import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Modal,
  ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, Plus, Archive } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { marketplaceApi, type MarketplaceProduct } from '../../src/api/marketplace';
import { formatErr } from '../../src/api/client';
import { darkColors as colors, radii, spacing } from '../../src/constants/theme';

const BLANK = {
  title: '', description: '', category: 'vehicle', price_xaf: '', stock: '1',
  transport_mode: 'sea', status: 'published',
};

export default function OperatorMarketplaceScreen() {
  const router = useRouter();
  const [items, setItems] = useState<MarketplaceProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ ...BLANK });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await marketplaceApi.listProducts();
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!form.title.trim() || !form.price_xaf) {
      Toast.show({ type: 'error', text1: 'Titre et prix requis' });
      return;
    }
    setSaving(true);
    try {
      await marketplaceApi.createProduct({
        title: form.title.trim(),
        description: form.description,
        category: form.category,
        price_xaf: Number(form.price_xaf),
        stock: Number(form.stock || 1),
        transport_mode: form.transport_mode,
        status: form.status,
      });
      setShow(false);
      setForm({ ...BLANK });
      setLoading(true);
      load();
      Toast.show({ type: 'success', text1: 'Article publié' });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: formatErr(e, 'Erreur') });
    } finally {
      setSaving(false);
    }
  };

  const archive = (id: string) => {
    Alert.alert('Archiver', 'Retirer cet article de la marketplace ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Archiver', style: 'destructive',
        onPress: async () => {
          try {
            await marketplaceApi.archiveProduct(id);
            load();
          } catch (e: any) {
            Toast.show({ type: 'error', text1: formatErr(e, 'Erreur') });
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><ChevronLeft size={24} color={colors.text} /></TouchableOpacity>
        <Text style={styles.title}>Marketplace</Text>
        <TouchableOpacity onPress={() => setShow(true)}><Plus size={22} color={colors.primary} /></TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: spacing.lg }}
          ListEmptyComponent={<Text style={styles.empty}>Aucun article</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.meta}>
                  {Number(item.price_xaf).toLocaleString()} XAF · Stock {item.stock ?? 0} · {item.status}
                </Text>
              </View>
              <TouchableOpacity onPress={() => archive(item.id)} style={styles.iconBtn}>
                <Archive size={18} color={colors.danger} />
              </TouchableOpacity>
            </View>
          )}
        />
      )}

      <Modal visible={show} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalBox}>
            <Text style={styles.modalTitle}>Nouvel article</Text>
            {([
              ['title', 'Titre'],
              ['description', 'Description'],
              ['price_xaf', 'Prix XAF'],
              ['stock', 'Stock'],
            ] as const).map(([k, ph]) => (
              <TextInput
                key={k}
                style={styles.input}
                placeholder={ph}
                placeholderTextColor={colors.textSecondary}
                keyboardType={k === 'price_xaf' || k === 'stock' ? 'numeric' : 'default'}
                value={(form as any)[k]}
                onChangeText={(v) => setForm({ ...form, [k]: v })}
              />
            ))}
            <View style={styles.row}>
              {(['vehicle', 'electronics', 'fashion', 'other'] as const).map((c) => (
                <TouchableOpacity key={c} style={[styles.chip, form.category === c && styles.chipOn]} onPress={() => setForm({ ...form, category: c })}>
                  <Text style={[styles.chipText, form.category === c && { color: '#fff' }]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.cta} onPress={save} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>Publier</Text>}
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
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 14, padding: 14, marginBottom: 10 },
  cardTitle: { fontWeight: '800', color: colors.text },
  meta: { marginTop: 4, fontSize: 12, color: colors.textSecondary },
  iconBtn: { padding: 8 },
  empty: { textAlign: 'center', color: colors.textSecondary, marginTop: 40 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40 },
  modalTitle: { fontSize: 18, fontWeight: '900', color: colors.text, marginBottom: 16 },
  input: { backgroundColor: colors.background, borderRadius: radii.input, padding: 12, color: colors.text, marginBottom: 10 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.background },
  chipOn: { backgroundColor: colors.primary },
  chipText: { fontSize: 11, fontWeight: '700', color: colors.textSecondary, textTransform: 'capitalize' },
  cta: { backgroundColor: colors.primary, borderRadius: radii.button, paddingVertical: 14, alignItems: 'center' },
  ctaText: { color: '#fff', fontWeight: '800' },
});
