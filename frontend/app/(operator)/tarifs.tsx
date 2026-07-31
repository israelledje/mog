import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Modal, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, Plus, Pencil, Plane, Ship } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { tarifsApi, type Tarif } from '../../src/api/tarifs';
import { formatErr } from '../../src/api/client';
import { useAuthStore } from '../../src/store/authStore';
import { darkColors as colors, radii, spacing } from '../../src/constants/theme';

type ModeTab = 'air' | 'sea';

const blankFor = (mode: ModeTab) => ({
  mode,
  label: '',
  description: '',
  unit: mode === 'air' ? 'kg' : 'cbm',
  price: '',
  category_key: 'standard',
  eta_days: '',
});

export default function TarifsAdminScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [items, setItems] = useState<Tarif[]>([]);
  const [tab, setTab] = useState<ModeTab>('air');
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(blankFor('air'));
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await tarifsApi.list();
      setItems(Array.isArray(data) ? data : []);
    } catch (e: any) {
      Toast.show({ type: 'error', text1: formatErr(e, 'Tarifs') });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(
    () => items.filter((t) => t.mode === tab),
    [items, tab],
  );

  const openCreate = () => {
    setEditId(null);
    setForm(blankFor(tab));
    setShow(true);
  };

  const openEdit = (t: Tarif) => {
    setEditId(t.id);
    setForm({
      mode: t.mode as ModeTab,
      label: t.label,
      description: t.description || '',
      unit: t.unit,
      price: String(t.price ?? ''),
      category_key: t.category_key,
      eta_days: (t as any).eta_days || '',
    });
    setShow(true);
  };

  const setMode = (mode: ModeTab) => {
    if (editId) return; // mode figé à l’édition (API PATCH sans mode)
    setForm({
      ...form,
      mode,
      unit: mode === 'air' ? (form.unit === 'cbm' || form.unit === 'tonne' ? 'kg' : form.unit || 'kg') : (form.unit === 'kg' ? 'cbm' : form.unit || 'cbm'),
    });
  };

  const save = async () => {
    if (!form.label.trim() || !form.price) {
      Toast.show({ type: 'error', text1: 'Libellé et prix requis' });
      return;
    }
    if (!form.mode) {
      Toast.show({ type: 'error', text1: 'Choisissez Aérien ou Maritime' });
      return;
    }
    setSaving(true);
    try {
      if (editId) {
        await tarifsApi.update(editId, {
          label: form.label.trim(),
          description: form.description,
          price: Number(form.price),
          eta_days: form.eta_days || undefined,
        });
      } else {
        await tarifsApi.create({
          mode: form.mode,
          label: form.label.trim(),
          description: form.description,
          unit: form.unit,
          price: Number(form.price),
          category_key: form.category_key || 'custom',
          eta_days: form.eta_days || undefined,
        });
      }
      setShow(false);
      setTab(form.mode as ModeTab);
      setLoading(true);
      load();
      Toast.show({ type: 'success', text1: 'Tarif enregistré' });
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

  const isAir = form.mode === 'air';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><ChevronLeft size={24} color={colors.text} /></TouchableOpacity>
        <Text style={styles.title}>Grille tarifaire</Text>
        <TouchableOpacity onPress={openCreate}><Plus size={22} color={colors.primary} /></TouchableOpacity>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'air' && styles.tabAirOn]}
          onPress={() => setTab('air')}
          activeOpacity={0.85}
        >
          <Plane size={18} color={tab === 'air' ? '#fff' : colors.textSecondary} />
          <Text style={[styles.tabText, tab === 'air' && styles.tabTextOn]}>Aérien</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'sea' && styles.tabSeaOn]}
          onPress={() => setTab('sea')}
          activeOpacity={0.85}
        >
          <Ship size={18} color={tab === 'sea' ? '#fff' : colors.textSecondary} />
          <Text style={[styles.tabText, tab === 'sea' && styles.tabTextOn]}>Maritime</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.hint}>
        {tab === 'air'
          ? 'Tarifs aériens — facturation au kg (ou à l’unité).'
          : 'Tarifs maritimes — facturation au CBM / tonne.'}
      </Text>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: spacing.lg, paddingTop: 8 }}
          ListEmptyComponent={
            <Text style={styles.empty}>
              Aucun tarif {tab === 'air' ? 'aérien' : 'maritime'}
            </Text>
          }
          renderItem={({ item }) => {
            const air = item.mode === 'air';
            const ModeIcon = air ? Plane : Ship;
            return (
              <View style={styles.card}>
                <View style={[styles.modeBadge, air ? styles.badgeAir : styles.badgeSea]}>
                  <ModeIcon size={18} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{item.label}</Text>
                  <Text style={styles.meta}>
                    {air ? 'Aérien' : 'Maritime'} · {Number(item.price).toLocaleString()} XAF / {item.unit}
                  </Text>
                  <Text style={styles.meta} numberOfLines={2}>{item.description}</Text>
                </View>
                <TouchableOpacity onPress={() => openEdit(item)} style={styles.editBtn}>
                  <Pencil size={16} color={colors.primary} />
                </TouchableOpacity>
              </View>
            );
          }}
        />
      )}

      <Modal visible={show} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{editId ? 'Modifier tarif' : 'Nouveau tarif'}</Text>

            <Text style={styles.fieldLabel}>Type de transport (obligatoire)</Text>
            <View style={styles.modeRow}>
              <TouchableOpacity
                style={[styles.modeCard, isAir && styles.modeCardAir, editId && !isAir && styles.modeDisabled]}
                onPress={() => setMode('air')}
                disabled={!!editId}
                activeOpacity={editId ? 1 : 0.85}
              >
                <Plane size={28} color={isAir ? '#fff' : colors.textSecondary} />
                <Text style={[styles.modeCardTitle, isAir && { color: '#fff' }]}>Aérien</Text>
                <Text style={[styles.modeCardSub, isAir && { color: 'rgba(255,255,255,0.8)' }]}>kg / unité</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeCard, !isAir && styles.modeCardSea, editId && isAir && styles.modeDisabled]}
                onPress={() => setMode('sea')}
                disabled={!!editId}
                activeOpacity={editId ? 1 : 0.85}
              >
                <Ship size={28} color={!isAir ? '#fff' : colors.textSecondary} />
                <Text style={[styles.modeCardTitle, !isAir && { color: '#fff' }]}>Maritime</Text>
                <Text style={[styles.modeCardSub, !isAir && { color: 'rgba(255,255,255,0.8)' }]}>CBM / tonne</Text>
              </TouchableOpacity>
            </View>
            {!!editId && (
              <Text style={styles.lockHint}>Le mode ne peut pas être changé à la modification.</Text>
            )}

            <TextInput style={styles.input} placeholder="Libellé" placeholderTextColor={colors.textSecondary} value={form.label} onChangeText={(v) => setForm({ ...form, label: v })} />
            <TextInput style={styles.input} placeholder="Description" placeholderTextColor={colors.textSecondary} value={form.description} onChangeText={(v) => setForm({ ...form, description: v })} />
            <TextInput style={styles.input} placeholder="Prix XAF" placeholderTextColor={colors.textSecondary} keyboardType="numeric" value={form.price} onChangeText={(v) => setForm({ ...form, price: v })} />
            {!editId && (
              <>
                <TextInput style={styles.input} placeholder="Unité (kg / cbm / unit)" placeholderTextColor={colors.textSecondary} value={form.unit} onChangeText={(v) => setForm({ ...form, unit: v })} />
                <TextInput style={styles.input} placeholder="Clé catégorie" placeholderTextColor={colors.textSecondary} value={form.category_key} onChangeText={(v) => setForm({ ...form, category_key: v })} />
              </>
            )}
            <TextInput style={styles.input} placeholder="Délai (ex: 7-14)" placeholderTextColor={colors.textSecondary} value={form.eta_days} onChangeText={(v) => setForm({ ...form, eta_days: v })} />
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
  tabs: {
    flexDirection: 'row', gap: 10, marginHorizontal: spacing.lg, marginBottom: 8,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.card, borderRadius: 14, paddingVertical: 12, borderWidth: 1, borderColor: colors.border,
  },
  tabAirOn: { backgroundColor: '#0EA5E9', borderColor: '#0EA5E9' },
  tabSeaOn: { backgroundColor: '#0369A1', borderColor: '#0369A1' },
  tabText: { fontWeight: '800', color: colors.textSecondary, fontSize: 14 },
  tabTextOn: { color: '#fff' },
  hint: {
    marginHorizontal: spacing.lg, marginBottom: 4, fontSize: 12, color: colors.textSecondary, fontWeight: '600',
  },
  card: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card,
    borderRadius: 14, padding: 14, marginBottom: 10, gap: 12,
  },
  modeBadge: {
    width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
  },
  badgeAir: { backgroundColor: '#0EA5E9' },
  badgeSea: { backgroundColor: '#0369A1' },
  cardTitle: { fontWeight: '800', color: colors.text },
  meta: { marginTop: 4, fontSize: 12, color: colors.textSecondary },
  editBtn: { padding: 8, backgroundColor: colors.background, borderRadius: 8 },
  empty: { textAlign: 'center', color: colors.textSecondary, marginTop: 40 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40 },
  modalTitle: { fontSize: 18, fontWeight: '900', color: colors.text, marginBottom: 12 },
  fieldLabel: {
    fontSize: 11, fontWeight: '800', color: colors.textSecondary, textTransform: 'uppercase',
    letterSpacing: 0.6, marginBottom: 8,
  },
  modeRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  modeCard: {
    flex: 1, alignItems: 'center', gap: 6, paddingVertical: 16, borderRadius: 16,
    backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border,
  },
  modeCardAir: { backgroundColor: '#0EA5E9', borderColor: '#0EA5E9' },
  modeCardSea: { backgroundColor: '#0369A1', borderColor: '#0369A1' },
  modeDisabled: { opacity: 0.35 },
  modeCardTitle: { fontWeight: '900', color: colors.text, fontSize: 14 },
  modeCardSub: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
  lockHint: { fontSize: 11, color: colors.textSecondary, marginBottom: 10, fontStyle: 'italic' },
  input: { backgroundColor: colors.background, borderRadius: radii.input, padding: 12, color: colors.text, marginBottom: 10 },
  cta: { backgroundColor: colors.primary, borderRadius: radii.button, paddingVertical: 14, alignItems: 'center' },
  ctaText: { color: '#fff', fontWeight: '800' },
  cancel: { color: colors.textSecondary, textAlign: 'center', fontWeight: '700', marginTop: 12 },
});
