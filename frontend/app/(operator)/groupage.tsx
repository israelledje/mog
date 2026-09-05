import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Alert, ActivityIndicator, ScrollView, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  ChevronLeft, Search, Ship, Plane, Package, CheckCircle2, Box, ChevronRight, Plus, Users,
  X, Sparkles, MapPin, Navigation, Check, Zap, Calendar,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Toast from 'react-native-toast-message';
import { colisApi, groupagesApi } from '../../src/api/colis';
import type { Groupage, Colis } from '../../src/types';
import { useAuthStore } from '../../src/store/authStore';
import { formatErr } from '../../src/api/client';
import { darkColors as colors, radii, spacing, shadow, fonts } from '../../src/constants/theme';

const containerId = (c: Groupage) => c.id || (c as any)._id;
const colisIdOf = (c: Colis) => c.id || (c as any)._id;

const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];
const DAY_SHORT_NAMES = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

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

function formatPrettyDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T12:00:00Z'));
  if (Number.isNaN(d.getTime())) return dateStr;
  const day = d.getDate();
  const month = MONTH_NAMES[d.getMonth()];
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

type PickMode = 'tracking' | 'client';

export default function GroupageScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const canCreate = user?.role === 'admin' || user?.role === 'operator';
  const [pickMode, setPickMode] = useState<PickMode>('tracking');
  const [search, setSearch] = useState('');
  const [selectedColis, setSelectedColis] = useState<Colis | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [recentColis, setRecentColis] = useState<Colis[]>([]);
  const [containers, setContainers] = useState<Groupage[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [assigning, setAssigning] = useState<string | null>(null);
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
  const [calendarOpen, setCalendarOpen] = useState(true);

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

  // Mode client
  const [clientQ, setClientQ] = useState('');
  const [clientResults, setClientResults] = useState<any[]>([]);
  const [selectedClient, setSelectedClient] = useState<any | null>(null);
  const [clientPackages, setClientPackages] = useState<Colis[]>([]);

  const loadData = useCallback(async () => {
    setLoadingRecent(true);
    try {
      const [allPackages, allContainers] = await Promise.all([
        colisApi.list({ limit: 100 }),
        groupagesApi.list(),
      ]);
      const assignable = allPackages.filter(
        (c) => ['received', 'damaged'].includes(c.status) && !c.container_id,
      );
      setRecentColis(assignable);
      setContainers(allContainers.filter((c) => c.status === 'open'));
    } catch {
      Alert.alert(t('errors.server'), t('operator.load_error'));
    } finally {
      setLoadingRecent(false);
    }
  }, [t]);

  useEffect(() => { loadData(); }, [loadData]);

  const selectionCount = pickMode === 'client' ? selectedIds.size : (selectedColis ? 1 : 0);
  const hasSelection = selectionCount > 0;

  const packagesToAssign = useMemo(() => {
    if (pickMode === 'tracking') {
      return selectedColis ? [selectedColis] : [];
    }
    return clientPackages.filter((c) => selectedIds.has(String(colisIdOf(c))));
  }, [pickMode, selectedColis, clientPackages, selectedIds]);

  const selectColis = (c: Colis) => {
    setSelectedColis(c);
    setSearch(c.tracking_number);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const onSearch = async () => {
    if (!search.trim()) return;
    setLoading(true);
    try {
      const res = await colisApi.list({ tracking_number: search.trim() });
      const match = res.find((c) => !c.container_id) || res[0];
      if (match) {
        if (match.container_id) {
          Alert.alert(t('operator.already_grouped'), t('operator.already_grouped_msg'));
          return;
        }
        selectColis(match);
      } else {
        Alert.alert(t('operator.not_found'), t('operator.no_colis_found'));
      }
    } catch {
      Alert.alert(t('errors.server'), t('operator.search_impossible'));
    } finally {
      setLoading(false);
    }
  };

  const searchClients = async (q: string) => {
    setClientQ(q);
    setSelectedClient(null);
    setClientPackages([]);
    setSelectedIds(new Set());
    try {
      const res = await colisApi.searchUsers(q.trim());
      setClientResults(Array.isArray(res) ? res : []);
    } catch {
      setClientResults([]);
    }
  };

  const pickClient = async (c: any) => {
    setSelectedClient(c);
    setClientResults([]);
    setClientQ(c.full_name || c.email || '');
    setLoading(true);
    try {
      const pkgs = await colisApi.list({ owner_id: c.email, limit: 100 });
      const assignable = (Array.isArray(pkgs) ? pkgs : []).filter(
        (p) => ['received', 'damaged'].includes(p.status) && !p.container_id,
      );
      setClientPackages(assignable);
      setSelectedIds(new Set(assignable.map((p) => String(colisIdOf(p)))));
    } catch (e: any) {
      Toast.show({ type: 'error', text1: formatErr(e, 'Colis client') });
      setClientPackages([]);
    } finally {
      setLoading(false);
    }
  };

  const togglePkg = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onAssign = (container: Groupage) => {
    if (!packagesToAssign.length) {
      Alert.alert('', pickMode === 'client' ? 'Sélectionnez au moins un colis du client' : t('operator.groupage_scan'));
      return;
    }
    const cid = containerId(container);
    if (!cid) {
      Alert.alert(t('errors.server'), t('operator.missing_id'));
      return;
    }

    const label = packagesToAssign.length === 1
      ? packagesToAssign[0].tracking_number
      : `${packagesToAssign.length} colis`;

    Alert.alert(
      t('operator.groupage_assign'),
      `${label} → ${container.container_number || cid.slice(0, 8)} ?`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.confirm'),
          onPress: async () => {
            setAssigning(cid);
            try {
              let ok = 0;
              const errors: string[] = [];
              for (const pkg of packagesToAssign) {
                const pkgId = colisIdOf(pkg);
                if (!pkgId) continue;
                try {
                  await groupagesApi.addPackage(cid, pkgId);
                  ok += 1;
                } catch (e: any) {
                  errors.push(pkg.tracking_number || pkgId);
                }
              }
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              if (errors.length) {
                Alert.alert('Partiel', `${ok} ajouté(s), échec : ${errors.join(', ')}`);
              } else {
                Alert.alert('OK', `${ok} colis ajouté(s) au groupage`, [
                  {
                    text: 'OK', onPress: () => {
                      setSelectedColis(null);
                      setSelectedIds(new Set());
                      setSelectedClient(null);
                      setClientPackages([]);
                      setSearch('');
                      loadData();
                    }
                  },
                ]);
              }
            } catch (e: any) {
              const msg = e?.response?.data?.detail || e?.message || t('operator.save_failed');
              Alert.alert(t('errors.server'), String(msg));
            } finally {
              setAssigning(null);
            }
          },
        },
      ],
    );
  };

  const createGroupage = async () => {
    if (!form.container_number.trim()) {
      Toast.show({ type: 'error', text1: 'N° conteneur requis' });
      return;
    }
    setCreating(true);
    try {
      const days = parseInt(form.departure_days || '5', 10);
      const depDate = new Date(Date.now() + days * 86400000).toISOString();
      const estDays = form.mode === 'sea' ? days + 30 : (form.is_express ? days + 3 : days + 7);
      const estArrival = new Date(Date.now() + estDays * 86400000).toISOString();

      await groupagesApi.create({
        container_number: form.container_number.trim(),
        destination_city: form.destination_city.trim() || 'Douala',
        mode: form.mode,
        is_express: form.mode === 'air' ? form.is_express : false,
        origin_port: form.origin_port.trim() || 'Guangzhou',
        vessel_name: form.vessel_name.trim() || undefined,
        departure_date: depDate,
        estimated_arrival: estArrival,
      });
      setShowCreate(false);
      setForm({
        container_number: '',
        destination_city: 'Douala',
        mode: 'sea',
        is_express: false,
        origin_port: 'Guangzhou',
        vessel_name: '',
        departure_days: '5',
      });
      loadData();
      Toast.show({ type: 'success', text1: 'Groupage créé avec succès' });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: formatErr(e, 'Création impossible') });
    } finally {
      setCreating(false);
    }
  };

  const switchMode = (m: PickMode) => {
    setPickMode(m);
    setSelectedColis(null);
    setSelectedIds(new Set());
    setSearch('');
    setSelectedClient(null);
    setClientPackages([]);
    setClientQ('');
    setClientResults([]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <ChevronLeft size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('operator.groupage_title')}</Text>
        {canCreate ? (
          <TouchableOpacity
            onPress={() => setShowCreate(true)}
            style={styles.headerNewBtn}
            activeOpacity={0.8}
          >
            <Plus size={16} color="#fff" />
            <Text style={styles.headerNewBtnText}>Nouveau</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={loadData} style={styles.back}>
            <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 12 }}>{t('operator.refresh')}</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View style={styles.modeTabs}>
          <TouchableOpacity
            style={[styles.modeTab, pickMode === 'tracking' && styles.modeTabOn]}
            onPress={() => switchMode('tracking')}
          >
            <Package size={16} color={pickMode === 'tracking' ? '#fff' : colors.textSecondary} />
            <Text style={[styles.modeTabText, pickMode === 'tracking' && { color: '#fff' }]}>Par tracking</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeTab, pickMode === 'client' && styles.modeTabOn]}
            onPress={() => switchMode('client')}
          >
            <Users size={16} color={pickMode === 'client' ? '#fff' : colors.textSecondary} />
            <Text style={[styles.modeTabText, pickMode === 'client' && { color: '#fff' }]}>Par client</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.stepLabel}>
            1. {pickMode === 'client' ? 'Choisir un client et ses colis' : t('operator.groupage_scan')}
          </Text>

          {pickMode === 'tracking' ? (
            <>
              <View style={styles.searchRow}>
                <Search size={18} color={colors.textSecondary} />
                <TextInput
                  style={styles.searchInput}
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Tracking / Shipping Mark"
                  placeholderTextColor={colors.textSecondary}
                  onSubmitEditing={onSearch}
                  returnKeyType="search"
                />
                <TouchableOpacity style={styles.searchBtn} onPress={onSearch} disabled={loading}>
                  {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.searchBtnText}>OK</Text>}
                </TouchableOpacity>
              </View>

              {selectedColis && (
                <View style={styles.selectedColis}>
                  <CheckCircle2 size={18} color={colors.success} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.selectedText}>{selectedColis.tracking_number}</Text>
                    <Text style={styles.selectedSub}>{selectedColis.description || selectedColis.nature || '—'}</Text>
                  </View>
                  <TouchableOpacity onPress={() => { setSelectedColis(null); setSearch(''); }}>
                    <Text style={{ color: colors.danger, fontWeight: '700', fontSize: 12 }}>✕</Text>
                  </TouchableOpacity>
                </View>
              )}

              {!selectedColis && (
                <>
                  <Text style={styles.hint}>Colis réceptionnés disponibles :</Text>
                  {loadingRecent ? (
                    <ActivityIndicator color={colors.primary} style={{ marginTop: 12 }} />
                  ) : recentColis.length === 0 ? (
                    <Text style={styles.emptyHint}>Aucun colis reçu en attente de groupage.</Text>
                  ) : (
                    recentColis.slice(0, 10).map((c) => (
                      <TouchableOpacity key={colisIdOf(c)} style={styles.colisRow} onPress={() => selectColis(c)}>
                        <Box size={18} color={colors.primary} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.colisTracking}>{c.tracking_number}</Text>
                          <Text style={styles.colisDesc} numberOfLines={1}>{c.description || c.nature}</Text>
                        </View>
                        <ChevronRight size={18} color={colors.textSecondary} />
                      </TouchableOpacity>
                    ))
                  )}
                </>
              )}
            </>
          ) : (
            <>
              <View style={styles.searchRow}>
                <Search size={18} color={colors.textSecondary} />
                <TextInput
                  style={styles.searchInput}
                  value={clientQ}
                  onChangeText={searchClients}
                  placeholder="Nom, téléphone, code client…"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
              {clientResults.map((c) => (
                <TouchableOpacity key={c.id || c.email} style={styles.colisRow} onPress={() => pickClient(c)}>
                  <Users size={18} color={colors.secondary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.colisTracking}>{c.full_name || c.email}</Text>
                    <Text style={styles.colisDesc}>{c.phone || c.email} · {c.client_code || ''}</Text>
                  </View>
                </TouchableOpacity>
              ))}

              {selectedClient && (
                <View style={[styles.selectedColis, { marginTop: 8 }]}>
                  <CheckCircle2 size={18} color={colors.success} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.selectedText}>{selectedClient.full_name || selectedClient.email}</Text>
                    <Text style={styles.selectedSub}>
                      {selectedIds.size} / {clientPackages.length} colis sélectionné(s)
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => {
                    setSelectedClient(null);
                    setClientPackages([]);
                    setSelectedIds(new Set());
                    setClientQ('');
                  }}>
                    <Text style={{ color: colors.danger, fontWeight: '700', fontSize: 12 }}>✕</Text>
                  </TouchableOpacity>
                </View>
              )}

              {selectedClient && (
                <>
                  {loading ? (
                    <ActivityIndicator color={colors.primary} style={{ marginTop: 12 }} />
                  ) : clientPackages.length === 0 ? (
                    <Text style={styles.emptyHint}>Aucun colis reçu en attente pour ce client.</Text>
                  ) : (
                    <>
                      <View style={styles.bulkRow}>
                        <TouchableOpacity onPress={() => setSelectedIds(new Set(clientPackages.map((p) => String(colisIdOf(p)))))}>
                          <Text style={styles.bulkLink}>Tout sélectionner</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setSelectedIds(new Set())}>
                          <Text style={styles.bulkLink}>Tout désélectionner</Text>
                        </TouchableOpacity>
                      </View>
                      {clientPackages.map((c) => {
                        const id = String(colisIdOf(c));
                        const on = selectedIds.has(id);
                        return (
                          <TouchableOpacity
                            key={id}
                            style={[styles.colisRow, on && styles.colisRowOn]}
                            onPress={() => togglePkg(id)}
                          >
                            <View style={[styles.check, on && styles.checkOn]}>
                              {on && <Text style={{ color: '#fff', fontWeight: '900', fontSize: 11 }}>✓</Text>}
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.colisTracking}>{c.tracking_number}</Text>
                              <Text style={styles.colisDesc} numberOfLines={1}>{c.description || c.nature}</Text>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </>
                  )}
                </>
              )}
            </>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.stepHeaderRow}>
            <Text style={styles.stepLabel}>2. {t('operator.groupage_select')}</Text>
            {canCreate && (
              <TouchableOpacity
                style={styles.stepNewBtn}
                onPress={() => setShowCreate(true)}
                activeOpacity={0.8}
              >
                <Plus size={14} color={colors.primary} />
                <Text style={styles.stepNewBtnText}>Nouveau conteneur</Text>
              </TouchableOpacity>
            )}
          </View>

          {!hasSelection && (
            <View style={styles.warnBanner}>
              <Text style={styles.warnText}>
                ↑ {pickMode === 'client' ? 'Sélectionnez un client et ses colis' : 'Sélectionnez d\'abord un colis ci-dessus'}
              </Text>
            </View>
          )}
          {hasSelection && selectionCount > 1 && (
            <Text style={styles.hint}>{selectionCount} colis seront ajoutés au conteneur choisi</Text>
          )}

          {containers.length === 0 ? (
            <View style={styles.emptyContainerCard}>
              <Box size={32} color={colors.textSecondary} />
              <Text style={styles.emptyContainerTitle}>Aucun conteneur ouvert</Text>
              <Text style={styles.emptyContainerDesc}>
                Créez un nouveau groupage maritime ou aérien pour y charger vos colis.
              </Text>
              {canCreate && (
                <TouchableOpacity
                  style={styles.emptyCreateBtn}
                  onPress={() => setShowCreate(true)}
                  activeOpacity={0.8}
                >
                  <Plus size={16} color="#fff" />
                  <Text style={styles.emptyCreateBtnText}>Créer un nouveau groupage</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            containers.map((item) => {
              const cid = containerId(item);
              const isAssigning = assigning === cid;
              const canTap = hasSelection && !isAssigning;
              return (
                <TouchableOpacity
                  key={cid}
                  style={[styles.card, !canTap && styles.cardMuted]}
                  onPress={() => canTap && onAssign(item)}
                  activeOpacity={canTap ? 0.7 : 1}
                >
                  <View style={styles.cardRow}>
                    {item.mode === 'sea' || item.transport_mode === 'sea' ? (
                      <Ship size={22} color={colors.secondary} />
                    ) : (
                      <Plane size={22} color={colors.accent} />
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.containerNum}>{item.container_number || cid?.slice(0, 8)}</Text>
                      <Text style={styles.route}>
                        {(item.origin_city || item.origin_port || 'Guangzhou')} → {item.destination_city || 'Douala'}
                      </Text>
                    </View>
                    <View style={styles.badge}>
                      <Package size={12} color={colors.primary} />
                      <Text style={styles.badgeText}>{item.packages_ids?.length ?? 0}</Text>
                    </View>
                    {canTap && <ChevronRight size={20} color={colors.primary} />}
                  </View>
                  {isAssigning && <ActivityIndicator color={colors.primary} style={{ marginTop: 8 }} />}
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* MODALE DE CRÉATION DE GROUPAGE MODERNE & PRO */}
      <Modal
        visible={showCreate}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCreate(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowCreate(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={styles.modalBox}
            onPress={(e) => e.stopPropagation?.()}
          >
            {/* Header */}
            <View style={styles.modalHeaderRow}>
              <View style={styles.modalHeaderIconBadge}>
                <Box size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Nouveau Groupage / Conteneur</Text>
                <Text style={styles.modalSubtitle}>Expédition maritime LCL/FCL ou palette avion cargo</Text>
              </View>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowCreate(false)}>
                <X size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScroll}>
              {/* Presets rapides */}
              <View style={styles.presetSection}>
                <View style={styles.presetHeader}>
                  <Sparkles size={14} color={colors.primary} />
                  <Text style={styles.presetLabel}>Modèles rapides :</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetScroll}>
                  {[
                    { label: '🚢 TC 40\' GZ → Douala', mode: 'sea', is_express: false, origin: 'Guangzhou', dest: 'Douala', num: `TC40-GZ-${Date.now().toString().slice(-4)}`, days: '10' },
                    { label: '🚢 TC 20\' Yiwu → Douala', mode: 'sea', is_express: false, origin: 'Yiwu', dest: 'Douala', num: `TC20-YW-${Date.now().toString().slice(-4)}`, days: '15' },
                    { label: '✈️ Cargo GZ → Douala', mode: 'air', is_express: false, origin: 'Guangzhou', dest: 'Douala', num: `AIR-GZ-${Date.now().toString().slice(-4)}`, days: '3' },
                    { label: '⚡ Aérien Express GZ', mode: 'air', is_express: true, origin: 'Guangzhou', dest: 'Douala', num: `EXP-GZ-${Date.now().toString().slice(-4)}`, days: '1' },
                    { label: '⚡ Aérien Express Dubaï', mode: 'air', is_express: true, origin: 'Dubaï', dest: 'Douala', num: `EXP-DXB-${Date.now().toString().slice(-4)}`, days: '1' },
                  ].map((p) => (
                    <TouchableOpacity
                      key={p.num}
                      style={styles.presetChip}
                      onPress={() => {
                        const offset = parseInt(p.days || '5', 10);
                        const targetDate = getInitialDepartureDate(offset);
                        const tObj = new Date(Date.now() + offset * 86400000);
                        setCalendarMonth(tObj.getMonth());
                        setCalendarYear(tObj.getFullYear());
                        setForm({
                          container_number: p.num,
                          destination_city: p.dest,
                          origin_port: p.origin,
                          mode: p.mode,
                          is_express: p.is_express,
                          vessel_name: '',
                          departure_date: targetDate,
                        });
                      }}
                    >
                      <Text style={styles.presetChipText}>{p.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Mode de transport */}
              <Text style={styles.formSectionLabel}>1. Mode de fret & type de groupage</Text>
              <View style={styles.modeSelectorRow}>
                <TouchableOpacity
                  style={[styles.modeCard, form.mode === 'sea' && styles.modeCardSeaActive]}
                  onPress={() => setForm({ ...form, mode: 'sea', is_express: false })}
                >
                  <Ship size={20} color={form.mode === 'sea' ? '#38BDF8' : colors.textSecondary} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.modeCardTitle, form.mode === 'sea' && { color: '#38BDF8' }]}>
                      🚢 Fret Maritime
                    </Text>
                    <Text style={styles.modeCardSubtitle}>Conteneur maritime (CBM), transit portuaire</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modeCard, form.mode === 'air' && styles.modeCardAirActive]}
                  onPress={() => setForm({ ...form, mode: 'air' })}
                >
                  <Plane size={20} color={form.mode === 'air' ? '#7DD3FC' : colors.textSecondary} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.modeCardTitle, form.mode === 'air' && { color: '#7DD3FC' }]}>
                      ✈️ Fret Aérien
                    </Text>
                    <Text style={styles.modeCardSubtitle}>Palette avion, vol cargo rapide</Text>
                  </View>
                </TouchableOpacity>
              </View>

              {/* Case à cocher élégante Fret Aérien Express */}
              {form.mode === 'air' && (
                <TouchableOpacity
                  style={[
                    styles.expressCheckboxCard,
                    form.is_express && styles.expressCheckboxCardActive,
                  ]}
                  activeOpacity={0.8}
                  onPress={() => {
                    setForm((prev) => ({ ...prev, is_express: !prev.is_express }));
                  }}
                >
                  <View style={styles.expressCheckboxLeft}>
                    <View style={[styles.expressCheckboxIcon, form.is_express && styles.expressCheckboxIconActive]}>
                      <Zap size={18} color={form.is_express ? '#F59E0B' : colors.textSecondary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={[styles.expressCheckboxTitle, form.is_express && styles.expressCheckboxTitleActive]}>
                          ⚡ Option Aérien Express
                        </Text>
                        {form.is_express && (
                          <View style={styles.expressBadgeTag}>
                            <Text style={styles.expressBadgeTagText}>EXPRESS</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.expressCheckboxDesc}>
                        Cocher pour expédition express (alimente la section Prochain départ Express sur l'accueil)
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.checkboxBox, form.is_express && styles.checkboxBoxActive]}>
                    {form.is_express && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
                  </View>
                </TouchableOpacity>
              )}

              {/* Estimation départ avec Calendrier interactif & calcul dynamique */}
              <View style={styles.calendarSectionWrapper}>
                <View style={styles.calendarSectionHeader}>
                  <Text style={styles.formSectionLabel}>2. Date de départ estimée (Calendrier interactif)</Text>
                  <TouchableOpacity
                    style={styles.calendarToggleBtn}
                    onPress={() => setCalendarOpen((v) => !v)}
                  >
                    <Calendar size={13} color={colors.primary} />
                    <Text style={styles.calendarToggleBtnText}>
                      {calendarOpen ? 'Masquer' : 'Calendrier'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Card récapitulative dynamique de la date sélectionnée */}
                <View style={styles.selectedDateBanner}>
                  <View style={styles.selectedDateIconCircle}>
                    <Calendar size={20} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.selectedDateTitle}>
                      {formatPrettyDate(form.departure_date)}
                    </Text>
                    <Text style={styles.selectedDateSub}>
                      {remainingDays === 0
                        ? "⚡ Départ aujourd'hui (J-0)"
                        : `⚡ Dans ${remainingDays} jour${remainingDays > 1 ? 's' : ''} (J-${remainingDays})`}
                    </Text>
                  </View>
                  <View style={[styles.daysCounterBadge, remainingDays <= 2 && styles.daysCounterBadgeUrgent]}>
                    <Text style={styles.daysCounterBadgeText}>
                      {remainingDays}j restants
                    </Text>
                  </View>
                </View>

                {/* Vue Calendrier mensuel si ouvert */}
                {calendarOpen && (
                  <View style={styles.calendarCard}>
                    {/* Header Mois & Navigation */}
                    <View style={styles.calendarHeaderRow}>
                      <TouchableOpacity
                        style={styles.calendarNavBtn}
                        onPress={() => {
                          if (calendarMonth === 0) {
                            setCalendarMonth(11);
                            setCalendarYear((y) => y - 1);
                          } else {
                            setCalendarMonth((m) => m - 1);
                          }
                        }}
                      >
                        <ChevronLeft size={18} color={colors.text} />
                      </TouchableOpacity>

                      <Text style={styles.calendarMonthTitle}>
                        {MONTH_NAMES[calendarMonth]} {calendarYear}
                      </Text>

                      <TouchableOpacity
                        style={styles.calendarNavBtn}
                        onPress={() => {
                          if (calendarMonth === 11) {
                            setCalendarMonth(0);
                            setCalendarYear((y) => y + 1);
                          } else {
                            setCalendarMonth((m) => m + 1);
                          }
                        }}
                      >
                        <ChevronRight size={18} color={colors.text} />
                      </TouchableOpacity>
                    </View>

                    {/* Jours de la semaine Lun..Dim */}
                    <View style={styles.calendarWeekdaysRow}>
                      {DAY_SHORT_NAMES.map((d) => (
                        <Text key={d} style={styles.calendarWeekdayText}>
                          {d}
                        </Text>
                      ))}
                    </View>

                    {/* Grille des jours */}
                    <View style={styles.calendarDaysGrid}>
                      {calendarDays.map((item, idx) => {
                        if (!item) {
                          return <View key={`empty-${idx}`} style={styles.calendarDayCell} />;
                        }
                        const { day, dateStr, isPast, isToday, isSelected } = item;
                        return (
                          <TouchableOpacity
                            key={dateStr}
                            disabled={isPast}
                            style={[
                              styles.calendarDayCell,
                              isSelected && styles.calendarDayCellSelected,
                              isToday && !isSelected && styles.calendarDayCellToday,
                              isPast && styles.calendarDayCellPast,
                            ]}
                            onPress={() => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              setForm((f) => ({ ...f, departure_date: dateStr }));
                            }}
                          >
                            <Text
                              style={[
                                styles.calendarDayText,
                                isSelected && styles.calendarDayTextSelected,
                                isToday && !isSelected && styles.calendarDayTextToday,
                                isPast && styles.calendarDayTextPast,
                              ]}
                            >
                              {day}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}

                {/* Raccourcis rapides de date */}
                <Text style={styles.quickPresetTitle}>Raccourcis rapides :</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.delayChipsRow}>
                  {[
                    { label: '⚡ Demain (+1j)', offset: 1 },
                    { label: '+2 jours', offset: 2 },
                    { label: '+3 jours', offset: 3 },
                    { label: '+5 jours', offset: 5 },
                    { label: '+7 jours', offset: 7 },
                    { label: '+10 jours', offset: 10 },
                    { label: '+15 jours', offset: 15 },
                    { label: '+30 jours', offset: 30 },
                  ].map((preset) => {
                    const presetDateStr = getInitialDepartureDate(preset.offset);
                    const isActive = form.departure_date === presetDateStr;
                    return (
                      <TouchableOpacity
                        key={preset.label}
                        style={[styles.delayChip, isActive && styles.delayChipActive]}
                        onPress={() => {
                          const target = new Date(Date.now() + preset.offset * 86400000);
                          setCalendarMonth(target.getMonth());
                          setCalendarYear(target.getFullYear());
                          setForm((f) => ({ ...f, departure_date: presetDateStr }));
                        }}
                      >
                        <Text style={[styles.delayChipText, isActive && styles.delayChipTextActive]}>
                          {preset.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Référence et trajets */}
              <Text style={styles.formSectionLabel}>3. Référence & itinéraire</Text>
              <View style={styles.inputWrapper}>
                <Box size={18} color={colors.primary} style={styles.inputIcon} />
                <TextInput
                  style={styles.fieldInput}
                  placeholder="N° Conteneur / Référence de groupage *"
                  placeholderTextColor={colors.textSecondary}
                  value={form.container_number}
                  onChangeText={(v) => setForm({ ...form, container_number: v })}
                />
              </View>

              <View style={styles.twoColsRow}>
                <View style={[styles.inputWrapper, { flex: 1 }]}>
                  <Navigation size={16} color={colors.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.fieldInput}
                    placeholder="Port / Origine *"
                    placeholderTextColor={colors.textSecondary}
                    value={form.origin_port}
                    onChangeText={(v) => setForm({ ...form, origin_port: v })}
                  />
                </View>

                <View style={[styles.inputWrapper, { flex: 1 }]}>
                  <MapPin size={16} color={colors.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.fieldInput}
                    placeholder="Destination *"
                    placeholderTextColor={colors.textSecondary}
                    value={form.destination_city}
                    onChangeText={(v) => setForm({ ...form, destination_city: v })}
                  />
                </View>
              </View>

              <View style={[styles.inputWrapper, { marginTop: 8 }]}>
                {form.mode === 'sea' ? (
                  <Ship size={18} color={colors.textSecondary} style={styles.inputIcon} />
                ) : (
                  <Plane size={18} color={colors.textSecondary} style={styles.inputIcon} />
                )}
                <TextInput
                  style={styles.fieldInput}
                  placeholder={form.mode === 'sea' ? "Nom du navire / N° Booking (optionnel)" : "Compagnie aérienne / N° Vol (optionnel)"}
                  placeholderTextColor={colors.textSecondary}
                  value={form.vessel_name}
                  onChangeText={(v) => setForm({ ...form, vessel_name: v })}
                />
              </View>

              {/* Footer */}
              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.submitBtn}
                  onPress={createGroupage}
                  disabled={creating}
                >
                  {creating ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Check size={18} color="#fff" />
                      <Text style={styles.submitBtnText}>Créer le groupage</Text>
                    </View>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.dismissBtn}
                  onPress={() => setShowCreate(false)}
                >
                  <Text style={styles.dismissBtnText}>Annuler</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, backgroundColor: colors.card, borderBottomWidth: 1, borderColor: colors.border },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  back: { padding: 4, minWidth: 40 },
  headerNewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  headerNewBtnText: { color: '#fff', fontWeight: '800', fontSize: 12 },

  modeTabs: { flexDirection: 'row', gap: 8, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  modeTab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: radii.button, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
  },
  modeTabOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  modeTabText: { fontWeight: '800', fontSize: 12, color: colors.textSecondary },
  section: { padding: spacing.lg, paddingBottom: 0 },
  stepHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  stepLabel: { fontSize: 12, fontWeight: '800', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1 },
  stepNewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: `${colors.primary}18`,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  stepNewBtnText: { color: colors.primary, fontWeight: '800', fontSize: 11 },

  emptyContainerCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    marginVertical: 8,
  },
  emptyContainerTitle: { fontSize: 15, fontWeight: '800', color: colors.text, marginTop: 4 },
  emptyContainerDesc: { fontSize: 12, color: colors.textSecondary, textAlign: 'center', lineHeight: 16, paddingHorizontal: 20 },
  emptyCreateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  emptyCreateBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.card, borderRadius: radii.input, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border },
  searchInput: { flex: 1, height: 48, color: colors.text, fontSize: 14 },
  searchBtn: { backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: radii.button },
  searchBtnText: { color: '#fff', fontWeight: '800' },
  selectedColis: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, backgroundColor: `${colors.success}20`, padding: 14, borderRadius: radii.card, borderWidth: 1, borderColor: colors.success },
  selectedText: { fontWeight: '800', color: colors.success, fontFamily: fonts.mono, fontSize: 15 },
  selectedSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  hint: { fontSize: 13, color: colors.textSecondary, marginTop: 16, marginBottom: 8 },
  emptyHint: { color: colors.textSecondary, fontStyle: 'italic', marginTop: 8 },
  colisRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, padding: 14, borderRadius: radii.card, marginBottom: 8, borderWidth: 1, borderColor: colors.border },
  colisRowOn: { borderColor: colors.primary, backgroundColor: `${colors.primary}15` },
  colisTracking: { fontWeight: '800', color: colors.text, fontFamily: fonts.mono, fontSize: 14 },
  colisDesc: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  check: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  bulkRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 8 },
  bulkLink: { color: colors.primary, fontWeight: '700', fontSize: 12 },
  warnBanner: { backgroundColor: `${colors.accent}20`, padding: 12, borderRadius: radii.card, marginBottom: 12 },
  warnText: { color: colors.accent, fontWeight: '700', fontSize: 13, textAlign: 'center' },
  card: { backgroundColor: colors.card, borderRadius: radii.card, padding: spacing.lg, marginBottom: spacing.sm, borderWidth: 2, borderColor: colors.primary, ...shadow.card },
  cardMuted: { borderColor: colors.border, opacity: 0.65 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  containerNum: { fontSize: 16, fontWeight: '800', color: colors.text, fontFamily: fonts.mono },
  route: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: `${colors.primary}20`, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 12, fontWeight: '800', color: colors.primary },

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

  presetSection: {
    marginBottom: 14,
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
    marginTop: 10,
    marginBottom: 8,
  },

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
  modeCardSeaActive: { borderColor: '#38BDF8', backgroundColor: 'rgba(56,189,248,0.12)' },
  modeCardAirActive: { borderColor: '#7DD3FC', backgroundColor: 'rgba(125,211,252,0.12)' },
  modeCardTitle: { fontSize: 13, fontWeight: '800', color: colors.text },
  modeCardSubtitle: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },

  expressCheckboxCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(245, 158, 11, 0.06)', borderRadius: 14, padding: 12,
    borderWidth: 1.5, borderColor: 'rgba(245, 158, 11, 0.25)', marginTop: 4, marginBottom: 8,
  },
  expressCheckboxCardActive: { backgroundColor: 'rgba(245, 158, 11, 0.15)', borderColor: '#F59E0B' },
  expressCheckboxLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, marginRight: 10 },
  expressCheckboxIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(245, 158, 11, 0.12)', alignItems: 'center', justifyContent: 'center' },
  expressCheckboxIconActive: { backgroundColor: '#F59E0B' },
  expressCheckboxTitle: { fontSize: 13, fontWeight: '800', color: colors.text },
  expressCheckboxTitleActive: { color: '#F59E0B' },
  expressBadgeTag: { backgroundColor: '#F59E0B', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  expressBadgeTagText: { color: '#000000', fontSize: 9.5, fontWeight: '900', letterSpacing: 0.4 },
  expressCheckboxDesc: { fontSize: 11, color: colors.textSecondary, marginTop: 2, lineHeight: 14 },
  checkboxBox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
  checkboxBoxActive: { borderColor: '#F59E0B', backgroundColor: '#F59E0B' },
  delayChipsRow: { gap: 8, paddingVertical: 2, marginBottom: 8 },
  delayChip: { backgroundColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  delayChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  delayChipText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  delayChipTextActive: { color: '#FFFFFF' },

  calendarSectionWrapper: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    marginTop: 4,
    marginBottom: 10,
  },
  calendarSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  calendarToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: `${colors.primary}15`,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  calendarToggleBtnText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  selectedDateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(235,94,40,0.08)',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(235,94,40,0.25)',
    marginBottom: 10,
  },
  selectedDateIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(235,94,40,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedDateTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },
  selectedDateSub: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '700',
    marginTop: 2,
  },
  daysCounterBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
  },
  daysCounterBadgeUrgent: {
    backgroundColor: '#EF4444',
  },
  daysCounterBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
  calendarCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 10,
  },
  calendarHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  calendarNavBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarMonthTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },
  calendarWeekdaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 6,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  calendarWeekdayText: {
    width: 34,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  calendarDaysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
  },
  calendarDayCell: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 2,
  },
  calendarDayCellSelected: {
    backgroundColor: colors.primary,
  },
  calendarDayCellToday: {
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  calendarDayCellPast: {
    opacity: 0.25,
  },
  calendarDayText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  calendarDayTextSelected: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  calendarDayTextToday: {
    color: colors.primary,
    fontWeight: '800',
  },
  calendarDayTextPast: {
    color: colors.textSecondary,
  },
  quickPresetTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 6,
  },

  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
  },
  inputIcon: { marginRight: 10 },
  fieldInput: { flex: 1, paddingVertical: 12, color: colors.text, fontSize: 14, fontWeight: '600' },
  twoColsRow: { flexDirection: 'row', gap: 10, marginTop: 8 },

  modalFooter: { marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', gap: 8 },
  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  dismissBtn: { paddingVertical: 10, alignItems: 'center' },
  dismissBtnText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
});
