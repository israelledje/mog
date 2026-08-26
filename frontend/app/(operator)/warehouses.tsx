import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Modal,
  ActivityIndicator, ScrollView, Alert, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import {
  ChevronLeft, Plus, Pencil, Trash2, Building2, Package, Search, UserPlus, Ship, Plane,
  Camera, ImagePlus, MapPin, Globe, Phone, Navigation, X, Check, Sparkles,
  Scale, Maximize, Layers, ArrowRightLeft, Eye, Tag, SlidersHorizontal, RefreshCw, Box as BoxIcon,
} from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { entrepotsApi, type Entrepot } from '../../src/api/entrepots';
import { colisApi } from '../../src/api/colis';
import { adminApi } from '../../src/api/admin';
import { formatErr } from '../../src/api/client';
import { useAuthStore } from '../../src/store/authStore';
import { darkColors as colors, radii, spacing, shadow, fonts } from '../../src/constants/theme';
import { CategoryChips } from '../../src/components/ui/HorizontalChips';
import {
  freightCategoriesForMode,
  defaultFreightCategoryKey,
} from '../../src/constants/freightCategories';
import type { Colis } from '../../src/types';

type Tab = 'stock' | 'saisie' | 'entrepots' | 'affecter';

const blankWh = {
  name: '', city: '', country: 'Chine', type: 'origin' as 'origin' | 'destination', transport_mode: 'sea' as 'sea' | 'air', address: '', contact: '',
};

