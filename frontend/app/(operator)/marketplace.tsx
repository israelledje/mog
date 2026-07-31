import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Modal,
  ActivityIndicator, Alert, ScrollView, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import {
  ChevronLeft, Plus, Archive, Pencil, ImagePlus, Minus, Tags, X, Save,
} from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { marketplaceApi, type MarketplaceProduct } from '../../src/api/marketplace';
import { growthApi } from '../../src/api/growth';
import { formatErr } from '../../src/api/client';
import { useAuthStore } from '../../src/store/authStore';
import { resolveMediaUrl } from '../../src/utils/mediaUrl';
import { darkColors as colors, radii, spacing } from '../../src/constants/theme';

type VariantForm = { id?: string; name: string; sku: string; price_xaf: string; stock: string };
type Cat = { id: string; label: string };

type FormState = {
  title: string;
  description: string;
  category: string;
  price_xaf: string;
  stock: string;
  transport_mode: string;
  origin_city: string;
  status: string;
  images: string[];
  variants: VariantForm[];
  length_cm: string;
  width_cm: string;
  height_cm: string;
  cbm: string;
};

const DEFAULT_CATS: Cat[] = [
  { id: 'vehicle', label: 'Véhicule' },
  { id: 'electronics', label: 'Électronique' },
  { id: 'fashion', label: 'Mode' },
  { id: 'other', label: 'Autre' },
];

const blankForm = (): FormState => ({
  title: '',
  description: '',
  category: 'vehicle',
  price_xaf: '',
  stock: '1',
  transport_mode: 'sea',
  origin_city: 'Guangzhou',
  status: 'published',
  images: [],
  variants: [],
  length_cm: '',
  width_cm: '',
  height_cm: '',
  cbm: '',
});

const slugify = (label: string) =>
  label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '') || `cat_${Date.now()}`;

