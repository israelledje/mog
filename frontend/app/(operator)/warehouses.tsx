import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Modal,
  ActivityIndicator, ScrollView, Alert, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import {
  ChevronLeft, Plus, Pencil, Trash2, Building2, Package, Search, UserPlus, Ship, Plane,
  Camera, ImagePlus,
} from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { entrepotsApi, type Entrepot } from '../../src/api/entrepots';
import { colisApi } from '../../src/api/colis';
import { adminApi } from '../../src/api/admin';
import { formatErr } from '../../src/api/client';
import { useAuthStore } from '../../src/store/authStore';
import { darkColors as colors, radii, spacing } from '../../src/constants/theme';
import { CategoryChips } from '../../src/components/ui/HorizontalChips';
import {
  freightCategoriesForMode,
  defaultFreightCategoryKey,
} from '../../src/constants/freightCategories';

type Tab = 'entrepots' | 'saisie' | 'affecter';

const blankWh = {
  name: '', city: '', country: 'Chine', type: 'origin' as 'origin' | 'destination', transport_mode: 'sea' as 'sea' | 'air', address: '', contact: '',
};

export default function WarehousesAdminScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = useState<Tab>((params.tab as Tab) || 'saisie');
  const [items, setItems] = useState<Entrepot[]>([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...blankWh });
  const [saving, setSaving] = useState(false);

  // Saisie colis (client sans compte possible)
  const [clientMode, setClientMode] = useState<'search' | 'new'>('search');
  const [clientQ, setClientQ] = useState('');
  const [clientResults, setClientResults] = useState<any[]>([]);
  const [selectedClient, setSelectedClient] = useState<any | null>(null);
  const [newClient, setNewClient] = useState({ full_name: '', phone: '', city: 'Douala', email: '' });
  const [pkgForm, setPkgForm] = useState({
    description: '',
    tracking_number: '',
    supplier_tracking: '',
    transport_mode: 'sea' as 'sea' | 'air',
    category_key: 'standard',
    weight: '',
    l: '', w: '', h: '',
    entrepot_id: '',
    notes: '',
  });
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);

  // Affecter colis existant
  const [trackQ, setTrackQ] = useState('');
  const [foundPkgs, setFoundPkgs] = useState<any[]>([]);
  const [selectedPkg, setSelectedPkg] = useState<any | null>(null);
  const [assignEntrepotId, setAssignEntrepotId] = useState('');
  const [assignNotes, setAssignNotes] = useState('');
  const [unassigned, setUnassigned] = useState<any[]>([]);

  const load = useCallback(async () => {
    try {
      const data = await entrepotsApi.list();
      setItems(Array.isArray(data) ? data : []);
      setPkgForm((f) => {
        if (f.entrepot_id || !data?.[0]) return f;
        return { ...f, entrepot_id: data[0].id || data[0]._id || '' };
      });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: formatErr(e, 'Entrepôts') });
    } finally {
      setLoading(false);
    }
  }, []);

  const loadUnassigned = useCallback(async () => {
    try {
      const list = await colisApi.list({ limit: 80 });
      const withoutWh = (Array.isArray(list) ? list : []).filter(
        (p: any) => !p.current_entrepot_id && !p.warehouse_location,
      );
      setUnassigned(withoutWh.slice(0, 30));
    } catch {
      setUnassigned([]);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (tab === 'affecter') loadUnassigned();
  }, [tab, loadUnassigned]);

  const openCreate = () => {
    setEditId(null);
    setForm({ ...blankWh });
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

  const saveWh = async () => {
    if (!form.name.trim() || !form.city.trim() || (!editId && !form.address.trim())) {
      Toast.show({ type: 'error', text1: 'Nom, ville et adresse complète requis' });
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
          transport_mode: form.transport_mode,
          address: form.address.trim(),
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

  const searchClients = async (q: string) => {
    setClientQ(q);
    setSelectedClient(null);
    if (q.trim().length < 2) {
      setClientResults([]);
      return;
    }
    try {
      const res = await colisApi.searchUsers(q.trim());
      setClientResults(Array.isArray(res) ? res : []);
    } catch {
      setClientResults([]);
    }
  };

  const ensureClientEmail = async (): Promise<string> => {
    if (clientMode === 'search') {
      if (!selectedClient?.email) throw new Error('Sélectionnez un client');
      return selectedClient.email;
    }
    const name = newClient.full_name.trim();
    const phone = newClient.phone.trim();
    if (!name || !phone) throw new Error('Nom et téléphone requis pour un client sans compte');
    // Fiche métier (sans compte app) — réutilise si téléphone déjà connu
    const created = await adminApi.createOperationalCustomer({
      full_name: name,
      phone,
      city: newClient.city.trim() || 'Douala',
      email: newClient.email.trim() || undefined,
    });
    Toast.show({
      type: 'success',
      text1: created.reused ? 'Client existant réutilisé' : 'Fiche client créée (sans compte app)',
    });
    return created.email;
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Toast.show({ type: 'error', text1: 'Permission caméra refusée' });
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      setPhotos((prev) => [...prev, result.assets[0].uri].slice(0, 5));
    }
  };

  const pickFromGallery = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Toast.show({ type: 'error', text1: 'Permission galerie refusée' });
      return;
    }
    const remaining = Math.max(0, 5 - photos.length);
    if (remaining <= 0) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.7,
    });
    if (!result.canceled && result.assets?.length) {
      const uris = result.assets.map((a) => a.uri).filter(Boolean);
      setPhotos((prev) => [...prev, ...uris].slice(0, 5));
    }
  };

  const submitSaisie = async () => {
    if (!pkgForm.description.trim()) {
      Toast.show({ type: 'error', text1: 'Description / nature requise' });
      return;
    }
    if (!pkgForm.entrepot_id) {
      Toast.show({ type: 'error', text1: 'Choisissez un entrepôt' });
      return;
    }
    if (photos.length < 1) {
      Toast.show({ type: 'error', text1: 'Ajoutez au moins une photo du colis' });
      return;
    }
    setSaving(true);
    setUploadProgress(null);
    try {
      const ownerEmail = await ensureClientEmail();
      const dims = {
        l: Number(pkgForm.l || 0),
        w: Number(pkgForm.w || 0),
        h: Number(pkgForm.h || 0),
      };
      const created = await colisApi.create({
        owner_id: ownerEmail,
        description: pkgForm.description.trim(),
        tracking_number: pkgForm.tracking_number.trim() || undefined,
        supplier_tracking: pkgForm.supplier_tracking.trim() || pkgForm.tracking_number.trim() || 'MANUAL',
        transport_mode: pkgForm.transport_mode,
        category_key: pkgForm.category_key || defaultFreightCategoryKey(pkgForm.transport_mode),
        weight_real: Number(pkgForm.weight || 0),
        dimensions: dims,
        photos: [],
        category: 'other',
      });
      const pkgId = created.id || (created as any)._id;

      setUploadProgress({ done: 0, total: photos.length });
      let done = 0;
      for (const uri of photos) {
        try {
          await colisApi.uploadPhoto(pkgId, uri);
        } catch {
          // continue other photos
        }
        done += 1;
        setUploadProgress({ done, total: photos.length });
      }

      await colisApi.receive(pkgId, {
        weight_real: Number(pkgForm.weight || 0),
        dimensions: dims,
        nature: pkgForm.description.trim(),
        status: 'received',
        entrepot_id: pkgForm.entrepot_id,
      });

      Toast.show({
        type: 'success',
        text1: 'Colis enregistré en stock',
        text2: created.tracking_number,
      });
      setPkgForm((f) => ({
        ...f,
        description: '',
        tracking_number: '',
        supplier_tracking: '',
        weight: '',
        l: '', w: '', h: '',
        notes: '',
      }));
      setPhotos([]);
      setSelectedClient(null);
      setClientQ('');
      setNewClient({ full_name: '', phone: '', city: 'Douala', email: '' });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: e?.message || formatErr(e, 'Saisie impossible') });
    } finally {
      setSaving(false);
      setUploadProgress(null);
    }
  };

  const searchPackages = async () => {
    if (!trackQ.trim()) return;
    setSaving(true);
    try {
      const res = await colisApi.list({ tracking_number: trackQ.trim(), limit: 20 });
      setFoundPkgs(Array.isArray(res) ? res : []);
      if (!res?.length) Toast.show({ type: 'info', text1: 'Aucun colis trouvé' });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: formatErr(e, 'Recherche') });
    } finally {
      setSaving(false);
    }
  };

  const assignPackage = async () => {
    const pkgId = selectedPkg?.id || selectedPkg?._id;
    if (!pkgId || !assignEntrepotId) {
      Toast.show({ type: 'error', text1: 'Colis et entrepôt requis' });
      return;
    }
    setSaving(true);
    try {
      const hasWh = !!(selectedPkg.current_entrepot_id || selectedPkg.warehouse_location);
      if (hasWh) {
        await entrepotsApi.transferPackage(pkgId, assignEntrepotId, assignNotes || 'Affectation manuelle');
      } else {
        await entrepotsApi.receivePackage(pkgId, assignEntrepotId, assignNotes || 'Affectation manuelle');
      }
      Toast.show({ type: 'success', text1: 'Colis affecté à l’entrepôt' });
      setSelectedPkg(null);
      setFoundPkgs([]);
      setTrackQ('');
      loadUnassigned();
    } catch (e: any) {
      Toast.show({ type: 'error', text1: formatErr(e, 'Affectation échouée') });
    } finally {
      setSaving(false);
    }
  };

  if (user?.role !== 'admin' && user?.role !== 'operator') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Text style={styles.empty}>Accès refusé</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><ChevronLeft size={24} color={colors.text} /></TouchableOpacity>
        <Text style={styles.title}>Stock & entrepôts</Text>
        {tab === 'entrepots' ? (
          <TouchableOpacity onPress={openCreate}><Plus size={22} color={colors.primary} /></TouchableOpacity>
        ) : <View style={{ width: 22 }} />}
      </View>

      <View style={styles.tabs}>
        {([
          ['saisie', 'Saisie colis'],
          ['affecter', 'Affecter'],
          ['entrepots', 'Entrepôts'],
        ] as const).map(([k, label]) => (
          <TouchableOpacity
            key={k}
            style={[styles.tab, tab === k && styles.tabOn]}
            onPress={() => setTab(k)}
          >
            <Text style={[styles.tabText, tab === k && styles.tabTextOn]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading && tab === 'entrepots' ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : null}

      {tab === 'entrepots' && !loading && (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id || i._id!}
          contentContainerStyle={{ padding: spacing.lg }}
          ListEmptyComponent={<Text style={styles.empty}>Aucun entrepôt</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Building2 size={20} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <Text style={styles.cardTitle}>{item.name}</Text>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: item.transport_mode === 'air' ? '#0EA5E9' : '#0369A1', backgroundColor: item.transport_mode === 'air' ? 'rgba(14,165,233,0.15)' : 'rgba(3,105,161,0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                    {item.transport_mode === 'air' ? '✈️ Aérien' : '🚢 Maritime'}
                  </Text>
                </View>
                <Text style={styles.meta}>{item.city}, {item.country} · {item.type === 'origin' ? 'Origine' : 'Destination'}</Text>
                {item.address ? <Text style={[styles.meta, { color: colors.textSecondary }]}>📍 {item.address}</Text> : null}
              </View>
              {user?.role === 'admin' && (
                <>
                  <TouchableOpacity onPress={() => openEdit(item)} style={styles.iconBtn}><Pencil size={16} color={colors.primary} /></TouchableOpacity>
                  <TouchableOpacity onPress={() => remove(item)} style={styles.iconBtn}><Trash2 size={16} color={colors.danger} /></TouchableOpacity>
                </>
              )}
            </View>
          )}
        />
      )}

      {tab === 'saisie' && (
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.section}>1. Client (avec ou sans compte app)</Text>
          <View style={styles.modeRow}>
            <TouchableOpacity style={[styles.modeChip, clientMode === 'search' && styles.modeOn]} onPress={() => setClientMode('search')}>
              <Search size={14} color={clientMode === 'search' ? '#fff' : colors.textSecondary} />
              <Text style={[styles.modeText, clientMode === 'search' && { color: '#fff' }]}>Existant</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modeChip, clientMode === 'new' && styles.modeOn]} onPress={() => setClientMode('new')}>
              <UserPlus size={14} color={clientMode === 'new' ? '#fff' : colors.textSecondary} />
              <Text style={[styles.modeText, clientMode === 'new' && { color: '#fff' }]}>Sans compte</Text>
            </TouchableOpacity>
          </View>

          {clientMode === 'search' ? (
            <>
              <TextInput
                style={styles.input}
                placeholder="Nom, téléphone, email, code…"
                placeholderTextColor={colors.textSecondary}
                value={clientQ}
                onChangeText={searchClients}
              />
              {clientResults.map((c) => (
                <TouchableOpacity
                  key={c.id || c.email}
                  style={[styles.pickRow, selectedClient?.email === c.email && styles.pickOn]}
                  onPress={() => { setSelectedClient(c); setClientResults([]); }}
                >
                  <Text style={styles.cardTitle}>{c.full_name || c.email}</Text>
                  <Text style={styles.meta}>{c.phone || '—'} · {c.email}</Text>
                </TouchableOpacity>
              ))}
              {selectedClient && (
                <View style={styles.selectedBox}>
                  <Text style={styles.cardTitle}>{selectedClient.full_name}</Text>
                  <Text style={styles.meta}>{selectedClient.email}</Text>
                </View>
              )}
            </>
          ) : (
            <>
              <Text style={styles.hint}>Crée une fiche client (accès app possible plus tard avec le même téléphone / email).</Text>
              <TextInput style={styles.input} placeholder="Nom complet *" placeholderTextColor={colors.textSecondary} value={newClient.full_name} onChangeText={(v) => setNewClient({ ...newClient, full_name: v })} />
              <TextInput style={styles.input} placeholder="Téléphone *" placeholderTextColor={colors.textSecondary} keyboardType="phone-pad" value={newClient.phone} onChangeText={(v) => setNewClient({ ...newClient, phone: v })} />
              <TextInput style={styles.input} placeholder="Ville" placeholderTextColor={colors.textSecondary} value={newClient.city} onChangeText={(v) => setNewClient({ ...newClient, city: v })} />
              <TextInput style={styles.input} placeholder="Email (optionnel)" placeholderTextColor={colors.textSecondary} autoCapitalize="none" value={newClient.email} onChangeText={(v) => setNewClient({ ...newClient, email: v })} />
            </>
          )}

          <Text style={styles.section}>2. Colis à expédier</Text>
          <TextInput style={styles.input} placeholder="Nature / description *" placeholderTextColor={colors.textSecondary} value={pkgForm.description} onChangeText={(v) => setPkgForm({ ...pkgForm, description: v })} />
          <TextInput style={styles.input} placeholder="Tracking MOG (optionnel)" placeholderTextColor={colors.textSecondary} value={pkgForm.tracking_number} onChangeText={(v) => setPkgForm({ ...pkgForm, tracking_number: v })} />
          <TextInput style={styles.input} placeholder="Tracking fournisseur (optionnel)" placeholderTextColor={colors.textSecondary} value={pkgForm.supplier_tracking} onChangeText={(v) => setPkgForm({ ...pkgForm, supplier_tracking: v })} />

          <View style={styles.modeRow}>
            <TouchableOpacity
              style={[styles.modeChip, pkgForm.transport_mode === 'sea' && styles.modeSea]}
              onPress={() => setPkgForm({
                ...pkgForm,
                transport_mode: 'sea',
                category_key: freightCategoriesForMode('sea').some((c) => c.key === pkgForm.category_key)
                  ? pkgForm.category_key
                  : defaultFreightCategoryKey('sea'),
              })}
            >
              <Ship size={14} color={pkgForm.transport_mode === 'sea' ? '#fff' : colors.textSecondary} />
              <Text style={[styles.modeText, pkgForm.transport_mode === 'sea' && { color: '#fff' }]}>Maritime</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeChip, pkgForm.transport_mode === 'air' && styles.modeAir]}
              onPress={() => setPkgForm({
                ...pkgForm,
                transport_mode: 'air',
                category_key: freightCategoriesForMode('air').some((c) => c.key === pkgForm.category_key)
                  ? pkgForm.category_key
                  : defaultFreightCategoryKey('air'),
              })}
            >
              <Plane size={14} color={pkgForm.transport_mode === 'air' ? '#fff' : colors.textSecondary} />
              <Text style={[styles.modeText, pkgForm.transport_mode === 'air' && { color: '#fff' }]}>Aérien</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.hint}>Catégorie tarifaire (grille simulateur)</Text>
          <CategoryChips
            items={freightCategoriesForMode(pkgForm.transport_mode)}
            activeKey={pkgForm.category_key}
            onSelect={(key) => setPkgForm({ ...pkgForm, category_key: key })}
          />

          <TextInput style={styles.input} placeholder="Poids kg" placeholderTextColor={colors.textSecondary} keyboardType="decimal-pad" value={pkgForm.weight} onChangeText={(v) => setPkgForm({ ...pkgForm, weight: v })} />
          <View style={styles.dimsRow}>
            {(['l', 'w', 'h'] as const).map((k) => (
              <TextInput
                key={k}
                style={[styles.input, styles.dimInput]}
                placeholder={`${k.toUpperCase()} cm`}
                placeholderTextColor={colors.textSecondary}
                keyboardType="decimal-pad"
                value={pkgForm[k]}
                onChangeText={(v) => setPkgForm({ ...pkgForm, [k]: v })}
              />
            ))}
          </View>

          <Text style={styles.section}>3. Entrepôt de stock</Text>
          <View style={styles.whWrap}>
            {items.map((e) => {
              const id = e.id || e._id || '';
              const on = pkgForm.entrepot_id === id;
              return (
                <TouchableOpacity key={id} style={[styles.whChip, on && styles.whOn]} onPress={() => setPkgForm({ ...pkgForm, entrepot_id: id })}>
                  <Text style={[styles.whText, on && { color: '#fff' }]}>{e.name}</Text>
                  <Text style={[styles.meta, on && { color: 'rgba(255,255,255,0.8)' }]}>{e.type === 'origin' ? 'Origine' : 'Dest.'}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <TextInput style={styles.input} placeholder="Notes (optionnel)" placeholderTextColor={colors.textSecondary} value={pkgForm.notes} onChangeText={(v) => setPkgForm({ ...pkgForm, notes: v })} />

          <Text style={styles.section}>4. Photos du colis</Text>
          <Text style={styles.hint}>Au moins 1 photo — caméra ou galerie (max 5).</Text>
          <View style={styles.photoGrid}>
            {photos.map((uri, i) => (
              <View key={`${uri}-${i}`} style={styles.photoWrap}>
                <Image source={{ uri }} style={styles.photo} />
                <TouchableOpacity
                  style={styles.removePhoto}
                  onPress={() => setPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                >
                  <Trash2 size={14} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
          {photos.length < 5 && (
            <View style={styles.photoActions}>
              <TouchableOpacity style={styles.addPhoto} onPress={takePhoto}>
                <Camera size={22} color={colors.primary} />
                <Text style={styles.addPhotoText}>Caméra</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.addPhoto} onPress={pickFromGallery}>
                <ImagePlus size={22} color={colors.secondary} />
                <Text style={styles.addPhotoText}>Galerie</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity style={styles.cta} onPress={submitSaisie} disabled={saving}>
            {saving ? (
              <View style={{ alignItems: 'center', gap: 6 }}>
                <ActivityIndicator color="#fff" />
                {uploadProgress && (
                  <Text style={styles.ctaText}>Photos {uploadProgress.done}/{uploadProgress.total}</Text>
                )}
              </View>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Package size={18} color="#fff" />
                <Text style={styles.ctaText}>Enregistrer en stock</Text>
              </View>
            )}
          </TouchableOpacity>
        </ScrollView>
      )}

      {tab === 'affecter' && (
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.section}>Rechercher un colis existant</Text>
          <View style={styles.searchRow}>
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              placeholder="Tracking…"
              placeholderTextColor={colors.textSecondary}
              value={trackQ}
              onChangeText={setTrackQ}
              onSubmitEditing={searchPackages}
            />
            <TouchableOpacity style={styles.searchBtn} onPress={searchPackages}>
              <Search size={18} color="#fff" />
            </TouchableOpacity>
          </View>

          {(foundPkgs.length ? foundPkgs : []).map((p) => {
            const id = p.id || p._id;
            const on = (selectedPkg?.id || selectedPkg?._id) === id;
            return (
              <TouchableOpacity key={id} style={[styles.pickRow, on && styles.pickOn]} onPress={() => setSelectedPkg(p)}>
                <Text style={styles.cardTitle}>{p.tracking_number}</Text>
                <Text style={styles.meta}>
                  {p.owner_id} · {p.status} · {p.current_entrepot_name || p.warehouse_location || 'Sans entrepôt'}
                </Text>
              </TouchableOpacity>
            );
          })}

          {!foundPkgs.length && (
            <>
              <Text style={styles.section}>Sans entrepôt (récents)</Text>
              {unassigned.map((p) => {
                const id = p.id || p._id;
                const on = (selectedPkg?.id || selectedPkg?._id) === id;
                return (
                  <TouchableOpacity key={id} style={[styles.pickRow, on && styles.pickOn]} onPress={() => setSelectedPkg(p)}>
                    <Text style={styles.cardTitle}>{p.tracking_number}</Text>
                    <Text style={styles.meta}>{p.owner_id} · {p.description || p.nature || '—'}</Text>
                  </TouchableOpacity>
                );
              })}
              {!unassigned.length && <Text style={styles.meta}>Aucun colis sans entrepôt listé.</Text>}
            </>
          )}

          {selectedPkg && (
            <>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 12, marginBottom: 12 }}>
                <TouchableOpacity
                  style={[styles.cta, { flex: 1, backgroundColor: colors.primary, marginTop: 0 }]}
                  onPress={() => {
                    // Sélectionner le colis et ouvrir l'écran de mise à jour / audit / photos
                    router.push({
                      pathname: '/(operator)/reception',
                      params: { tracking: selectedPkg.tracking_number },
                    } as any);
                  }}
                >
                  <Text style={styles.ctaText}>✏️ Modifier / Éditer colis & photos</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.section}>Affecter à un entrepôt</Text>
              <View style={styles.whWrap}>
                {items.map((e) => {
                  const id = e.id || e._id || '';
                  const on = assignEntrepotId === id;
                  return (
                    <TouchableOpacity key={id} style={[styles.whChip, on && styles.whOn]} onPress={() => setAssignEntrepotId(id)}>
                      <Text style={[styles.whText, on && { color: '#fff' }]}>{e.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TextInput style={styles.input} placeholder="Notes" placeholderTextColor={colors.textSecondary} value={assignNotes} onChangeText={setAssignNotes} />
              <TouchableOpacity style={styles.cta} onPress={assignPackage} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>Confirmer l’affectation</Text>}
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      )}

      <Modal visible={show} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{editId ? 'Modifier entrepôt' : 'Nouvel entrepôt'}</Text>
            <TextInput style={styles.input} placeholder="Nom de l'entrepôt *" placeholderTextColor={colors.textSecondary} value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} />
            {!editId && (
              <>
                <TextInput style={styles.input} placeholder="Ville *" placeholderTextColor={colors.textSecondary} value={form.city} onChangeText={(v) => setForm({ ...form, city: v })} />
                <TextInput style={styles.input} placeholder="Pays *" placeholderTextColor={colors.textSecondary} value={form.country} onChangeText={(v) => setForm({ ...form, country: v })} />
                <View style={styles.modeRow}>
                  {(['origin', 'destination'] as const).map((t) => (
                    <TouchableOpacity key={t} style={[styles.modeChip, form.type === t && styles.modeOn]} onPress={() => setForm({ ...form, type: t })}>
                      <Text style={[styles.modeText, form.type === t && { color: '#fff' }]}>{t === 'origin' ? '🇨🇳 Origine' : '🇨🇲 Destination'}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={styles.modeRow}>
                  {(['sea', 'air'] as const).map((m) => (
                    <TouchableOpacity key={m} style={[styles.modeChip, form.transport_mode === m && (m === 'sea' ? styles.modeSea : styles.modeAir)]} onPress={() => setForm({ ...form, transport_mode: m })}>
                      <Text style={[styles.modeText, form.transport_mode === m && { color: '#fff' }]}>{m === 'sea' ? '🚢 Maritime' : '✈️ Aérien'}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
            <TextInput style={styles.input} placeholder="Adresse complète *" placeholderTextColor={colors.textSecondary} value={form.address} onChangeText={(v) => setForm({ ...form, address: v })} />
            <TextInput style={styles.input} placeholder="Contact" placeholderTextColor={colors.textSecondary} value={form.contact} onChangeText={(v) => setForm({ ...form, contact: v })} />
            <TouchableOpacity style={styles.cta} onPress={saveWh} disabled={saving}>
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
  tabs: { flexDirection: 'row', marginHorizontal: spacing.lg, gap: 6, marginBottom: 8 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.card, alignItems: 'center' },
  tabOn: { backgroundColor: colors.primary },
  tabText: { fontSize: 11, fontWeight: '800', color: colors.textSecondary },
  tabTextOn: { color: '#fff' },
  scroll: { padding: spacing.lg, paddingBottom: 48 },
  section: { fontSize: 12, fontWeight: '800', color: colors.textSecondary, textTransform: 'uppercase', marginTop: 12, marginBottom: 8 },
  hint: { fontSize: 12, color: colors.textSecondary, marginBottom: 8, fontWeight: '600' },
  card: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.card, borderRadius: 14, padding: 14, marginBottom: 10 },
  cardTitle: { fontWeight: '800', color: colors.text },
  meta: { marginTop: 2, fontSize: 12, color: colors.textSecondary },
  iconBtn: { padding: 8 },
  empty: { textAlign: 'center', color: colors.textSecondary, marginTop: 40 },
  input: { backgroundColor: colors.card, borderRadius: radii.input, padding: 12, color: colors.text, marginBottom: 10 },
  modeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  modeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.card,
  },
  modeOn: { backgroundColor: colors.primary },
  modeSea: { backgroundColor: '#0369A1' },
  modeAir: { backgroundColor: '#0EA5E9' },
  modeText: { fontWeight: '700', fontSize: 12, color: colors.textSecondary },
  pickRow: { backgroundColor: colors.card, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: colors.border },
  pickOn: { borderColor: colors.primary, backgroundColor: `${colors.primary}18` },
  selectedBox: { backgroundColor: `${colors.success}20`, borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: colors.success },
  dimsRow: { flexDirection: 'row', gap: 8 },
  dimInput: { flex: 1 },
  whWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  whChip: { backgroundColor: colors.card, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, minWidth: '45%' },
  whOn: { backgroundColor: colors.primary },
  whText: { fontWeight: '800', color: colors.text, fontSize: 13 },
  searchRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 12 },
  searchBtn: { backgroundColor: colors.primary, borderRadius: 12, padding: 14 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 },
  photoActions: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  addPhoto: {
    flex: 1, height: 88, borderRadius: 14, borderWidth: 2, borderStyle: 'dashed',
    borderColor: colors.primary, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  addPhotoText: { color: colors.primary, fontWeight: '800', fontSize: 12 },
  photoWrap: { width: '30%', aspectRatio: 1, position: 'relative' },
  photo: { width: '100%', height: '100%', borderRadius: 12 },
  removePhoto: {
    position: 'absolute', top: -6, right: -6, backgroundColor: colors.danger,
    width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center',
  },
  cta: { backgroundColor: colors.primary, borderRadius: radii.button, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  ctaText: { color: '#fff', fontWeight: '800' },
  cancel: { color: colors.textSecondary, textAlign: 'center', fontWeight: '700', marginTop: 12 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40 },
  modalTitle: { fontSize: 18, fontWeight: '900', color: colors.text, marginBottom: 16 },
});