export default function WarehousesAdminScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string; create?: string; entrepot_id?: string }>();
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = useState<Tab>((params.tab as Tab) || 'stock');
  const [items, setItems] = useState<Entrepot[]>([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...blankWh });
  const [saving, setSaving] = useState(false);

  // Stock par entrepôt
  const [stockPackages, setStockPackages] = useState<Colis[]>([]);
  const [loadingStock, setLoadingStock] = useState(false);
  const [selectedStockWhId, setSelectedStockWhId] = useState<string>(params.entrepot_id || 'all');
  const [stockSearchQ, setStockSearchQ] = useState('');
  const [stockStatusFilter, setStockStatusFilter] = useState<'all' | 'received' | 'loaded' | 'in_transit' | 'arrived'>('all');

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
    entrepot_id: user?.active_entrepot_id || '',
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

  const loadStock = useCallback(async () => {
    setLoadingStock(true);
    try {
      const list = await colisApi.list({ limit: 400 });
      setStockPackages(Array.isArray(list) ? list : []);
    } catch {
      setStockPackages([]);
    } finally {
      setLoadingStock(false);
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const data = await entrepotsApi.list();
      const list = Array.isArray(data) ? data : [];
      setItems(list);
      setPkgForm((f) => {
        if (f.entrepot_id) return f;
        const originWh = list.find((e) => e.type === 'origin') || list[0];
        return { ...f, entrepot_id: user?.active_entrepot_id || originWh?.id || originWh?._id || '' };
      });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: formatErr(e, 'Entrepôts') });
    } finally {
      setLoading(false);
    }
  }, [user?.active_entrepot_id]);

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

  useEffect(() => {
    load();
    loadStock();
  }, [load, loadStock]);

  useEffect(() => {
    if (params.tab && ['stock', 'entrepots', 'saisie', 'affecter'].includes(params.tab)) {
      setTab(params.tab as Tab);
    }
    if (params.create === '1' || params.create === 'true') {
      openCreate();
    }
    if (params.entrepot_id) {
      setSelectedStockWhId(params.entrepot_id);
    }
  }, [params.tab, params.create, params.entrepot_id]);

  useEffect(() => {
    if (tab === 'affecter') loadUnassigned();
    if (tab === 'stock') loadStock();
  }, [tab, loadUnassigned, loadStock]);

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
      transport_mode: e.transport_mode || 'sea',
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
          city: form.city.trim(),
          country: form.country.trim(),
          type: form.type,
          transport_mode: form.transport_mode,
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
      Toast.show({ type: 'success', text1: editId ? 'Entrepôt mis à jour' : 'Entrepôt créé avec succès' });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: formatErr(e, 'Erreur') });
    } finally {
      setSaving(false);
    }
  };

  const filteredStock = useMemo(() => {
    return stockPackages.filter((p) => {
      // Warehouse filter
      if (selectedStockWhId !== 'all') {
        const pkgWh = p.current_entrepot_id || p.warehouse_location;
        if (pkgWh !== selectedStockWhId) return false;
      }
      // Status filter
      if (stockStatusFilter !== 'all') {
        if (stockStatusFilter === 'received' && p.status !== 'received' && p.status !== 'damaged') return false;
        if (stockStatusFilter === 'loaded' && p.status !== 'loaded' && p.status !== 'grouped') return false;
        if (stockStatusFilter === 'in_transit' && p.status !== 'in_transit' && p.status !== 'departed') return false;
        if (stockStatusFilter === 'arrived' && p.status !== 'arrived' && p.status !== 'distributed') return false;
      }
      // Search filter
      if (stockSearchQ.trim()) {
        const q = stockSearchQ.trim().toLowerCase();
        const trk = (p.tracking_number || '').toLowerCase();
        const desc = (p.description || p.nature || '').toLowerCase();
        const owner = (p.owner_id || '').toLowerCase();
        const whName = (p.current_entrepot_name || '').toLowerCase();
        if (!trk.includes(q) && !desc.includes(q) && !owner.includes(q) && !whName.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [stockPackages, selectedStockWhId, stockStatusFilter, stockSearchQ]);

  const stockStats = useMemo(() => {
    const totalCount = filteredStock.length;
    const totalWeight = filteredStock.reduce((acc, p) => acc + (Number(p.weight_real) || Number((p as any).weight_declared) || Number((p as any).weight) || 0), 0);
    const totalCbm = filteredStock.reduce((acc, p) => {
      const d = p.dimensions;
      if (d && d.l && d.w && d.h) {
        return acc + (Number(d.l) * Number(d.w) * Number(d.h)) / 1000000;
      }
      return acc;
    }, 0);
    return {
      count: totalCount,
      weight: totalWeight.toFixed(1),
      cbm: totalCbm.toFixed(3),
    };
  }, [filteredStock]);

  const warehouseCounts = useMemo(() => {
    const map: Record<string, number> = { all: stockPackages.length };
    items.forEach((wh) => {
      const id = wh.id || wh._id || '';
      map[id] = stockPackages.filter((p) => (p.current_entrepot_id || p.warehouse_location) === id).length;
    });
    return map;
  }, [items, stockPackages]);

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
      Toast.show({ type: 'error', text1: 'Choisissez un entrepôt de stock' });
      return;
    }

    // Validation métier : un colis saisi initialement ne peut pas être dans un entrepôt de destination sans transit
    const chosenWh = items.find((e) => (e.id || e._id) === pkgForm.entrepot_id);
    if (chosenWh?.type === 'destination') {
      Alert.alert(
        'Entrepôt de destination non autorisé',
        'Un colis ne peut pas être saisi directement dans un entrepôt d’arrivée sans transit préalable. Veuillez sélectionner un entrepôt d’origine (départ) ou créer un groupage pour l’acheminement.',
        [{ text: 'Compris' }]
      );
      return;
    }

    if (photos.length < 1) {
      Toast.show({ type: 'error', text1: 'Ajoutez au moins une photo du colis' });
      return;
    }

    setSaving(true);
    setUploadProgress(null);
    try {
      let ownerEmail: string;
      let clientNotesPrefix = '';

      if (clientMode === 'search') {
        if (!selectedClient?.email) {
          Toast.show({ type: 'error', text1: 'Sélectionnez un client existant' });
          setSaving(false);
          return;
        }
        ownerEmail = selectedClient.email;
      } else {
        const name = newClient.full_name.trim();
        const phone = newClient.phone.trim();
        if (!name || !phone) {
          Toast.show({ type: 'error', text1: 'Nom et téléphone du client requis' });
          setSaving(false);
          return;
        }
        // Client sans compte : le propriétaire du colis est l'opérateur ou l'admin qui fait la saisie
        ownerEmail = user?.email || 'admin@mog.com';
        clientNotesPrefix = `[Client: ${name} | Tél: ${phone} | Ville: ${newClient.city.trim() || 'Douala'}]`;

        // Créer ou lier la fiche client opérationnelle
        try {
          await adminApi.createOperationalCustomer({
            full_name: name,
            phone,
            city: newClient.city.trim() || 'Douala',
            email: newClient.email.trim() || undefined,
          });
        } catch {
          // ignore
        }
      }

      const dims = {
        l: Number(pkgForm.l || 0),
        w: Number(pkgForm.w || 0),
        h: Number(pkgForm.h || 0),
      };

      const finalDescription = clientNotesPrefix
        ? `${pkgForm.description.trim()} ${clientNotesPrefix}`
        : pkgForm.description.trim();

      const created = await colisApi.create({
        owner_id: ownerEmail,
        description: finalDescription,
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
        nature: finalDescription,
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
      loadStock();
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
      loadStock();
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'received':
        return { label: 'En stock', color: '#10B981', bg: 'rgba(16,185,129,0.15)' };
      case 'loaded':
      case 'grouped':
        return { label: 'En conteneur', color: '#38BDF8', bg: 'rgba(56,189,248,0.15)' };
      case 'in_transit':
      case 'departed':
        return { label: 'En transit', color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' };
      case 'arrived':
        return { label: 'Arrivé destination', color: '#8B5CF6', bg: 'rgba(139,92,246,0.15)' };
      case 'delivered':
        return { label: 'Livré', color: '#64748B', bg: 'rgba(100,116,139,0.15)' };
      default:
        return { label: status || 'En cours', color: colors.primary, bg: `${colors.primary}20` };
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBackBtn}>
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Stock & entrepôts</Text>
        {tab === 'entrepots' ? (
          <TouchableOpacity onPress={openCreate} style={styles.headerActionBtn}>
            <Plus size={20} color={colors.primary} />
          </TouchableOpacity>
        ) : tab === 'stock' ? (
          <TouchableOpacity onPress={loadStock} style={styles.headerActionBtn}>
            <RefreshCw size={18} color={colors.primary} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 36 }} />
        )}
      </View>

      <View style={styles.tabs}>
        {([
          ['stock', '📦 Stock'],
          ['saisie', '✍️ Saisie'],
          ['affecter', '🔄 Affecter'],
          ['entrepots', '🏢 Entrepôts'],
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

      {/* VUE 1 : STOCK PAR ENTREPÔT */}
      {tab === 'stock' && (
        <View style={{ flex: 1 }}>
          {/* Sélecteur horizontal des entrepôts avec compteurs */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.whFilterScroll}
          >
            <TouchableOpacity
              style={[
                styles.whFilterChip,
                selectedStockWhId === 'all' && styles.whFilterChipActive,
              ]}
              onPress={() => setSelectedStockWhId('all')}
            >
              <Text
                style={[
                  styles.whFilterChipText,
                  selectedStockWhId === 'all' && styles.whFilterChipTextActive,
                ]}
              >
                Tous ({warehouseCounts.all || 0})
              </Text>
            </TouchableOpacity>

            {items.map((wh) => {
              const id = wh.id || wh._id || '';
              const isSelected = selectedStockWhId === id;
              const count = warehouseCounts[id] || 0;
              const flag = wh.country?.toLowerCase().includes('chin') ? '🇨🇳' : wh.country?.toLowerCase().includes('cam') ? '🇨🇲' : '🌍';
              return (
                <TouchableOpacity
                  key={id}
                  style={[
                    styles.whFilterChip,
                    isSelected && styles.whFilterChipActive,
                  ]}
                  onPress={() => setSelectedStockWhId(id)}
                >
                  <Text style={styles.whFilterFlag}>{flag}</Text>
                  <Text
                    style={[
                      styles.whFilterChipText,
                      isSelected && styles.whFilterChipTextActive,
                    ]}
                  >
                    {wh.name} ({count})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Cartes KPI du stock sélectionné */}
          <View style={styles.kpiRow}>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiValue}>{stockStats.count}</Text>
              <Text style={styles.kpiLabel}>Colis en stock</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiValue}>{stockStats.weight} kg</Text>
              <Text style={styles.kpiLabel}>Poids total</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiValue}>{stockStats.cbm} m³</Text>
              <Text style={styles.kpiLabel}>Volume total</Text>
            </View>
          </View>

          {/* Barre de recherche et filtres de statut */}
          <View style={styles.searchFilterSection}>
            <View style={styles.stockSearchBar}>
              <Search size={16} color={colors.textSecondary} />
              <TextInput
                style={styles.stockSearchInput}
                placeholder="Rechercher par tracking, client, description..."
                placeholderTextColor={colors.textSecondary}
                value={stockSearchQ}
                onChangeText={setStockSearchQ}
              />
              {stockSearchQ.length > 0 && (
                <TouchableOpacity onPress={() => setStockSearchQ('')}>
                  <X size={16} color={colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.statusChipsScroll}
            >
              {[
                { key: 'all', label: 'Tous' },
                { key: 'received', label: 'En stock' },
                { key: 'loaded', label: 'En conteneur' },
                { key: 'in_transit', label: 'En transit' },
                { key: 'arrived', label: 'Arrivés' },
              ].map((st) => (
                <TouchableOpacity
                  key={st.key}
                  style={[
                    styles.statusFilterChip,
                    stockStatusFilter === st.key && styles.statusFilterChipActive,
                  ]}
                  onPress={() => setStockStatusFilter(st.key as any)}
                >
                  <Text
                    style={[
                      styles.statusFilterText,
                      stockStatusFilter === st.key && styles.statusFilterTextActive,
                    ]}
                  >
                    {st.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Liste des colis en stock */}
          {loadingStock ? (
            <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
          ) : (
            <FlatList
              data={filteredStock}
              keyExtractor={(p) => p.id || (p as any)._id}
              contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <BoxIcon size={40} color={colors.textSecondary} />
                  <Text style={styles.empty}>Aucun colis trouvé dans cet entrepôt</Text>
                </View>
              }
              renderItem={({ item: pkg }) => {
                const id = pkg.id || (pkg as any)._id;
                const statusBadge = getStatusBadge(pkg.status);
                const whName = pkg.current_entrepot_name || items.find((e) => (e.id || e._id) === (pkg.current_entrepot_id || pkg.warehouse_location))?.name || 'Sans entrepôt';
                const dims = pkg.dimensions;
                const cbm = dims && dims.l && dims.w && dims.h
                  ? ((Number(dims.l) * Number(dims.w) * Number(dims.h)) / 1000000).toFixed(3)
                  : null;

                return (
                  <View style={styles.stockCard}>
                    {/* Header: Tracking + Mode + Status */}
                    <View style={styles.stockCardHeader}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={styles.stockTracking}>{pkg.tracking_number}</Text>
                          <View
                            style={[
                              styles.modePill,
                              pkg.transport_mode === 'air' ? styles.modePillAir : styles.modePillSea,
                            ]}
                          >
                            {pkg.transport_mode === 'air' ? (
                              <Plane size={11} color="#38BDF8" />
                            ) : (
                              <Ship size={11} color="#0284C7" />
                            )}
                            <Text
                              style={[
                                styles.modePillText,
                                pkg.transport_mode === 'air' ? { color: '#38BDF8' } : { color: '#0284C7' },
                              ]}
                            >
                              {pkg.transport_mode === 'air' ? 'Aérien' : 'Maritime'}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.stockOwner}>
                          👤 {pkg.owner_id}
                        </Text>
                      </View>

                      <View style={[styles.statusBadge, { backgroundColor: statusBadge.bg }]}>
                        <Text style={[styles.statusBadgeText, { color: statusBadge.color }]}>
                          {statusBadge.label}
                        </Text>
                      </View>
                    </View>

                    {/* Description */}
                    <Text style={styles.stockDescription} numberOfLines={2}>
                      📦 {pkg.description || pkg.nature || 'Marchandise sans description'}
                    </Text>

                    {/* Meta row: Poids, Dimensions, CBM, Entrepôt */}
                    <View style={styles.stockMetaRow}>
                      <View style={styles.stockMetaItem}>
                        <Scale size={13} color={colors.textSecondary} />
                        <Text style={styles.stockMetaText}>
                          {Number(pkg.weight_real || (pkg as any).weight_declared || (pkg as any).weight || 0).toFixed(1)} kg
                        </Text>
                      </View>

                      {cbm && (
                        <View style={styles.stockMetaItem}>
                          <Maximize size={13} color={colors.textSecondary} />
                          <Text style={styles.stockMetaText}>{cbm} m³</Text>
                        </View>
                      )}

                      <View style={styles.stockMetaItem}>
                        <Building2 size={13} color={colors.primary} />
                        <Text style={[styles.stockMetaText, { color: colors.text }]}>{whName}</Text>
                      </View>
                    </View>

                    {/* Actions sur le colis */}
                    <View style={styles.stockActionsRow}>
                      <TouchableOpacity
                        style={styles.stockActionBtn}
                        onPress={() => {
                          setSelectedPkg(pkg);
                          setTab('affecter');
                        }}
                      >
                        <ArrowRightLeft size={14} color={colors.primary} />
                        <Text style={styles.stockActionBtnText}>Transférer / Affecter</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.stockActionBtn, styles.stockActionBtnSecondary]}
                        onPress={() => {
                          router.push(`/colis/${id}` as any);
                        }}
                      >
                        <Eye size={14} color={colors.textSecondary} />
                        <Text style={styles.stockActionBtnTextSecondary}>Détails</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              }}
            />
          )}
        </View>
      )}

      {/* VUE 2 : GÉRER LES ENTREPÔTS */}
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

      {/* VUE 3 : SAISIE DE COLIS */}
      {tab === 'saisie' && (
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.section}>1. Client (avec ou sans compte app)</Text>
          <View style={styles.modeRow}>
            <TouchableOpacity style={[styles.modeChip, clientMode === 'search' && styles.modeOn]} onPress={() => setClientMode('search')}>
              <Search size={14} color={clientMode === 'search' ? '#fff' : colors.textSecondary} />
              <Text style={[styles.modeText, clientMode === 'search' && { color: '#fff' }]}>Client avec compte</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modeChip, clientMode === 'new' && styles.modeOn]} onPress={() => setClientMode('new')}>
              <UserPlus size={14} color={clientMode === 'new' ? '#fff' : colors.textSecondary} />
              <Text style={[styles.modeText, clientMode === 'new' && { color: '#fff' }]}>Client sans compte (Attribué à l’opérateur)</Text>
            </TouchableOpacity>
          </View>

          {clientMode === 'search' ? (
            <>
              <TextInput
                style={styles.input}
                placeholder="Nom, téléphone, email, code client…"
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
                  <Text style={styles.cardTitle}>✓ {selectedClient.full_name}</Text>
                  <Text style={styles.meta}>{selectedClient.email}</Text>
                </View>
              )}
            </>
          ) : (
            <>
              <View style={styles.infoBanner}>
                <Sparkles size={16} color={colors.primary} />
                <Text style={styles.infoBannerText}>
                  Le colis sera rattaché à votre compte ({user?.email}) pour le tracking. Les coordonnées du client seront enregistrées sur la fiche d’expédition.
                </Text>
              </View>
              <TextInput style={styles.input} placeholder="Nom complet du client *" placeholderTextColor={colors.textSecondary} value={newClient.full_name} onChangeText={(v) => setNewClient({ ...newClient, full_name: v })} />
              <TextInput style={styles.input} placeholder="Téléphone du client *" placeholderTextColor={colors.textSecondary} keyboardType="phone-pad" value={newClient.phone} onChangeText={(v) => setNewClient({ ...newClient, phone: v })} />
              <TextInput style={styles.input} placeholder="Ville de livraison" placeholderTextColor={colors.textSecondary} value={newClient.city} onChangeText={(v) => setNewClient({ ...newClient, city: v })} />
              <TextInput style={styles.input} placeholder="Email du client (optionnel)" placeholderTextColor={colors.textSecondary} autoCapitalize="none" value={newClient.email} onChangeText={(v) => setNewClient({ ...newClient, email: v })} />
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

          <Text style={styles.section}>3. Entrepôt de réception actuel (Origine uniquement)</Text>
          <Text style={styles.hint}>Sélectionnez l’entrepôt où le colis physique est actuellement réceptionné :</Text>
          <View style={styles.whWrap}>
            {items.map((e) => {
              const id = e.id || e._id || '';
              const on = pkgForm.entrepot_id === id;
              const isDest = e.type === 'destination';
              return (
                <TouchableOpacity
                  key={id}
                  style={[
                    styles.whChip,
                    on && styles.whOn,
                    isDest && { opacity: 0.5, borderColor: colors.border },
                  ]}
                  onPress={() => {
                    if (isDest) {
                      Alert.alert(
                        'Entrepôt de destination',
                        'Un colis ne peut pas être saisi directement dans un entrepôt d’arrivée sans transit préalable. Veuillez choisir un entrepôt d’origine.'
                      );
                      return;
                    }
                    setPkgForm({ ...pkgForm, entrepot_id: id });
                  }}
                >
                  <Text style={[styles.whText, on && { color: '#fff' }]}>
                    {e.name}
                  </Text>
                  <Text style={[styles.meta, on && { color: 'rgba(255,255,255,0.8)' }]}>
                    {e.type === 'origin' ? '🇨🇳 Origine (Départ)' : '🇨🇲 Destination (Arrivée)'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <TextInput style={styles.input} placeholder="Notes internes (optionnel)" placeholderTextColor={colors.textSecondary} value={pkgForm.notes} onChangeText={(v) => setPkgForm({ ...pkgForm, notes: v })} />

          <TouchableOpacity style={styles.cta} onPress={submitSaisie} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>Enregistrer le colis en stock</Text>}
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* VUE 4 : AFFECTER UN COLIS SANS ENTREPÔT */}
      {tab === 'affecter' && (
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.section}>1. Sélectionner un colis</Text>
          <View style={styles.searchRow}>
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              placeholder="Rechercher par tracking..."
              placeholderTextColor={colors.textSecondary}
              value={trackQ}
              onChangeText={setTrackQ}
            />
            <TouchableOpacity style={styles.searchBtn} onPress={searchPackages} disabled={saving}>
              <Search size={18} color="#fff" />
            </TouchableOpacity>
          </View>

          {selectedPkg ? (
            <View style={styles.selectedBox}>
              <Text style={{ fontWeight: '800', color: colors.success }}>
                Colis sélectionné : {selectedPkg.tracking_number}
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                {selectedPkg.description || selectedPkg.nature || 'Sans description'} · {selectedPkg.weight_declared || selectedPkg.weight_real || 0} kg
              </Text>
            </View>
          ) : null}

          {foundPkgs.map((p) => {
            const pid = p.id || (p as any)._id;
            const on = selectedPkg && (selectedPkg.id || (selectedPkg as any)._id) === pid;
            return (
              <TouchableOpacity
                key={pid}
                style={[styles.pickRow, on && styles.pickOn]}
                onPress={() => setSelectedPkg(p)}
              >
                <Text style={{ fontWeight: '800', color: colors.text }}>{p.tracking_number}</Text>
                <Text style={styles.meta}>{p.description || p.nature || '—'} · {p.status}</Text>
              </TouchableOpacity>
            );
          })}

          <Text style={[styles.section, { marginTop: 16 }]}>2. Choisir l’entrepôt cible</Text>
          <View style={styles.whWrap}>
            {items.map((e) => {
              const id = e.id || e._id || '';
              const on = assignEntrepotId === id;
              return (
                <TouchableOpacity
                  key={id}
                  style={[styles.whChip, on && styles.whOn]}
                  onPress={() => setAssignEntrepotId(id)}
                >
                  <Text style={[styles.whText, on && { color: '#fff' }]}>{e.name}</Text>
                  <Text style={[styles.meta, on && { color: 'rgba(255,255,255,0.8)' }]}>
                    {e.type === 'origin' ? '🇨🇳 Origine' : '🇨🇲 Destination'} · {e.city}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TextInput
            style={styles.input}
            placeholder="Notes sur l'affectation ou transfert"
            placeholderTextColor={colors.textSecondary}
            value={assignNotes}
            onChangeText={setAssignNotes}
          />

          <TouchableOpacity
            style={styles.cta}
            onPress={assignPackage}
            disabled={saving || !selectedPkg || !assignEntrepotId}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>Affecter / Transférer le colis</Text>}
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* MODALE DE CRÉATION ET ÉDITION D'ENTREPÔT */}
      <Modal
        visible={show}
        animationType="slide"
        transparent
        onRequestClose={() => setShow(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShow(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={styles.modalBox}
            onPress={(e) => e.stopPropagation?.()}
          >
            {/* Modal Header */}
            <View style={styles.modalHeaderRow}>
              <View style={styles.modalHeaderIconBadge}>
                <Building2 size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>
                  {editId ? "Modifier l'entrepôt" : "Créer un nouvel entrepôt"}
                </Text>
                <Text style={styles.modalSubtitle}>
                  {editId ? 'Mettre à jour les informations du site logistique' : 'Point de départ ou de destination des colis'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setShow(false)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Quick Presets (Only on Create) */}
              {!editId && (
                <View style={styles.presetSection}>
                  <View style={styles.presetHeader}>
                    <Sparkles size={14} color={colors.primary} />
                    <Text style={styles.presetLabel}>Remplissage rapide :</Text>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetScroll}>
                    {[
                      { label: '🇨🇳 Guangzhou (Origine)', city: 'Guangzhou', country: 'Chine', type: 'origin' as const, mode: 'sea' as const, name: 'Entrepôt Guangzhou A' },
                      { label: '🇨🇳 Yiwu (Origine)', city: 'Yiwu', country: 'Chine', type: 'origin' as const, mode: 'sea' as const, name: 'Entrepôt Yiwu Marché' },
                      { label: '🇨🇲 Douala (Destination)', city: 'Douala', country: 'Cameroun', type: 'destination' as const, mode: 'sea' as const, name: 'Hub Douala Port' },
                      { label: '🇨🇲 Yaoundé (Destination)', city: 'Yaoundé', country: 'Cameroun', type: 'destination' as const, mode: 'air' as const, name: 'Hub Yaoundé Centre' },
                      { label: '🇦🇪 Dubaï (Origine)', city: 'Dubaï', country: 'Émirats Arabes Unis', type: 'origin' as const, mode: 'air' as const, name: 'Entrepôt Dubaï Air' },
                    ].map((preset, idx) => (
                      <TouchableOpacity
                        key={idx}
                        style={styles.presetChip}
                        onPress={() => {
                          setForm({
                            ...form,
                            city: preset.city,
                            country: preset.country,
                            type: preset.type,
                            transport_mode: preset.mode,
                            name: form.name || preset.name,
                          });
                        }}
                      >
                        <Text style={styles.presetChipText}>{preset.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Section 1: Type d'entrepôt */}
              <Text style={styles.formSectionLabel}>Type de site logistique</Text>
              <View style={styles.typeSelectorRow}>
                <TouchableOpacity
                  style={[styles.typeCard, form.type === 'origin' && styles.typeCardActive]}
                  onPress={() => setForm({ ...form, type: 'origin' })}
                  activeOpacity={0.8}
                >
                  <View style={styles.typeCardHeader}>
                    <Text style={styles.typeCardFlag}>🇨🇳 / 🌍</Text>
                    <View style={[styles.typeRadio, form.type === 'origin' && styles.typeRadioActive]}>
                      {form.type === 'origin' && <View style={styles.typeRadioDot} />}
                    </View>
                  </View>
                  <Text style={[styles.typeCardTitle, form.type === 'origin' && styles.typeCardTitleActive]}>
                    Origine (Départ)
                  </Text>
                  <Text style={styles.typeCardDesc}>
                    Réception des marchandises fournisseurs
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.typeCard, form.type === 'destination' && styles.typeCardActive]}
                  onPress={() => setForm({ ...form, type: 'destination' })}
                  activeOpacity={0.8}
                >
                  <View style={styles.typeCardHeader}>
                    <Text style={styles.typeCardFlag}>🇨🇲</Text>
                    <View style={[styles.typeRadio, form.type === 'destination' && styles.typeRadioActive]}>
                      {form.type === 'destination' && <View style={styles.typeRadioDot} />}
                    </View>
                  </View>
                  <Text style={[styles.typeCardTitle, form.type === 'destination' && styles.typeCardTitleActive]}>
                    Destination (Arrivée)
                  </Text>
                  <Text style={styles.typeCardDesc}>
                    Dégroupage & livraison finale aux clients
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Section 2: Mode de fret */}
              <Text style={styles.formSectionLabel}>Mode de fret principal</Text>
              <View style={styles.modeSelectorRow}>
                <TouchableOpacity
                  style={[styles.modeCard, form.transport_mode === 'sea' && styles.modeCardSeaActive]}
                  onPress={() => setForm({ ...form, transport_mode: 'sea' })}
                  activeOpacity={0.8}
                >
                  <Ship size={18} color={form.transport_mode === 'sea' ? '#fff' : '#0284C7'} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.modeCardTitle, form.transport_mode === 'sea' && { color: '#fff' }]}>
                      Fret Maritime (Bateau)
                    </Text>
                    <Text style={[styles.modeCardSubtitle, form.transport_mode === 'sea' && { color: 'rgba(255,255,255,0.8)' }]}>
                      Groupage conteneurs CBM
                    </Text>
                  </View>
                  {form.transport_mode === 'sea' && <Check size={16} color="#fff" />}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modeCard, form.transport_mode === 'air' && styles.modeCardAirActive]}
                  onPress={() => setForm({ ...form, transport_mode: 'air' })}
                  activeOpacity={0.8}
                >
                  <Plane size={18} color={form.transport_mode === 'air' ? '#fff' : '#0EA5E9'} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.modeCardTitle, form.transport_mode === 'air' && { color: '#fff' }]}>
                      Fret Aérien (Avion)
                    </Text>
                    <Text style={[styles.modeCardSubtitle, form.transport_mode === 'air' && { color: 'rgba(255,255,255,0.8)' }]}>
                      Colis express au KG
                    </Text>
                  </View>
                  {form.transport_mode === 'air' && <Check size={16} color="#fff" />}
                </TouchableOpacity>
              </View>

              {/* Section 3: Nom de l'entrepôt */}
              <Text style={styles.formSectionLabel}>Nom de l’entrepôt *</Text>
              <View style={styles.inputWrapper}>
                <Building2 size={18} color={colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.fieldInput}
                  placeholder="ex: Entrepôt MOG Guangzhou A"
                  placeholderTextColor={colors.textSecondary}
                  value={form.name}
                  onChangeText={(v) => setForm({ ...form, name: v })}
                />
              </View>

              {/* Section 4: Ville et Pays */}
              <View style={styles.twoColsRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formSectionLabel}>Ville *</Text>
                  <View style={styles.inputWrapper}>
                    <MapPin size={18} color={colors.textSecondary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.fieldInput}
                      placeholder="ex: Guangzhou"
                      placeholderTextColor={colors.textSecondary}
                      value={form.city}
                      onChangeText={(v) => setForm({ ...form, city: v })}
                    />
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formSectionLabel}>Pays *</Text>
                  <View style={styles.inputWrapper}>
                    <Globe size={18} color={colors.textSecondary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.fieldInput}
                      placeholder="ex: Chine"
                      placeholderTextColor={colors.textSecondary}
                      value={form.country}
                      onChangeText={(v) => setForm({ ...form, country: v })}
                    />
                  </View>
                </View>
              </View>

              {/* Section 5: Adresse complète */}
              <Text style={styles.formSectionLabel}>Adresse complète & repères *</Text>
              <View style={[styles.inputWrapper, { alignItems: 'flex-start', paddingTop: 12 }]}>
                <Navigation size={18} color={colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={[styles.fieldInput, { minHeight: 64, textAlignVertical: 'top' }]}
                  placeholder="Numéro, rue, zone industrielle, bâtiment, code postal..."
                  placeholderTextColor={colors.textSecondary}
                  value={form.address}
                  multiline
                  onChangeText={(v) => setForm({ ...form, address: v })}
                />
              </View>

              {/* Section 6: Contact */}
              <Text style={styles.formSectionLabel}>Téléphone / Contact responsable</Text>
              <View style={styles.inputWrapper}>
                <Phone size={18} color={colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.fieldInput}
                  placeholder="ex: +86 138 0000 0000 / M. Zhang"
                  placeholderTextColor={colors.textSecondary}
                  value={form.contact}
                  onChangeText={(v) => setForm({ ...form, contact: v })}
                />
              </View>
            </ScrollView>

            {/* Footer Action Buttons */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.submitBtn}
                onPress={saveWh}
                disabled={saving}
                activeOpacity={0.85}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Check size={18} color="#fff" />
                    <Text style={styles.submitBtnText}>
                      {editId ? "Enregistrer les modifications" : "Créer l'entrepôt"}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.dismissBtn}
                onPress={() => setShow(false)}
                disabled={saving}
              >
                <Text style={styles.dismissBtnText}>Annuler</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg },
  title: { fontSize: 18, fontWeight: '800', color: colors.text },
  headerBackBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerActionBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
  infoBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: `${colors.primary}18`, borderWidth: 1, borderColor: `${colors.primary}35`, borderRadius: 12, padding: 12, marginBottom: 12 },
  infoBannerText: { flex: 1, fontSize: 12, color: colors.text, lineHeight: 17, fontWeight: '600' },

  // Stock Tab Styles
  whFilterScroll: { paddingHorizontal: spacing.lg, paddingVertical: 8, gap: 8 },
  whFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  whFilterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  whFilterFlag: { fontSize: 14 },
  whFilterChipText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  whFilterChipTextActive: { color: '#fff' },

  kpiRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    gap: 8,
    marginVertical: 6,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  kpiValue: { fontSize: 16, fontWeight: '900', color: colors.text, letterSpacing: -0.3 },
  kpiLabel: { fontSize: 10, fontWeight: '700', color: colors.textSecondary, marginTop: 2, textTransform: 'uppercase' },

  searchFilterSection: { paddingHorizontal: spacing.lg, marginTop: 4, marginBottom: 6, gap: 8 },
  stockSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  stockSearchInput: { flex: 1, color: colors.text, fontSize: 13 },
  statusChipsScroll: { gap: 6 },
  statusFilterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  statusFilterChipActive: {
    backgroundColor: `${colors.primary}25`,
    borderColor: colors.primary,
  },
  statusFilterText: { fontSize: 11, fontWeight: '700', color: colors.textSecondary },
  statusFilterTextActive: { color: colors.primary },

  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 40, gap: 10 },

  stockCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    gap: 8,
  },
  stockCardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  stockTracking: { fontSize: 14, fontWeight: '900', color: colors.text, fontFamily: fonts.mono },
  modePill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  modePillSea: { backgroundColor: 'rgba(2,132,199,0.15)' },
  modePillAir: { backgroundColor: 'rgba(56,189,248,0.15)' },
  modePillText: { fontSize: 10, fontWeight: '800' },
  stockOwner: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },

  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusBadgeText: { fontSize: 10, fontWeight: '800' },

  stockDescription: { fontSize: 13, color: colors.text, fontWeight: '600', lineHeight: 18 },
  stockMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: 8,
    borderRadius: 10,
  },
  stockMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stockMetaText: { fontSize: 11, fontWeight: '700', color: colors.textSecondary },

  stockActionsRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  stockActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: `${colors.primary}18`,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: `${colors.primary}30`,
  },
  stockActionBtnText: { color: colors.primary, fontSize: 12, fontWeight: '800' },
  stockActionBtnSecondary: { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.08)' },
  stockActionBtnTextSecondary: { color: colors.textSecondary, fontSize: 12, fontWeight: '700' },

  // General & Tab Styles
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
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalBox: {
    backgroundColor: '#161B26',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 28,
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  modalHeaderIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: `${colors.primary}20`,
    borderWidth: 1,
    borderColor: `${colors.primary}40`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: { fontSize: 18, fontWeight: '900', color: colors.text, letterSpacing: -0.3 },
  modalSubtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  modalCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScroll: { maxHeight: 460 },
  modalScrollContent: { paddingBottom: 16 },

  presetSection: {
    marginBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  presetHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  presetLabel: { fontSize: 12, fontWeight: '700', color: colors.primary },
  presetScroll: { gap: 8 },
  presetChip: {
    backgroundColor: colors.card,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  presetChipText: { fontSize: 12, fontWeight: '600', color: colors.text },

  formSectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 12,
    marginBottom: 8,
  },

  typeSelectorRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  typeCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  typeCardActive: {
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}15`,
  },
  typeCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  typeCardFlag: { fontSize: 16 },
  typeRadio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.textSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeRadioActive: { borderColor: colors.primary },
  typeRadioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  typeCardTitle: { fontSize: 13, fontWeight: '800', color: colors.text },
  typeCardTitleActive: { color: colors.primary },
  typeCardDesc: { fontSize: 10, color: colors.textSecondary, marginTop: 3, lineHeight: 14 },

  modeSelectorRow: { gap: 8, marginBottom: 8 },
  modeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  modeCardSeaActive: {
    backgroundColor: '#0369A1',
    borderColor: '#38BDF8',
  },
  modeCardAirActive: {
    backgroundColor: '#0284C7',
    borderColor: '#7DD3FC',
  },
  modeCardTitle: { fontSize: 13, fontWeight: '800', color: colors.text },
  modeCardSubtitle: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },

  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    marginBottom: 4,
  },
  inputIcon: { marginRight: 10 },
  fieldInput: {
    flex: 1,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 14,
    fontWeight: '500',
  },

  twoColsRow: { flexDirection: 'row', gap: 10, marginTop: 4 },

  modalFooter: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    gap: 8,
  },
  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  dismissBtn: { paddingVertical: 10, alignItems: 'center' },
  dismissBtnText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
});