export default function OperatorMarketplaceScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';

  const [items, setItems] = useState<MarketplaceProduct[]>([]);
  const [categories, setCategories] = useState<Cat[]>(DEFAULT_CATS);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [catModal, setCatModal] = useState(false);
  const [form, setForm] = useState<FormState>(blankForm());
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [newCatLabel, setNewCatLabel] = useState('');
  const [editCat, setEditCat] = useState<Cat | null>(null);

  const load = useCallback(async () => {
    try {
      const [data, settings] = await Promise.all([
        marketplaceApi.listProducts(),
        growthApi.getSettings().catch(() => null),
      ]);
      setItems(Array.isArray(data) ? data : []);
      const fromSettings = Array.isArray(settings?.marketplace_categories)
        ? settings.marketplace_categories.filter((c: any) => c?.id && c?.label)
        : [];
      const fromProducts = Array.from(
        new Set((Array.isArray(data) ? data : []).map((p) => p.category).filter(Boolean) as string[]),
      )
        .filter((id) => !fromSettings.some((c: Cat) => c.id === id) && !DEFAULT_CATS.some((c) => c.id === id))
        .map((id) => ({ id, label: id }));
      setCategories(fromSettings.length ? [...fromSettings, ...fromProducts] : [...DEFAULT_CATS, ...fromProducts]);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const catLabel = useMemo(() => {
    const map: Record<string, string> = {};
    categories.forEach((c) => { map[c.id] = c.label; });
    return map;
  }, [categories]);

  const persistCategories = async (next: Cat[]) => {
    setCategories(next);
    if (!isAdmin) return;
    try {
      await growthApi.updateSettings({ marketplace_categories: next });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: formatErr(e, 'Catégories non sauvegardées') });
    }
  };

  const openCreate = () => {
    setEditId(null);
    setForm(blankForm());
    setShow(true);
  };

  const openEdit = (it: MarketplaceProduct) => {
    setEditId(it.id);
    setForm({
      title: it.title || '',
      description: it.description || '',
      category: it.category || 'other',
      price_xaf: String(it.price_xaf ?? ''),
      stock: String(it.stock ?? 0),
      transport_mode: it.transport_mode || 'sea',
      origin_city: it.origin_city || 'Guangzhou',
      status: it.status || 'published',
      images: Array.isArray(it.images) ? [...it.images] : [],
      length_cm: it.length_cm != null ? String(it.length_cm) : '',
      width_cm: it.width_cm != null ? String(it.width_cm) : '',
      height_cm: it.height_cm != null ? String(it.height_cm) : '',
      cbm: it.cbm != null ? String(it.cbm) : '',
      variants: (it.variants || []).map((v) => ({
        id: v.id,
        name: v.name || '',
        sku: v.sku || '',
        price_xaf: v.price_xaf != null ? String(v.price_xaf) : '',
        stock: String(v.stock ?? 0),
      })),
    });
    setShow(true);
  };

  const pickImages = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Toast.show({ type: 'error', text1: 'Permission photos refusée' });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 5,
    });
    if (result.canceled || !result.assets?.length) return;
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const asset of result.assets) {
        const up = await marketplaceApi.uploadImage(asset.uri);
        if (up?.url) urls.push(up.url);
      }
      setForm((f) => ({ ...f, images: [...f.images, ...urls] }));
    } catch (e: any) {
      Toast.show({ type: 'error', text1: formatErr(e, 'Upload échoué') });
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!form.title.trim() || !form.price_xaf) {
      Toast.show({ type: 'error', text1: 'Titre et prix requis' });
      return;
    }
    const variants = form.variants
      .filter((v) => v.name.trim())
      .map((v) => ({
        ...(v.id ? { id: v.id } : {}),
        name: v.name.trim(),
        sku: v.sku.trim() || undefined,
        price_xaf: v.price_xaf ? Number(v.price_xaf) : null,
        stock: Number(v.stock || 0),
        attributes: {},
      }));
    const payload: Partial<MarketplaceProduct> & { title: string; price_xaf: number } = {
      title: form.title.trim(),
      description: form.description,
      category: form.category,
      price_xaf: Number(form.price_xaf),
      stock: variants.length ? variants.reduce((s, v) => s + Number(v.stock || 0), 0) : Number(form.stock || 0),
      transport_mode: form.transport_mode,
      origin_city: form.origin_city,
      status: form.status,
      images: form.images,
      variants: variants as MarketplaceProduct['variants'],
      length_cm: form.length_cm ? Number(form.length_cm) : null,
      width_cm: form.width_cm ? Number(form.width_cm) : null,
      height_cm: form.height_cm ? Number(form.height_cm) : null,
      cbm: form.cbm ? Number(form.cbm) : null,
    };
    setSaving(true);
    try {
      if (editId) await marketplaceApi.updateProduct(editId, payload);
      else await marketplaceApi.createProduct(payload);
      setShow(false);
      setForm(blankForm());
      setEditId(null);
      setLoading(true);
      await load();
      Toast.show({ type: 'success', text1: editId ? 'Article mis à jour' : 'Article publié' });
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

  const adjustStock = async (id: string, delta: number) => {
    try {
      await marketplaceApi.adjustStock(id, { delta });
      load();
    } catch (e: any) {
      Toast.show({ type: 'error', text1: formatErr(e, 'Stock') });
    }
  };

  const addCategory = async () => {
    const label = newCatLabel.trim();
    if (!label) return;
    const id = slugify(label);
    if (categories.some((c) => c.id === id || c.label.toLowerCase() === label.toLowerCase())) {
      Toast.show({ type: 'error', text1: 'Catégorie déjà existante' });
      return;
    }
    await persistCategories([...categories, { id, label }]);
    setNewCatLabel('');
    Toast.show({ type: 'success', text1: 'Catégorie créée' });
  };

  const saveEditCategory = async () => {
    if (!editCat?.label.trim()) return;
    const next = categories.map((c) => (c.id === editCat.id ? { ...c, label: editCat.label.trim() } : c));
    await persistCategories(next);
    setEditCat(null);
    Toast.show({ type: 'success', text1: 'Catégorie mise à jour' });
  };

  const deleteCategory = (cat: Cat) => {
    const used = items.some((i) => i.category === cat.id);
    if (used) {
      Alert.alert('Impossible', 'Des articles utilisent encore cette catégorie. Réassignez-les d’abord.');
      return;
    }
    Alert.alert('Supprimer', `Supprimer « ${cat.label} » ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive',
        onPress: () => persistCategories(categories.filter((c) => c.id !== cat.id)),
      },
    ]);
  };

  const autoCbm = () => {
    const l = Number(form.length_cm);
    const w = Number(form.width_cm);
    const h = Number(form.height_cm);
    if (l > 0 && w > 0 && h > 0) {
      setForm((f) => ({ ...f, cbm: ((l * w * h) / 1_000_000).toFixed(4) }));
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><ChevronLeft size={24} color={colors.text} /></TouchableOpacity>
        <Text style={styles.title}>{isAdmin ? 'M.O.G MARKET' : 'Marketplace'}</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {isAdmin && (
            <TouchableOpacity onPress={() => setCatModal(true)} style={styles.iconBtn}>
              <Tags size={20} color={colors.secondary} />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={openCreate} style={styles.iconBtn}>
            <Plus size={22} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
          ListEmptyComponent={<Text style={styles.empty}>Aucun article</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              {item.images?.[0] ? (
                <Image source={{ uri: resolveMediaUrl(item.images[0]) }} style={styles.thumb} />
              ) : (
                <View style={[styles.thumb, styles.thumbEmpty]} />
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.meta}>
                  {Number(item.price_xaf).toLocaleString()} XAF · Stock {item.stock ?? 0}
                </Text>
                <Text style={styles.meta}>
                  {catLabel[item.category || ''] || item.category || '—'} · {item.status}
                </Text>
                <View style={styles.stockRow}>
                  <TouchableOpacity style={styles.stockBtn} onPress={() => adjustStock(item.id, -1)}>
                    <Minus size={14} color={colors.text} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.stockBtn} onPress={() => adjustStock(item.id, 1)}>
                    <Plus size={14} color={colors.text} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.stockBtn} onPress={() => openEdit(item)}>
                    <Pencil size={14} color={colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.stockBtn} onPress={() => archive(item.id)}>
                    <Archive size={14} color={colors.danger} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        />
      )}

      {/* Product create / edit */}
      <Modal visible={show} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalBox} keyboardShouldPersistTaps="handled">
            <Text style={styles.modalTitle}>{editId ? 'Modifier l’article' : 'Nouvel article'}</Text>

            {(['title', 'description', 'price_xaf', 'stock', 'origin_city'] as const).map((k) => (
              <TextInput
                key={k}
                style={styles.input}
                placeholder={
                  k === 'title' ? 'Titre' :
                  k === 'description' ? 'Description' :
                  k === 'price_xaf' ? 'Prix XAF' :
                  k === 'stock' ? 'Stock' : 'Ville d’origine'
                }
                placeholderTextColor={colors.textSecondary}
                keyboardType={k === 'price_xaf' || k === 'stock' ? 'numeric' : 'default'}
                value={(form as any)[k]}
                onChangeText={(v) => setForm({ ...form, [k]: v })}
                multiline={k === 'description'}
              />
            ))}

            <Text style={styles.fieldLabel}>Catégorie</Text>
            <View style={styles.row}>
              {categories.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.chip, form.category === c.id && styles.chipOn]}
                  onPress={() => setForm({ ...form, category: c.id })}
                >
                  <Text style={[styles.chipText, form.category === c.id && { color: '#fff' }]}>{c.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Transport</Text>
            <View style={styles.row}>
              {(['sea', 'air'] as const).map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.chip, form.transport_mode === m && styles.chipOn]}
                  onPress={() => setForm({ ...form, transport_mode: m })}
                >
                  <Text style={[styles.chipText, form.transport_mode === m && { color: '#fff' }]}>
                    {m === 'sea' ? 'Maritime' : 'Aérien'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Statut</Text>
            <View style={styles.row}>
              {(['published', 'draft'] as const).map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.chip, form.status === s && styles.chipOn]}
                  onPress={() => setForm({ ...form, status: s })}
                >
                  <Text style={[styles.chipText, form.status === s && { color: '#fff' }]}>
                    {s === 'published' ? 'Publié' : 'Brouillon'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Dimensions (cm) & CBM</Text>
            <View style={styles.dimsRow}>
              {(['length_cm', 'width_cm', 'height_cm', 'cbm'] as const).map((k) => (
                <TextInput
                  key={k}
                  style={[styles.input, styles.dimInput]}
                  placeholder={k === 'cbm' ? 'CBM' : k.replace('_cm', '').toUpperCase()}
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="decimal-pad"
                  value={form[k]}
                  onChangeText={(v) => setForm({ ...form, [k]: v })}
                  onBlur={k !== 'cbm' ? autoCbm : undefined}
                />
              ))}
            </View>

            <Text style={styles.fieldLabel}>Images</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              {form.images.map((uri) => (
                <View key={uri} style={styles.imgWrap}>
                  <Image source={{ uri: resolveMediaUrl(uri) }} style={styles.img} />
                  <TouchableOpacity
                    style={styles.imgRemove}
                    onPress={() => setForm((f) => ({ ...f, images: f.images.filter((x) => x !== uri) }))}
                  >
                    <X size={12} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity style={styles.addImg} onPress={pickImages} disabled={uploading}>
                {uploading ? <ActivityIndicator color={colors.primary} /> : <ImagePlus size={22} color={colors.primary} />}
              </TouchableOpacity>
            </ScrollView>

            <View style={styles.variantHeader}>
              <Text style={styles.fieldLabel}>Variantes</Text>
              <TouchableOpacity
                onPress={() => setForm((f) => ({
                  ...f,
                  variants: [...f.variants, { name: '', sku: '', price_xaf: '', stock: '0' }],
                }))}
              >
                <Text style={{ color: colors.primary, fontWeight: '800' }}>+ Variante</Text>
              </TouchableOpacity>
            </View>
            {form.variants.map((v, idx) => (
              <View key={idx} style={styles.variantBox}>
                <View style={styles.variantTop}>
                  <Text style={styles.meta}>Variante {idx + 1}</Text>
                  <TouchableOpacity
                    onPress={() => setForm((f) => ({ ...f, variants: f.variants.filter((_, i) => i !== idx) }))}
                  >
                    <X size={16} color={colors.danger} />
                  </TouchableOpacity>
                </View>
                {(['name', 'sku', 'price_xaf', 'stock'] as const).map((k) => (
                  <TextInput
                    key={k}
                    style={styles.input}
                    placeholder={k === 'name' ? 'Nom' : k === 'sku' ? 'SKU' : k === 'price_xaf' ? 'Prix' : 'Stock'}
                    placeholderTextColor={colors.textSecondary}
                    keyboardType={k === 'price_xaf' || k === 'stock' ? 'numeric' : 'default'}
                    value={v[k]}
                    onChangeText={(val) => {
                      const variants = [...form.variants];
                      variants[idx] = { ...v, [k]: val };
                      setForm({ ...form, variants });
                    }}
                  />
                ))}
              </View>
            ))}

            <TouchableOpacity style={styles.cta} onPress={save} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Save size={18} color="#fff" />
                  <Text style={styles.ctaText}>{editId ? 'Enregistrer' : 'Publier'}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setShow(false); setEditId(null); }} style={{ marginTop: 12 }}>
              <Text style={{ color: colors.textSecondary, textAlign: 'center', fontWeight: '700' }}>Annuler</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Categories management */}
      <Modal visible={catModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { maxHeight: '80%' }]}>
            <Text style={styles.modalTitle}>Catégories Market</Text>
            <View style={styles.catAddRow}>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                placeholder="Nouvelle catégorie"
                placeholderTextColor={colors.textSecondary}
                value={newCatLabel}
                onChangeText={setNewCatLabel}
              />
              <TouchableOpacity style={styles.catAddBtn} onPress={addCategory}>
                <Plus size={18} color="#fff" />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {categories.map((c) => (
                <View key={c.id} style={styles.catRow}>
                  {editCat?.id === c.id ? (
                    <TextInput
                      style={[styles.input, { flex: 1, marginBottom: 0 }]}
                      value={editCat.label}
                      onChangeText={(v) => setEditCat({ ...editCat, label: v })}
                      autoFocus
                    />
                  ) : (
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>{c.label}</Text>
                      <Text style={styles.meta}>{c.id}</Text>
                    </View>
                  )}
                  {editCat?.id === c.id ? (
                    <TouchableOpacity onPress={saveEditCategory} style={styles.stockBtn}>
                      <Save size={16} color={colors.success} />
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity onPress={() => setEditCat(c)} style={styles.stockBtn}>
                      <Pencil size={16} color={colors.primary} />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={() => deleteCategory(c)} style={styles.stockBtn}>
                    <Archive size={16} color={colors.danger} />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity onPress={() => { setCatModal(false); setEditCat(null); }} style={{ marginTop: 12 }}>
              <Text style={{ color: colors.textSecondary, textAlign: 'center', fontWeight: '700' }}>Fermer</Text>
            </TouchableOpacity>
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
  iconBtn: { padding: 8, backgroundColor: colors.card, borderRadius: 10 },
  card: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: colors.card, borderRadius: 14, padding: 14, marginBottom: 10,
  },
  thumb: { width: 64, height: 64, borderRadius: 10, backgroundColor: colors.background },
  thumbEmpty: { borderWidth: 1, borderColor: colors.border },
  cardTitle: { fontWeight: '800', color: colors.text },
  meta: { marginTop: 4, fontSize: 12, color: colors.textSecondary },
  stockRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  stockBtn: { padding: 8, backgroundColor: colors.background, borderRadius: 8 },
  empty: { textAlign: 'center', color: colors.textSecondary, marginTop: 40 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalBox: {
    backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 40,
  },
  modalTitle: { fontSize: 18, fontWeight: '900', color: colors.text, marginBottom: 16 },
  fieldLabel: { fontSize: 12, fontWeight: '800', color: colors.textSecondary, marginBottom: 8, textTransform: 'uppercase' },
  input: { backgroundColor: colors.background, borderRadius: radii.input, padding: 12, color: colors.text, marginBottom: 10 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.background },
  chipOn: { backgroundColor: colors.primary },
  chipText: { fontSize: 11, fontWeight: '700', color: colors.textSecondary },
  dimsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  dimInput: { width: '47%', marginBottom: 8 },
  imgWrap: { marginRight: 10, position: 'relative' },
  img: { width: 72, height: 72, borderRadius: 10 },
  imgRemove: {
    position: 'absolute', top: -4, right: -4, backgroundColor: colors.danger,
    borderRadius: 10, padding: 4,
  },
  addImg: {
    width: 72, height: 72, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed',
    borderColor: colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  variantHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  variantBox: { backgroundColor: colors.background, borderRadius: 12, padding: 12, marginBottom: 10 },
  variantTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  cta: { backgroundColor: colors.primary, borderRadius: radii.button, paddingVertical: 14, alignItems: 'center' },
  ctaText: { color: '#fff', fontWeight: '800' },
  catAddRow: { flexDirection: 'row', gap: 8, marginBottom: 12, alignItems: 'center' },
  catAddBtn: { backgroundColor: colors.primary, borderRadius: 10, padding: 12 },
  catRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
});
