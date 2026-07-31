import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Modal, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, Plus, Pencil, Trash2, Building2 } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { entrepotsApi, type Entrepot } from '../../src/api/entrepots';
import { formatErr } from '../../src/api/client';
import { useAuthStore } from '../../src/store/authStore';
import { darkColors as colors, radii, spacing } from '../../src/constants/theme';

const blank = { name: '', city: '', country: 'Chine', type: 'origin' as 'origin' | 'destination', address: '', contact: '' };

export default function WarehousesAdminScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [items, setItems] = useState<Entrepot[]>([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...blank });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await entrepotsApi.list();
      setItems(Array.isArray(data) ? data : []);
    } catch (e: any) {
      Toast.show({ type: 'error', text1: formatErr(e, 'Entrepôts') });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditId(null);
    setForm({ ...blank });
    setShow(true);
  };

  const openEdit = (e: Entrepot) => {
    setEditId(e.id || e._id || null);
    setForm({
      name: e.name,
      city: e.city,
      country: e.country,
      type: e.type,
      address: e.address || '',
      contact: e.contact || '',
    });
    setShow(true);
  };

  const save = async () => {
    if (!form.name.trim() || !form.city.trim()) {
      Toast.show({ type: 'error', text1: 'Nom et ville requis' });
      return;
    }
    setSaving(true);
    try {
      if (editId) {
        await entrepotsApi.update(editId, {
          name: form.name.trim(),
          address: form.address.trim(),
          contact: form.contact.trim(),
        });
      } else {
        await entrepotsApi.create({
          name: form.name.trim(),
          city: form.city.trim(),
          country: form.country.trim() || 'Chine',
          type: form.type,
          address: form.address.trim() || undefined,
          contact: form.contact.trim() || undefined,
        });
      }
      setShow(false);
      setLoading(true);
      load();
      Toast.show({ type: 'success', text1: 'Entrepôt enregistré' });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: formatErr(e, 'Erreur') });
    } finally {
      setSaving(false);
    }
  };

  const remove = (e: Entrepot) => {
    const id = e.id || e._id;
    if (!id) return;
    Alert.alert('Supprimer', `Supprimer « ${e.name} » ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive',
        onPress: async () => {
          try {
            await entrepotsApi.remove(id);
            load();
          } catch (err: any) {
            Toast.show({ type: 'error', text1: formatErr(err, 'Erreur') });
          }
        },
      },
    ]);
  };

  if (user?.role !== 'admin') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Text style={styles.empty}>Accès réservé aux administrateurs</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><ChevronLeft size={24} color={colors.text} /></TouchableOpacity>
        <Text style={styles.title}>Entrepôts</Text>
        <TouchableOpacity onPress={openCreate}><Plus size={22} color={colors.primary} /></TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id || i._id!}
          contentContainerStyle={{ padding: spacing.lg }}
          ListEmptyComponent={<Text style={styles.empty}>Aucun entrepôt</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Building2 size={20} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                <Text style={styles.meta}>{item.city}, {item.country} · {item.type === 'origin' ? 'Origine' : 'Destination'}</Text>
                {!!item.address && <Text style={styles.meta}>{item.address}</Text>}
              </View>
              <TouchableOpacity onPress={() => openEdit(item)} style={styles.iconBtn}><Pencil size={16} color={colors.primary} /></TouchableOpacity>
              <TouchableOpacity onPress={() => remove(item)} style={styles.iconBtn}><Trash2 size={16} color={colors.danger} /></TouchableOpacity>
            </View>
          )}
        />
      )}

      <Modal visible={show} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{editId ? 'Modifier entrepôt' : 'Nouvel entrepôt'}</Text>
            <TextInput style={styles.input} placeholder="Nom" placeholderTextColor={colors.textSecondary} value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} />
            {!editId && (
              <>
                <TextInput style={styles.input} placeholder="Ville" placeholderTextColor={colors.textSecondary} value={form.city} onChangeText={(v) => setForm({ ...form, city: v })} />
                <TextInput style={styles.input} placeholder="Pays" placeholderTextColor={colors.textSecondary} value={form.country} onChangeText={(v) => setForm({ ...form, country: v })} />
                <View style={styles.row}>
                  {(['origin', 'destination'] as const).map((t) => (
                    <TouchableOpacity key={t} style={[styles.chip, form.type === t && styles.chipOn]} onPress={() => setForm({ ...form, type: t })}>
                      <Text style={[styles.chipText, form.type === t && { color: '#fff' }]}>{t === 'origin' ? 'Origine' : 'Destination'}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
            <TextInput style={styles.input} placeholder="Adresse" placeholderTextColor={colors.textSecondary} value={form.address} onChangeText={(v) => setForm({ ...form, address: v })} />
            <TextInput style={styles.input} placeholder="Contact" placeholderTextColor={colors.textSecondary} value={form.contact} onChangeText={(v) => setForm({ ...form, contact: v })} />
            <TouchableOpacity style={styles.cta} onPress={save} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>Enregistrer</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShow(false)}><Text style={styles.cancel}>Annuler</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg },
  title: { fontSize: 18, fontWeight: '800', color: colors.text },
  card: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.card, borderRadius: 14, padding: 14, marginBottom: 10 },
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
  chipText: { fontSize: 11, fontWeight: '700', color: colors.textSecondary },
  cta: { backgroundColor: colors.primary, borderRadius: radii.button, paddingVertical: 14, alignItems: 'center' },
  ctaText: { color: '#fff', fontWeight: '800' },
  cancel: { color: colors.textSecondary, textAlign: 'center', fontWeight: '700', marginTop: 12 },
});
