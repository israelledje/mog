import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  ChevronLeft,
  Search,
  Ship,
  Plane,
  Package,
  CheckCircle2,
  Box,
  ChevronRight,
  Plus,
  Users,
  X,
  Sparkles,
  MapPin,
  Check,
  Calendar,
  Printer,
  Trash2,
  Scan,
  RefreshCw,
  Layers,
  ArrowRight,
  Eye,
  AlertCircle,
  FileText,
  Phone,
  User,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Toast from 'react-native-toast-message';
import { colisApi, groupagesApi } from '../../src/api/colis';
import { api } from '../../src/api/client';
import type { Groupage, Colis } from '../../src/types';
import { useAuthStore } from '../../src/store/authStore';
import { formatErr } from '../../src/api/client';
import { printContainerThermalLabels, printPackageThermalLabel } from '../../src/utils/thermalPrinter';
import { darkColors as colors, radii, spacing, shadow, fonts } from '../../src/constants/theme';
import QRScanner from '../../src/components/QRScanner';

const containerId = (c: Groupage | any) => c.id || c._id;
const colisIdOf = (c: Colis | any) => c.id || c._id;

const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

function getInitialDepartureDate(offsetDays = 5): string {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return d.toISOString().split('T')[0];
}

function computeDaysFromToday(dateStr: string): number {
  if (!dateStr) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + (dateStr.includes('T') ? '' : 'T12:00:00Z'));
  target.setHours(0, 0, 0, 0);
  const diff = Math.ceil((target.getTime() - today.getTime()) / 86400000);
  return Math.max(0, diff);
}

type MainTab = 'containers' | 'assign';
type PickMode = 'tracking' | 'client';

