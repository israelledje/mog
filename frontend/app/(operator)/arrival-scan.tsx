import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
  Modal,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ChevronLeft,
  Scan,
  Printer,
  CheckCircle2,
  AlertCircle,
  Package,
  Ship,
  Plane,
  X,
  RefreshCw,
  Search,
  User,
  Phone,
  Layers,
  ArrowRight,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import QRScanner from '../../src/components/QRScanner';
import { api } from '../../src/api/client';
import { useAuthStore } from '../../src/store/authStore';
import { darkColors as colors, radii, spacing, shadow, fonts } from '../../src/constants/theme';
import { printPackageThermalLabel, printContainerThermalLabels } from '../../src/utils/thermalPrinter';

interface ScannedItem {
  id: string;
  tracking_number: string;
  description?: string;
  weight?: number;
  status: string;
  destination_city?: string;
  customer?: {
    name?: string;
    client_code?: string;
    phone?: string;
  };
  scannedAt: Date;
  already_arrived?: boolean;
}

export default function ArrivalScanScreen() {
  const router = useRouter();
  const { user } = useAuthStore();

  const [containers, setContainers] = useState<any[]>([]);
  const [selectedContainer, setSelectedContainer] = useState<any>(null);
  const [showContainerPicker, setShowContainerPicker] = useState(false);
  const [loadingContainers, setLoadingContainers] = useState(false);

  // Scanner state
  const [scannerActive, setScannerActive] = useState(false);
  const [continuousMode, setContinuousMode] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [scanHistory, setScanHistory] = useState<ScannedItem[]>([]);
  const [manualCode, setManualCode] = useState('');

  // Stats
  const [containerStats, setContainerStats] = useState<{
    total: number;
    arrived: number;
    progress: number;
  }>({ total: 0, arrived: 0, progress: 0 });

  const fetchContainers = async () => {
    setLoadingContainers(true);
    try {
      const res = await api.get('/groupages/');
      if (res.data) {
        // Trier les conteneurs : in_transit et customs d'abord, puis les autres
        const sorted = (res.data as any[]).sort((a, b) => {
          const priority: Record<string, number> = { in_transit: 1, customs: 2, open: 3, closed: 4, arrived: 5 };
          return (priority[a.status] || 99) - (priority[b.status] || 99);
        });
        setContainers(sorted);
        if (sorted.length > 0 && !selectedContainer) {
          selectContainer(sorted[0]);
        }
      }
    } catch (e) {
      console.error('[FETCH_CONTAINERS_ERR]', e);
    } finally {
      setLoadingContainers(false);
    }
  };

  useEffect(() => {
    fetchContainers();
  }, []);

  const selectContainer = async (container: any) => {
    setSelectedContainer(container);
    setShowContainerPicker(false);
    updateContainerStats(container);
  };

  const updateContainerStats = async (container: any) => {
    if (!container) return;
    const pkgIds = container.packages_ids || [];
    const total = pkgIds.length;
    // On peut estimer ou rafraîchir
    try {
      const res = await api.get(`/groupages/${container.id || container._id}/colis`);
      if (res.data) {
        const pkgs = res.data as any[];
        const arrived = pkgs.filter((p) => ['arrived', 'distributed', 'delivered'].includes(p.status)).length;
        setContainerStats({
          total: pkgs.length,
          arrived,
          progress: pkgs.length > 0 ? Math.round((arrived / pkgs.length) * 100) : 0,
        });
      }
    } catch {
      setContainerStats({ total, arrived: 0, progress: 0 });
    }
  };

  const processScanCode = async (rawCode: string) => {
    if (!rawCode || processing) return;
    setProcessing(true);

    const cleanCode = rawCode.trim();

    try {
      let res;
      if (selectedContainer?.id) {
        res = await api.post(`/groupages/${selectedContainer.id}/scan-arrival/${encodeURIComponent(cleanCode)}`);
      } else {
        res = await api.post('/colis/scan-arrival', {
          tracking_number: cleanCode,
          warehouse_city: user?.active_entrepot_name || 'Douala',
          warehouse_name: user?.active_entrepot_name || 'Entrepôt Douala',
        });
      }

      if (res.data?.success) {
        const data = res.data;
        const pkg = data.package;
        const cust = data.customer;

        const newItem: ScannedItem = {
          id: pkg.id,
          tracking_number: pkg.tracking_number,
          description: pkg.description,
          weight: pkg.weight,
          status: pkg.status,
          destination_city: pkg.destination_city,
          customer: cust,
          scannedAt: new Date(),
          already_arrived: data.already_arrived,
        };

        if (data.already_arrived) {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        } else {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }

        setScanHistory((prev) => [newItem, ...prev.filter((x) => x.tracking_number !== newItem.tracking_number)]);

        if (data.container_stats) {
          setContainerStats({
            total: data.container_stats.total_packages,
            arrived: data.container_stats.arrived_packages,
            progress: data.container_stats.progress_percent,
          });
        }
      }
    } catch (err: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const msg = err.response?.data?.detail || `Colis « ${cleanCode} » introuvable`;
      Alert.alert('Scan Non Reconnu', msg);
    } finally {
      setProcessing(false);
      setManualCode('');
      // Si mode non continu, fermer le scanner
      if (!continuousMode) {
        setScannerActive(false);
      }
    }
  };

  const isAir = selectedContainer?.mode === 'air' || selectedContainer?.mode === 'air_express';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Scan Déchargement & Arrivée</Text>
          <Text style={styles.headerSubtitle}>PDA & Réception Entrepôt Destination</Text>
        </View>
        <TouchableOpacity
          style={styles.containerSelectBtn}
          onPress={() => setShowContainerPicker(true)}
        >
          <Layers size={18} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Selected Container Banner */}
      <TouchableOpacity
        style={styles.containerCard}
        onPress={() => setShowContainerPicker(true)}
        activeOpacity={0.8}
      >
        <View style={styles.containerHeaderRow}>
          <View style={[styles.modeIconBox, isAir ? styles.modeAir : styles.modeSea]}>
            {isAir ? <Plane size={18} color="#0ea5e9" /> : <Ship size={18} color={colors.primary} />}
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.containerNumber}>
              {selectedContainer ? selectedContainer.container_number : 'Tous les conteneurs (Scan Global)'}
            </Text>
            <Text style={styles.containerRoute}>
              {selectedContainer
                ? `${selectedContainer.origin_port || 'Guangzhou'} → ${selectedContainer.destination_city || 'Douala'}`
                : 'Scannez n’importe quel colis arrivant'}
            </Text>
          </View>
          <View style={styles.changeBadge}>
            <Text style={styles.changeBadgeText}>Changer</Text>
          </View>
        </View>

        {/* Progress Bar */}
        {selectedContainer && (
          <View style={styles.progressContainer}>
            <View style={styles.progressLabelRow}>
              <Text style={styles.progressText}>
                Déchargés : {containerStats.arrived} / {containerStats.total} colis
              </Text>
              <Text style={styles.progressPercent}>{containerStats.progress}%</Text>
            </View>
            <View style={styles.progressBarTrack}>
              <View style={[styles.progressBarFill, { width: `${Math.min(100, containerStats.progress)}%` }]} />
            </View>
          </View>
        )}
      </TouchableOpacity>

      {/* Action Bar (Scan Trigger & Continuous Toggle & Print All) */}
      <View style={styles.actionBar}>
        <TouchableOpacity
          style={styles.startScanBtn}
          onPress={() => setScannerActive(true)}
          activeOpacity={0.85}
        >
          <Scan size={22} color="#fff" />
          <Text style={styles.startScanBtnText}>Lancer le Scanner Caméra</Text>
        </TouchableOpacity>

        {selectedContainer && (
          <TouchableOpacity
            style={styles.printAllBtn}
            onPress={() => printContainerThermalLabels(selectedContainer.id, selectedContainer.container_number)}
            title="Imprimer toutes les étiquettes du conteneur"
          >
            <Printer size={18} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      {/* Manual Search Bar */}
      <View style={styles.manualInputRow}>
        <View style={styles.manualInputWrapper}>
          <Search size={16} color={colors.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.manualInput}
            placeholder="Saisir ou scanner au laser (CL-...)"
            placeholderTextColor={colors.textMuted}
            value={manualCode}
            onChangeText={setManualCode}
            onSubmitEditing={() => processScanCode(manualCode)}
            autoCapitalize="characters"
            autoCorrect={false}
          />
        </View>
        <TouchableOpacity
          style={[styles.manualSubmitBtn, !manualCode.trim() && { opacity: 0.5 }]}
          disabled={!manualCode.trim() || processing}
          onPress={() => processScanCode(manualCode)}
        >
          {processing ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.manualSubmitText}>Valider</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Live Scanned Feed */}
      <View style={styles.feedHeaderRow}>
        <Text style={styles.feedHeaderTitle}>
          Colis Réceptionnés ({scanHistory.length})
        </Text>
        {scanHistory.length > 0 && (
          <TouchableOpacity onPress={() => setScanHistory([])}>
            <Text style={styles.clearFeedText}>Effacer la vue</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={scanHistory}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Package size={48} color={colors.textMuted} style={{ opacity: 0.4, marginBottom: 12 }} />
            <Text style={styles.emptyTitle}>Prêt pour le déchargement</Text>
            <Text style={styles.emptySubtitle}>
              Scannez les QR Codes sur les colis à la sortie du conteneur. Le système les enregistrera en entrepôt et avertira instantanément les clients par WhatsApp / SMS.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.scanCard}>
            <View style={styles.cardTopRow}>
              <View style={{ flex: 1 }}>
                <View style={styles.trackingRow}>
                  <Text style={styles.cardTracking}>{item.tracking_number}</Text>
                  {item.already_arrived ? (
                    <View style={styles.warningBadge}>
                      <AlertCircle size={12} color="#f59e0b" />
                      <Text style={styles.warningBadgeText}>Déjà reçu</Text>
                    </View>
                  ) : (
                    <View style={styles.successBadge}>
                      <CheckCircle2 size={12} color="#10b981" />
                      <Text style={styles.successBadgeText}>Arrivé · Notifié</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.cardDesc} numberOfLines={1}>
                  {item.description || 'Marchandise diverse'} {item.weight ? `· ${item.weight} kg` : ''}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.printTicketBtn}
                onPress={() => printPackageThermalLabel(item.id, item.tracking_number)}
                title="Imprimer ticket thermique 80mm"
              >
                <Printer size={16} color={colors.primary} />
                <Text style={styles.printTicketText}>Ticket</Text>
              </TouchableOpacity>
            </View>

            {/* Customer info */}
            {item.customer && (
              <View style={styles.customerRow}>
                <View style={styles.customerCol}>
                  <User size={12} color={colors.textMuted} style={{ marginRight: 4 }} />
                  <Text style={styles.customerName} numberOfLines={1}>
                    {item.customer.client_code ? `[${item.customer.client_code}] ` : ''}
                    {item.customer.name || 'Client'}
                  </Text>
                </View>
                {item.customer.phone && (
                  <View style={styles.customerCol}>
                    <Phone size={12} color={colors.textMuted} style={{ marginRight: 4 }} />
                    <Text style={styles.customerPhone}>{item.customer.phone}</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        )}
      />

      {/* Modal QR Scanner Full Screen for PDA / Smartphone */}
      <Modal visible={scannerActive} animationType="slide" transparent={false}>
        <View style={styles.scannerModalContainer}>
          <QRScanner
            active={scannerActive && !processing}
            onScan={(data) => processScanCode(data)}
            onClose={() => setScannerActive(false)}
            hint={
              processing
                ? 'Traitement du colis en cours...'
                : continuousMode
                ? 'Mode Continu : Scannez les colis à la chaîne'
                : 'Cadrez le QR code du colis'
            }
            footer={
              <View style={styles.scannerFooter}>
                <View style={styles.scannerStatusRow}>
                  <Text style={styles.scannerCounterText}>
                    {scanHistory.length} colis scannés dans cette session
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.continuousToggle, continuousMode && styles.continuousToggleActive]}
                  onPress={() => setContinuousMode(!continuousMode)}
                >
                  <RefreshCw size={16} color={continuousMode ? '#fff' : colors.textMuted} />
                  <Text style={[styles.continuousToggleText, continuousMode && { color: '#fff' }]}>
                    {continuousMode ? 'Mode Continu Actif' : 'Mode Colis Unique'}
                  </Text>
                </TouchableOpacity>
              </View>
            }
          />
        </View>
      </Modal>

      {/* Modal Container Picker */}
      <Modal visible={showContainerPicker} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Sélectionner le Conteneur</Text>
              <TouchableOpacity onPress={() => setShowContainerPicker(false)}>
                <X size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 400 }}>
              <TouchableOpacity
                style={[styles.containerOption, !selectedContainer && styles.containerOptionSelected]}
                onPress={() => {
                  setSelectedContainer(null);
                  setShowContainerPicker(false);
                }}
              >
                <Text style={styles.containerOptionNumber}>Scan Global (Tous conteneurs)</Text>
                <Text style={styles.containerOptionSub}>Reconnaît automatiquement le colis et son groupage</Text>
              </TouchableOpacity>

              {containers.map((c) => {
                const isCSelected = selectedContainer?.id === c.id;
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.containerOption, isCSelected && styles.containerOptionSelected]}
                    onPress={() => selectContainer(c)}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={styles.containerOptionNumber}>{c.container_number}</Text>
                      <View style={styles.statusBadgeSmall}>
                        <Text style={styles.statusBadgeTextSmall}>{c.status}</Text>
                      </View>
                    </View>
                    <Text style={styles.containerOptionSub}>
                      {c.origin_port || 'Guangzhou'} → {c.destination_city || 'Douala'} · {c.packages_ids?.length || 0} colis
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
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
  headerTitleContainer: {
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
  containerSelectBtn: {
    padding: 8,
    borderRadius: radii.md,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
  },
  containerCard: {
    margin: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  containerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modeIconBox: {
    width: 40,
    height: 40,
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
  containerNumber: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  containerRoute: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  changeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  changeBadgeText: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
  },
  progressContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  progressPercent: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  actionBar: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    gap: 10,
    marginBottom: spacing.sm,
  },
  startScanBtn: {
    flex: 1,
    height: 48,
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...shadow.sm,
  },
  startScanBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  printAllBtn: {
    width: 48,
    height: 48,
    backgroundColor: 'rgba(16, 185, 129, 0.85)',
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manualInputRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    gap: 8,
  },
  manualInputWrapper: {
    flex: 1,
    height: 44,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  manualInput: {
    flex: 1,
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  manualSubmitBtn: {
    height: 44,
    paddingHorizontal: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  manualSubmitText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  feedHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  feedHeaderTitle: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  clearFeedText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  listContent: {
    padding: spacing.md,
    paddingTop: spacing.xs,
  },
  emptyState: {
    paddingVertical: 40,
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 6,
  },
  emptySubtitle: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 18,
  },
  scanCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  trackingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  cardTracking: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    fontFamily: fonts.mono,
  },
  cardDesc: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  successBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 4,
  },
  successBadgeText: {
    color: '#10b981',
    fontSize: 9,
    fontWeight: '800',
  },
  warningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 4,
  },
  warningBadgeText: {
    color: '#f59e0b',
    fontSize: 9,
    fontWeight: '800',
  },
  printTicketBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  printTicketText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  customerCol: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '50%',
  },
  customerName: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  customerPhone: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  scannerModalContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  scannerFooter: {
    padding: 16,
    alignItems: 'center',
  },
  scannerStatusRow: {
    marginBottom: 10,
  },
  scannerCounterText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  continuousToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  continuousToggleActive: {
    backgroundColor: colors.primary,
  },
  continuousToggleText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  containerOption: {
    padding: 12,
    borderRadius: radii.md,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  containerOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  containerOptionNumber: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  containerOptionSub: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  statusBadgeSmall: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  statusBadgeTextSmall: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
});
