import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Modal,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, Plus, Pencil, Users } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { adminApi, type AdminUser } from '../../src/api/admin';
import { entrepotsApi, type Entrepot } from '../../src/api/entrepots';
import { formatErr } from '../../src/api/client';
import { useAuthStore } from '../../src/store/authStore';
import { darkColors as colors, radii, spacing } from '../../src/constants/theme';

const blank = {
  email: '', full_name: '', phone: '', password: '', role: 'operator', assigned_entrepot_id: '',
};

export default function TeamAdminScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [items, setItems] = useState<AdminUser[]>([]);
  const [entrepots, setEntrepots] = useState<Entrepot[]>([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...blank });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (user?.role !== 'admin') return;
    try {
      const [team, wh] = await Promise.all([adminApi.team(), entrepotsApi.list()]);
      setItems(Array.isArray(team) ? team : []);
      setEntrepots(Array.isArray(wh) ? wh : []);
    } catch (e: any) {
      Toast.show({ type: 'error', text1: formatErr(e, 'Chargement équipe') });
    } finally {
      setLoading(false);
    }
  }, [user?.role]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditId(null);
    setForm({ ...blank });
    setShow(true);
  };

  const openEdit = (m: AdminUser) => {
    setEditId(m.id);
    setForm({
      email: m.email,
      full_name: m.full_name || '',
      phone: m.phone || '',
      password: '',
      role: m.role || 'operator',
      assigned_entrepot_id: m.assigned_entrepot_id || '',
    });
    setShow(true);
  };

  const save = async () => {
    if (!editId && (!form.email.trim() || !form.password || form.password.length < 6)) {
      Toast.show({ type: 'error', text1: 'Email et mot de passe (6+) requis' });
      return;
    }
    setSaving(true);
    try {
      if (editId) {
        const payload: Record<string, any> = {
          full_name: form.full_name.trim(),
          phone: form.phone.trim(),
          role: form.role,
          assigned_entrepot_id: form.assigned_entrepot_id || null,
        };
        if (form.password) payload.password = form.password;
        await adminApi.updateUser(editId, payload);
      } else {
        await adminApi.createUser({
          email: form.email.trim().toLowerCase(),
          full_name: form.full_name.trim(),
          phone: form.phone.trim(),
          password: form.password,
          role: form.role,
          assigned_entrepot_id: form.assigned_entrepot_id || undefined,
        });
      }
      setShow(false);
      setLoading(true);
      load();
      Toast.show({ type: 'success', text1: editId ? 'Membre mis à jour' : 'Membre créé' });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: formatErr(e, 'Erreur') });
    } finally {
      setSaving(false);
    }
  };

  if (user?.role !== 'admin') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Text style={styles.empty}>Accès réservé aux administrateurs</Text>
      </SafeAreaView>
    );
  }

  const whName = (id?: string) => entrepots.find((e) => (e.id || e._id) === id)?.name || '—';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><ChevronLeft size={24} color={colors.text} /></TouchableOpacity>
        <Text style={styles.title}>Équipe</Text>
        <TouchableOpacity onPress={openCreate}><Plus size={22} color={colors.primary} /></TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: spacing.lg }}
          ListEmptyComponent={<Text style={styles.empty}>Aucun membre</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Users size={20} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{item.full_name || item.email}</Text>
                <Text style={styles.meta}>{item.email} · {item.role}</Text>
                <Text style={styles.meta}>Entrepôt : {whName(item.assigned_entrepot_id)}</Text>
              </View>
              <TouchableOpacity onPress={() => openEdit(item)}><Pencil size={16} color={colors.primary} /></TouchableOpacity>
            </View>
          )}
        />
      )}

      <Modal visible={show} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{editId ? 'Modifier' : 'Nouveau membre'}</Text>
            {!editId && (
              <TextInput style={styles.input} placeholder="Email" placeholderTextColor={colors.textSecondary} autoCapitalize="none" value={form.email} onChangeText={(v) => setForm({ ...form, email: v })} />
            )}
            <TextInput style={styles.input} placeholder="Nom complet" placeholderTextColor={colors.textSecondary} value={form.full_name} onChangeText={(v) => setForm({ ...form, full_name: v })} />
            <TextInput style={styles.input} placeholder="Téléphone" placeholderTextColor={colors.textSecondary} value={form.phone} onChangeText={(v) => setForm({ ...form, phone: v })} />
            <TextInput style={styles.input} placeholder={editId ? 'Nouveau mot de passe (optionnel)' : 'Mot de passe'} placeholderTextColor={colors.textSecondary} secureTextEntry value={form.password} onChangeText={(v) => setForm({ ...form, password: v })} />
            <View style={styles.row}>
              {(['operator', 'admin'] as const).map((r) => (
                <TouchableOpacity key={r} style={[styles.chip, form.role === r && styles.chipOn]} onPress={() => setForm({ ...form, role: r })}>
                  <Text style={[styles.chipText, form.role === r && { color: '#fff' }]}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.meta}>Entrepôt assigné</Text>
            <View style={styles.row}>
              <TouchableOpacity style={[styles.chip, !form.assigned_entrepot_id && styles.chipOn]} onPress={() => setForm({ ...form, assigned_entrepot_id: '' })}>
                <Text style={[styles.chipText, !form.assigned_entrepot_id && { color: '#fff' }]}>Aucun</Text>
              </TouchableOpacity>
              {entrepots.map((e) => {
                const id = e.id || e._id || '';
                return (
                  <TouchableOpacity key={id} style={[styles.chip, form.assigned_entrepot_id === id && styles.chipOn]} onPress={() => setForm({ ...form, assigned_entrepot_id: id })}>
                    <Text style={[styles.chipText, form.assigned_entrepot_id === id && { color: '#fff' }]}>{e.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
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
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderRadius: 14, padding: 14, marginBottom: 10 },
  cardTitle: { fontWeight: '800', color: colors.text },
  meta: { marginTop: 4, fontSize: 12, color: colors.textSecondary },
  empty: { textAlign: 'center', color: colors.textSecondary, marginTop: 40 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40 },
  modalTitle: { fontSize: 18, fontWeight: '900', color: colors.text, marginBottom: 16 },
  input: { backgroundColor: colors.background, borderRadius: radii.input, padding: 12, color: colors.text, marginBottom: 10 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 8 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.background },
  chipOn: { backgroundColor: colors.primary },
  chipText: { fontSize: 11, fontWeight: '700', color: colors.textSecondary, textTransform: 'capitalize' },
  cta: { backgroundColor: colors.primary, borderRadius: radii.button, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  ctaText: { color: '#fff', fontWeight: '800' },
  cancel: { color: colors.textSecondary, textAlign: 'center', fontWeight: '700', marginTop: 12 },
});