export default function GroupageScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const canCreate = user?.role === 'admin' || user?.role === 'operator';

  // Navigation tabs
  const [activeTab, setActiveTab] = useState<MainTab>('containers');

  // Containers
  const [containers, setContainers] = useState<Groupage[]>([]);
  const [loadingContainers, setLoadingContainers] = useState(true);

  // Inspector / Detail of a Container
  const [inspectedContainer, setInspectedContainer] = useState<any | null>(null);
  const [containerPackages, setContainerPackages] = useState<any[]>([]);
  const [loadingPkgList, setLoadingPkgList] = useState(false);

  // Assign flow
  const [pickMode, setPickMode] = useState<PickMode>('tracking');
  const [search, setSearch] = useState('');
  const [selectedColis, setSelectedColis] = useState<Colis | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [recentColis, setRecentColis] = useState<Colis[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);

  // Mode Client
  const [clientQ, setClientQ] = useState('');
  const [clientResults, setClientResults] = useState<any[]>([]);
  const [selectedClient, setSelectedClient] = useState<any | null>(null);
  const [clientPackages, setClientPackages] = useState<Colis[]>([]);

  // Create Container Modal
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    container_number: '',
    destination_city: 'Douala',
    mode: 'sea',
    is_express: false,
    origin_port: 'Guangzhou',
    vessel_name: '',
    departure_date: getInitialDepartureDate(5),
  });

  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());

  const remainingDays = useMemo(() => computeDaysFromToday(form.departure_date), [form.departure_date]);

  const calendarDays = useMemo(() => {
    const firstDay = new Date(calendarYear, calendarMonth, 1);
    const lastDay = new Date(calendarYear, calendarMonth + 1, 0);
    const totalDays = lastDay.getDate();
    let startIdx = firstDay.getDay() - 1;
    if (startIdx < 0) startIdx = 6;

    const days: Array<{ day: number; dateStr: string; isPast: boolean; isToday: boolean; isSelected: boolean } | null> = [];
    for (let i = 0; i < startIdx; i++) days.push(null);

    const todayStr = new Date().toISOString().split('T')[0];
    for (let d = 1; d <= totalDays; d++) {
      const mStr = String(calendarMonth + 1).padStart(2, '0');
      const dStr = String(d).padStart(2, '0');
      const dateStr = `${calendarYear}-${mStr}-${dStr}`;
      const isPast = dateStr < todayStr;
      const isToday = dateStr === todayStr;
      const isSelected = form.departure_date === dateStr;
      days.push({ day: d, dateStr, isPast, isToday, isSelected });
    }
    return days;
  }, [calendarYear, calendarMonth, form.departure_date]);

  const fetchContainers = useCallback(async () => {
    setLoadingContainers(true);
    try {
      const res = await groupagesApi.list();
      setContainers(res || []);
    } catch (e) {
      console.error('[FETCH_CONTAINERS_ERR]', e);
    } finally {
      setLoadingContainers(false);
    }
  }, []);

  const fetchRecentColis = useCallback(async () => {
    setLoadingRecent(true);
    try {
      const list = await colisApi.list({ status: 'received' });
      setRecentColis(list.filter((c: any) => !c.container_id));
    } catch (e) {
      console.error('[FETCH_RECENT_COLIS_ERR]', e);
    } finally {
      setLoadingRecent(false);
    }
  }, []);

  useEffect(() => {
    fetchContainers();
    fetchRecentColis();
  }, [fetchContainers, fetchRecentColis]);

  // Open Container Detail
  const openContainerDetail = async (c: any) => {
    setInspectedContainer(c);
    setLoadingPkgList(true);
    try {
      const cid = containerId(c);
      const res = await api.get(`/groupages/${cid}/colis`);
      setContainerPackages(res.data || []);
    } catch (err) {
      console.error('[CONTAINER_PKGS_ERR]', err);
      setContainerPackages([]);
    } finally {
      setLoadingPkgList(false);
    }
  };

  // Remove package from container
  const handleRemovePackage = async (packageId: string, trackingNumber: string) => {
    if (!inspectedContainer) return;
    const cid = containerId(inspectedContainer);

    Alert.alert(
      'Retirer du groupage',
      `Voulez-vous retirer le colis ${trackingNumber} de ce conteneur ?\nIl sera remis en stock entrepôt (statut 'reçu').`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Oui, Retirer',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/groupages/${cid}/remove-package/${packageId}`);
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Toast.show({ type: 'success', text1: 'Colis retiré du conteneur', text2: trackingNumber });
              // Refresh container packages list
              setContainerPackages((prev) => prev.filter((p) => (p.id || p._id) !== packageId));
              fetchContainers();
              fetchRecentColis();
            } catch (err: any) {
              const msg = err.response?.data?.detail || 'Erreur lors du retrait';
              Alert.alert('Erreur', msg);
            }
          },
        },
      ]
    );
  };

  // Search & assign
  const onSearch = async () => {
    if (!search.trim()) return;
    try {
      const list = await colisApi.list({ tracking_number: search.trim() });
      if (list.length > 0) {
        setSelectedColis(list[0]);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } else {
        Alert.alert('Introuvable', `Aucun colis trouvé avec le numéro "${search.trim()}".`);
      }
    } catch {
      Alert.alert('Erreur', 'Impossible de récupérer ce colis.');
    }
  };

  const onAssign = async (container: Groupage) => {
    const cid = containerId(container);
    setAssigning(cid);
    try {
      if (pickMode === 'tracking' && selectedColis) {
        const pid = colisIdOf(selectedColis);
        await groupagesApi.addPackage(cid, pid);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Toast.show({
          type: 'success',
          text1: 'Colis affecté au groupage !',
          text2: `${selectedColis.tracking_number} → ${container.container_number}`,
        });
        setSelectedColis(null);
        setSearch('');
      } else if (pickMode === 'client' && selectedIds.size > 0) {
        const ids = Array.from(selectedIds);
        let successCount = 0;
        for (const pid of ids) {
          try {
            await groupagesApi.addPackage(cid, pid);
            successCount++;
          } catch {}
        }
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Toast.show({
          type: 'success',
          text1: `${successCount} colis affectés !`,
          text2: `Conteneur ${container.container_number}`,
        });
        setSelectedIds(new Set());
        if (selectedClient) pickClient(selectedClient);
      }
      fetchContainers();
      fetchRecentColis();
    } catch (e: any) {
      Alert.alert(t('errors.server'), formatErr(e, 'Impossible d\'affecter le colis.'));
    } finally {
      setAssigning(null);
    }
  };

  const searchClients = async (q: string) => {
    setClientQ(q);
    if (!q.trim()) {
      setClientResults([]);
      return;
    }
    try {
      const users = await colisApi.searchUsers(q.trim());
      setClientResults(users);
    } catch {}
  };

  const pickClient = async (cust: any) => {
    setSelectedClient(cust);
    setClientResults([]);
    try {
      const list = await colisApi.list({ owner_id: cust.email, status: 'received' });
      const unassigned = list.filter((c: any) => !c.container_id);
      setClientPackages(unassigned);
      setSelectedIds(new Set(unassigned.map((p: any) => String(colisIdOf(p)))));
    } catch {}
  };

  const handleCreateContainer = async () => {
    if (!form.container_number.trim()) {
      return Alert.alert('Information requise', 'Veuillez renseigner le numéro du conteneur.');
    }
    setCreating(true);
    try {
      await groupagesApi.create({
        container_number: form.container_number.trim().toUpperCase(),
        destination_city: form.destination_city,
        mode: form.mode,
        is_express: form.is_express,
        origin_port: form.origin_port,
        vessel_name: form.vessel_name.trim() || undefined,
        departure_date: form.departure_date,
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Toast.show({
        type: 'success',
        text1: 'Groupage créé avec succès !',
        text2: form.container_number.toUpperCase(),
      });
      setShowCreate(false);
      setForm({
        container_number: '',
        destination_city: 'Douala',
        mode: 'sea',
        is_express: false,
        origin_port: 'Guangzhou',
        vessel_name: '',
        departure_date: getInitialDepartureDate(5),
      });
      fetchContainers();
    } catch (e: any) {
      Alert.alert(t('errors.server'), formatErr(e, 'Impossible de créer le conteneur.'));
    } finally {
      setCreating(false);
    }
  };

  const hasSelection = pickMode === 'tracking' ? !!selectedColis : selectedIds.size > 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Expéditions & Groupages</Text>
          <Text style={styles.headerSubtitle}>Lots, affectation des colis & étiquettes</Text>
        </View>
        {canCreate && (
          <TouchableOpacity
            style={styles.newGroupageBtn}
            onPress={() => setShowCreate(true)}
            activeOpacity={0.8}
          >
            <Plus size={16} color="#fff" />
            <Text style={styles.newGroupageBtnText}>Nouveau</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Main Mode Tabs */}
      <View style={styles.mainTabs}>
        <TouchableOpacity
          style={[styles.mainTab, activeTab === 'containers' && styles.mainTabActive]}
          onPress={() => setActiveTab('containers')}
        >
          <Layers size={16} color={activeTab === 'containers' ? '#fff' : colors.textMuted} />
          <Text style={[styles.mainTabText, activeTab === 'containers' && { color: '#fff' }]}>
            Groupages Actifs ({containers.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.mainTab, activeTab === 'assign' && styles.mainTabActive]}
          onPress={() => setActiveTab('assign')}
        >
          <Package size={16} color={activeTab === 'assign' ? '#fff' : colors.textMuted} />
          <Text style={[styles.mainTabText, activeTab === 'assign' && { color: '#fff' }]}>
            Affecter des Colis
          </Text>
        </TouchableOpacity>
      </View>

      {/* TAB 1: GROUPAGES ACTIFS */}
      {activeTab === 'containers' && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.md, paddingBottom: 60 }}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeading}>Conteneurs & Lots Ouverts</Text>
            <TouchableOpacity onPress={fetchContainers} disabled={loadingContainers}>
              <Text style={styles.refreshLink}>Actualiser</Text>
            </TouchableOpacity>
          </View>

          {loadingContainers ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
          ) : containers.length === 0 ? (
            <View style={styles.emptyCard}>
              <Box size={44} color={colors.textMuted} style={{ opacity: 0.4, marginBottom: 12 }} />
              <Text style={styles.emptyTitle}>Aucun groupage ouvert</Text>
              <Text style={styles.emptySub}>
                Créez votre premier lot maritime ou aérien pour y affecter des colis.
              </Text>
              {canCreate && (
                <TouchableOpacity style={styles.emptyBtn} onPress={() => setShowCreate(true)}>
                  <Plus size={16} color="#fff" />
                  <Text style={styles.emptyBtnText}>Créer un groupage</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            containers.map((c) => {
              const cid = containerId(c);
              const isAir = c.mode === 'air' || (c as any).transport_mode === 'air' || c.is_express;
              const count = c.packages_ids?.length || 0;

              return (
                <TouchableOpacity
                  key={cid}
                  style={styles.containerCard}
                  onPress={() => openContainerDetail(c)}
                  activeOpacity={0.85}
                >
                  <View style={styles.containerCardTop}>
                    <View style={[styles.modeIconBadge, isAir ? styles.modeAir : styles.modeSea]}>
                      {isAir ? <Plane size={20} color="#0ea5e9" /> : <Ship size={20} color={colors.primary} />}
                    </View>

                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.containerNum}>{c.container_number}</Text>
                        {c.is_express && (
                          <View style={styles.expressBadge}>
                            <Text style={styles.expressBadgeText}>EXPRESS</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.containerRoute}>
                        {c.origin_port || (c as any).origin_city || 'Guangzhou'} → {c.destination_city || 'Douala'}
                      </Text>
                    </View>

                    <View style={styles.statusPill}>
                      <Text style={styles.statusPillText}>{c.status}</Text>
                    </View>
                  </View>

                  {/* Stats & Actions Row */}
                  <View style={styles.containerCardBottom}>
                    <View style={styles.statGroup}>
                      <Package size={14} color={colors.primary} />
                      <Text style={styles.statValue}>{count} colis chargés</Text>
                    </View>

                    {c.departure_date && (
                      <View style={styles.statGroup}>
                        <Calendar size={14} color={colors.textMuted} />
                        <Text style={styles.statMuted}>Départ: {formatPrettyDate(c.departure_date)}</Text>
                      </View>
                    )}

                    <View style={styles.cardActionsRow}>
                      <TouchableOpacity
                        style={styles.printBatchBtn}
                        onPress={(e) => {
                          e.stopPropagation?.();
                          printContainerThermalLabels(cid, c.container_number);
                        }}
                        title="Imprimer toutes les étiquettes QR du conteneur"
                      >
                        <Printer size={15} color="#fff" />
                        <Text style={styles.printBatchText}>Étiquettes ({count})</Text>
                      </TouchableOpacity>

                      <View style={styles.detailsChevron}>
                        <ChevronRight size={18} color={colors.textSecondary} />
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}

      {/* TAB 2: AFFECTER DES COLIS */}
      {activeTab === 'assign' && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.md, paddingBottom: 60 }}>
          {/* Sub-modes */}
          <View style={styles.subTabs}>
            <TouchableOpacity
              style={[styles.subTab, pickMode === 'tracking' && styles.subTabActive]}
              onPress={() => setPickMode('tracking')}
            >
              <Package size={14} color={pickMode === 'tracking' ? '#fff' : colors.textMuted} />
              <Text style={[styles.subTabText, pickMode === 'tracking' && { color: '#fff' }]}>
                Par N° Suivi / Colis
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.subTab, pickMode === 'client' && styles.subTabActive]}
              onPress={() => setPickMode('client')}
            >
              <Users size={14} color={pickMode === 'client' ? '#fff' : colors.textMuted} />
              <Text style={[styles.subTabText, pickMode === 'client' && { color: '#fff' }]}>
                Par Compte Client
              </Text>
            </TouchableOpacity>
          </View>

          {/* STEP 1: Choisir le colis */}
          <Text style={styles.stepTitle}>1. Sélectionner le(s) colis</Text>

          {pickMode === 'tracking' ? (
            <View style={{ marginBottom: spacing.md }}>
              <View style={styles.searchBar}>
                <Search size={18} color={colors.textMuted} style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Saisir tracking (ex: CL-DOU-...)"
                  placeholderTextColor={colors.textMuted}
                  value={search}
                  onChangeText={setSearch}
                  onSubmitEditing={onSearch}
                  autoCapitalize="characters"
                />
                <TouchableOpacity style={styles.scanActionBtn} onPress={() => setScannerOpen(true)}>
                  <Scan size={18} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.okBtn} onPress={onSearch}>
                  <Text style={styles.okBtnText}>OK</Text>
                </TouchableOpacity>
              </View>

              {selectedColis && (
                <View style={styles.selectedColisCard}>
                  <CheckCircle2 size={20} color="#10b981" />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.selectedColisTracking}>{selectedColis.tracking_number}</Text>
                    <Text style={styles.selectedColisDesc}>
                      {selectedColis.description || (selectedColis as any).nature || 'Marchandise'} · {selectedColis.weight_real || 0} kg
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setSelectedColis(null)}>
                    <X size={18} color={colors.danger} />
                  </TouchableOpacity>
                </View>
              )}

              {!selectedColis && (
                <View style={{ marginTop: 10 }}>
                  <Text style={styles.hintHeading}>Colis reçus prêts à être groupés :</Text>
                  {loadingRecent ? (
                    <ActivityIndicator color={colors.primary} style={{ marginTop: 10 }} />
                  ) : recentColis.length === 0 ? (
                    <Text style={styles.emptyHintText}>Aucun colis en attente de groupage.</Text>
                  ) : (
                    recentColis.slice(0, 8).map((c) => (
                      <TouchableOpacity
                        key={colisIdOf(c)}
                        style={styles.colisItemRow}
                        onPress={() => setSelectedColis(c)}
                      >
                        <Box size={18} color={colors.primary} />
                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <Text style={styles.colisItemTracking}>{c.tracking_number}</Text>
                          <Text style={styles.colisItemDesc} numberOfLines={1}>
                            {c.description || (c as any).nature} {c.weight_real ? `· ${c.weight_real} kg` : ''}
                          </Text>
                        </View>
                        <ChevronRight size={16} color={colors.textMuted} />
                      </TouchableOpacity>
                    ))
                  )}
                </View>
              )}
            </View>
          ) : (
            <View style={{ marginBottom: spacing.md }}>
              <View style={styles.searchBar}>
                <Search size={18} color={colors.textMuted} style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Rechercher client (nom, email, code MOG...)"
                  placeholderTextColor={colors.textMuted}
                  value={clientQ}
                  onChangeText={searchClients}
                />
              </View>

              {clientResults.map((cust) => (
                <TouchableOpacity
                  key={cust.id || cust.email}
                  style={styles.colisItemRow}
                  onPress={() => pickClient(cust)}
                >
                  <User size={18} color={colors.secondary} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.colisItemTracking}>
                      {cust.client_code ? `[${cust.client_code}] ` : ''}{cust.full_name || cust.email}
                    </Text>
                    <Text style={styles.colisItemDesc}>{cust.phone || cust.email}</Text>
                  </View>
                  <ChevronRight size={16} color={colors.textMuted} />
                </TouchableOpacity>
              ))}

              {selectedClient && (
                <View style={styles.selectedClientSection}>
                  <Text style={styles.selectedClientTitle}>
                    Colis de {selectedClient.full_name || selectedClient.email} ({clientPackages.length})
                  </Text>
                  {clientPackages.map((p) => {
                    const pid = String(colisIdOf(p));
                    const isSelected = selectedIds.has(pid);
                    return (
                      <TouchableOpacity
                        key={pid}
                        style={[styles.colisItemRow, isSelected && styles.colisRowChecked]}
                        onPress={() => {
                          const next = new Set(selectedIds);
                          if (isSelected) next.delete(pid);
                          else next.add(pid);
                          setSelectedIds(next);
                        }}
                      >
                        <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
                          {isSelected && <Check size={12} color="#fff" />}
                        </View>
                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <Text style={styles.colisItemTracking}>{p.tracking_number}</Text>
                          <Text style={styles.colisItemDesc}>
                            {p.description} {p.weight_real ? `· ${p.weight_real} kg` : ''}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {/* STEP 2: Choisir le conteneur de destination */}
          <Text style={styles.stepTitle}>2. Choisir le groupage de destination</Text>

          {!hasSelection && (
            <View style={styles.warnBox}>
              <AlertCircle size={16} color={colors.warning} />
              <Text style={styles.warnBoxText}>
                Sélectionnez d'abord un ou plusieurs colis à l'étape 1.
              </Text>
            </View>
          )}

          {containers.map((item) => {
            const cid = containerId(item);
            const isAssigning = assigning === cid;
            const canTap = hasSelection && !isAssigning;
            const isAir = item.mode === 'air' || (item as any).transport_mode === 'air';

            return (
              <TouchableOpacity
                key={cid}
                style={[styles.containerCard, !canTap && { opacity: 0.6 }]}
                disabled={!canTap}
                onPress={() => onAssign(item)}
                activeOpacity={0.8}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={[styles.modeIconBadge, isAir ? styles.modeAir : styles.modeSea]}>
                    {isAir ? <Plane size={20} color="#0ea5e9" /> : <Ship size={20} color={colors.primary} />}
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.containerNum}>{item.container_number}</Text>
                    <Text style={styles.containerRoute}>
                      {item.origin_port || 'Guangzhou'} → {item.destination_city || 'Douala'} · {item.packages_ids?.length || 0} colis
                    </Text>
                  </View>
                  <View style={styles.assignActionBadge}>
                    <Text style={styles.assignActionBadgeText}>Charger ici</Text>
                    <ArrowRight size={12} color="#fff" style={{ marginLeft: 4 }} />
                  </View>
                </View>
                {isAssigning && <ActivityIndicator color={colors.primary} style={{ marginTop: 8 }} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* MODAL: INSPECTEUR & DÉTAIL D'UN GROUPAGE */}
      <Modal visible={!!inspectedContainer} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={styles.inspectorCard}>
            {/* Inspector Header */}
            {inspectedContainer && (
              <View style={styles.inspectorHeader}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.inspectorTitle}>{inspectedContainer.container_number}</Text>
                    <View style={styles.statusPill}>
                      <Text style={styles.statusPillText}>{inspectedContainer.status}</Text>
                    </View>
                  </View>
                  <Text style={styles.inspectorRoute}>
                    {inspectedContainer.origin_port || 'Guangzhou'} → {inspectedContainer.destination_city || 'Douala'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.closeModalBtn}
                  onPress={() => setInspectedContainer(null)}
                >
                  <X size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            )}

            {/* Inspector Action Bar */}
            {inspectedContainer && (
              <View style={styles.inspectorActionBar}>
                <TouchableOpacity
                  style={styles.inspectorPrintAllBtn}
                  onPress={() =>
                    printContainerThermalLabels(
                      containerId(inspectedContainer),
                      inspectedContainer.container_number
                    )
                  }
                >
                  <Printer size={16} color="#fff" />
                  <Text style={styles.inspectorPrintAllText}>
                    Imprimer toutes les étiquettes ({containerPackages.length})
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* List of packages in this container */}
            <View style={styles.inspectorListWrap}>
              <Text style={styles.inspectorListTitle}>
                Colis dans ce groupage ({containerPackages.length}) :
              </Text>

              {loadingPkgList ? (
                <ActivityIndicator color={colors.primary} style={{ marginTop: 30 }} />
              ) : containerPackages.length === 0 ? (
                <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                  <Package size={36} color={colors.textMuted} style={{ opacity: 0.5, marginBottom: 8 }} />
                  <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: '600' }}>
                    Aucun colis affecté à ce conteneur
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={containerPackages}
                  keyExtractor={(item) => item.id || item._id}
                  renderItem={({ item }) => {
                    const pid = item.id || item._id;
                    return (
                      <View style={styles.pkgRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.pkgRowTracking}>{item.tracking_number}</Text>
                          <Text style={styles.pkgRowDesc} numberOfLines={1}>
                            {item.description || 'Marchandise'} · {item.weight_real || item.weight_estimated || 0} kg
                          </Text>
                          <Text style={styles.pkgRowCustomer} numberOfLines={1}>
                            👤 {item.customer_code ? `[${item.customer_code}] ` : ''}{item.customer_name || item.owner_id}
                          </Text>
                        </View>

                        {/* Action buttons */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <TouchableOpacity
                            style={styles.pkgPrintBtn}
                            onPress={() => printPackageThermalLabel(pid, item.tracking_number)}
                            title="Imprimer ticket QR (80mm)"
                          >
                            <Printer size={15} color={colors.primary} />
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.pkgDeleteBtn}
                            onPress={() => handleRemovePackage(pid, item.tracking_number)}
                            title="Retirer du groupage"
                          >
                            <Trash2 size={15} color={colors.danger} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  }}
                />
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL: CRÉER UN NOUVEAU GROUPAGE */}
      <Modal visible={showCreate} animationType="slide" transparent onRequestClose={() => setShowCreate(false)}>
        <View style={styles.modalBg}>
          <View style={styles.createCard}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Nouveau Groupage / Conteneur</Text>
              <TouchableOpacity onPress={() => setShowCreate(false)}>
                <X size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 500 }} keyboardShouldPersistTaps="handled">
              {/* Mode Selection */}
              <Text style={styles.fieldLabel}>Mode d'Expédition</Text>
              <View style={styles.modeGrid}>
                {[
                  { mode: 'sea', label: 'Maritime (45j)', icon: Ship },
                  { mode: 'air', label: 'Aérien (5-7j)', icon: Plane },
                  { mode: 'air_express', label: 'Express (2-3j)', icon: Sparkles },
                ].map((m) => {
                  const Icon = m.icon;
                  const isSelected = form.mode === m.mode;
                  return (
                    <TouchableOpacity
                      key={m.mode}
                      style={[styles.modeSelectBtn, isSelected && styles.modeSelectBtnActive]}
                      onPress={() => setForm({ ...form, mode: m.mode, is_express: m.mode === 'air_express' })}
                    >
                      <Icon size={18} color={isSelected ? '#fff' : colors.textMuted} />
                      <Text style={[styles.modeSelectText, isSelected && { color: '#fff' }]}>{m.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Number Input */}
              <Text style={styles.fieldLabel}>Numéro du Conteneur / Lot</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Ex: CONT-2026-09-001"
                placeholderTextColor={colors.textMuted}
                value={form.container_number}
                onChangeText={(t) => setForm({ ...form, container_number: t })}
                autoCapitalize="characters"
              />

              {/* Route */}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Port Départ</Text>
                  <TextInput
                    style={styles.formInput}
                    value={form.origin_port}
                    onChangeText={(t) => setForm({ ...form, origin_port: t })}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Destination</Text>
                  <TextInput
                    style={styles.formInput}
                    value={form.destination_city}
                    onChangeText={(t) => setForm({ ...form, destination_city: t })}
                  />
                </View>
              </View>

              {/* Departure Date */}
              <Text style={styles.fieldLabel}>Date de Départ Estimée</Text>
              <TextInput
                style={styles.formInput}
                value={form.departure_date}
                onChangeText={(t) => setForm({ ...form, departure_date: t })}
                placeholder="AAAA-MM-JJ"
              />

              <TouchableOpacity
                style={styles.submitCreateBtn}
                onPress={handleCreateContainer}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitCreateText}>Créer le Groupage</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* QR Scanner Modal for Search */}
      <Modal visible={scannerOpen} animationType="slide">
        <QRScanner
          onScan={(data) => {
            setScannerOpen(false);
            setSearch(data);
            colisApi.list({ tracking_number: data.trim() }).then((list) => {
              if (list.length > 0) setSelectedColis(list[0]);
            });
          }}
          onClose={() => setScannerOpen(false)}
          hint="Scannez le QR Code du colis"
        />
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    padding: 8,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
  },
  headerTitleWrap: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  newGroupageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.primary,
    borderRadius: radii.md,
  },
  newGroupageBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  mainTabs: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    padding: 4,
    margin: spacing.md,
    marginBottom: spacing.xs,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  mainTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: radii.md,
  },
  mainTabActive: {
    backgroundColor: colors.primary,
  },
  mainTabText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionHeading: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  refreshLink: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  containerCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  containerCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modeIconBadge: {
    width: 42,
    height: 42,
    borderRadius: radii.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modeAir: {
    backgroundColor: 'rgba(14, 165, 233, 0.15)',
  },
  modeSea: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
  },
  containerNum: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  expressBadge: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  expressBadgeText: {
    color: '#000',
    fontSize: 9,
    fontWeight: '900',
  },
  containerRoute: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  statusPillText: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  containerCardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  statGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  statMuted: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  printBatchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radii.sm,
  },
  printBatchText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  detailsChevron: {
    padding: 2,
  },
  subTabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: spacing.md,
  },
  subTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  subTabActive: {
    backgroundColor: colors.secondary,
    borderColor: colors.secondary,
  },
  subTabText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  stepTitle: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingHorizontal: 10,
    height: 44,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  scanActionBtn: {
    padding: 6,
  },
  okBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.sm,
    marginLeft: 4,
  },
  okBtnText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  selectedColisCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderRadius: radii.md,
    padding: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  selectedColisTracking: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
    fontFamily: fonts.mono,
  },
  selectedColisDesc: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  hintHeading: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptyHintText: {
    color: colors.textMuted,
    fontSize: 12,
    fontStyle: 'italic',
  },
  colisItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: 10,
    borderRadius: radii.md,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  colisRowChecked: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  colisItemTracking: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  colisItemDesc: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  selectedClientSection: {
    marginTop: 10,
  },
  selectedClientTitle: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 8,
  },
  warnBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    padding: 10,
    borderRadius: radii.md,
    marginBottom: 10,
  },
  warnBoxText: {
    color: '#f59e0b',
    fontSize: 11,
    fontWeight: '700',
  },
  assignActionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.sm,
  },
  assignActionBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  emptyCard: {
    paddingVertical: 40,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 6,
  },
  emptySub: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 16,
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radii.md,
  },
  emptyBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  inspectorCard: {
    width: '100%',
    maxHeight: '85%',
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inspectorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  inspectorTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
  },
  inspectorRoute: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  closeModalBtn: {
    padding: 6,
    borderRadius: radii.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  inspectorActionBar: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  inspectorPrintAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#10b981',
    paddingVertical: 10,
    borderRadius: radii.md,
  },
  inspectorPrintAllText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  inspectorListWrap: {
    flex: 1,
    paddingTop: 10,
  },
  inspectorListTitle: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  pkgRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    padding: 10,
    borderRadius: radii.md,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  pkgRowTracking: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
    fontFamily: fonts.mono,
  },
  pkgRowDesc: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  pkgRowCustomer: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  pkgPrintBtn: {
    padding: 8,
    borderRadius: radii.sm,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
  },
  pkgDeleteBtn: {
    padding: 8,
    borderRadius: radii.sm,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  createCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  fieldLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
    marginTop: 8,
  },
  modeGrid: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  modeSelectBtn: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 10,
    borderRadius: radii.md,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  modeSelectBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  modeSelectText: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  formInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  submitCreateBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: radii.md,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 10,
  },
  submitCreateText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
});
