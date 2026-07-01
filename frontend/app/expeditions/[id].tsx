import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Box, Download, FileText, Scale, Ruler, DollarSign, Package, Calendar, Check, Truck, MapPin, Anchor, PlaneTakeoff } from 'lucide-react-native';
import { z } from 'zod';

const paramSchema = z.object({
  id: z.string().min(1),
});
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import Toast from 'react-native-toast-message';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';

import { useColisStore } from '../../src/store/colisStore';
import { useAuthStore } from '../../src/store/authStore';
import StatusBadge from '../../src/components/StatusBadge';
import { fileService } from '../../src/api/files';
import { colors, fonts, radii, shadow, spacing } from '../../src/constants/theme';

export default function ExpeditionDetailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const rawParams = useLocalSearchParams();
  const parsed = paramSchema.safeParse(rawParams);
  
  if (!parsed.success) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: colors.danger }}>Lien invalide.</Text>
      </SafeAreaView>
    );
  }
  
  const { id } = parsed.data;
  
  const { groupages, colis } = useColisStore();
  const user = useAuthStore(s => s.user);

  const [downloadingPackingList, setDownloadingPackingList] = useState(false);
  const [downloadingInvoice, setDownloadingInvoice] = useState(false);

  const groupage = useMemo(() => groupages.find(g => g.id === id), [groupages, id]);
  const packages = useMemo(() => colis.filter((c: any) => c.container_id === id || c.groupage_id === id), [colis, id]);

  const metrics = useMemo(() => {
    let weight = 0;
    let volume = 0;
    let value = 0;
    packages.forEach(p => {
      weight += p.weight_real || 0;
      volume += p.weight_volumetric || 0;
      value += p.declared_value || 0;
    });
    return { weight, volume, value };
  }, [packages]);

  const downloadPackingList = async () => {
    if (!groupage) return;
    setDownloadingPackingList(true);
    Haptics.selectionAsync();
    try {
      await fileService.downloadAndShare(
        `/groupages/${groupage.id}/packing-list`,
        `Packing_List_${groupage.container_number}.pdf`
      );
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Erreur lors du téléchargement PDF' });
    } finally {
      setDownloadingPackingList(false);
    }
  };

  if (!groupage) return null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}><ChevronLeft size={26} color={colors.text} /></TouchableOpacity>
        <Text style={styles.headerTitle}>Dossier Expédition</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        
        {/* En-tête Conteneur */}
        <View style={styles.containerCard}>
          <Text style={styles.cTitle}>{groupage.container_number}</Text>
          <View style={styles.cRow}>
            <StatusBadge status={groupage.status as any} />
            <Text style={styles.cMode}>{t(`transport.${groupage.mode}`)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.cRoute}>
            <Text style={styles.port}>{groupage.origin_port}</Text>
            <View style={styles.routeLine} />
            <Text style={styles.port}>{groupage.destination_port}</Text>
          </View>
          <View style={styles.datesRow}>
            <Text style={styles.dateLabel}>DÉPART : {new Date(groupage.departure_date).toLocaleDateString()}</Text>
            <Text style={styles.dateLabel}>ETA : {new Date(groupage.estimated_arrival).toLocaleDateString()}</Text>
          </View>
        </View>

        {/* Métriques */}
        <Text style={styles.sectionTitle}>MÉTRIQUES DU LOT</Text>
        <View style={styles.metricsRow}>
          <View style={styles.metricBox}>
            <Package size={18} color={colors.primary} />
            <Text style={styles.mValue}>{packages.length}</Text>
            <Text style={styles.mLabel}>COLIS</Text>
          </View>
          <View style={styles.metricBox}>
            <Scale size={18} color="#f59e0b" />
            <Text style={styles.mValue}>{metrics.weight.toFixed(1)}</Text>
            <Text style={styles.mLabel}>KG (TOTAL)</Text>
          </View>
          <View style={styles.metricBox}>
            <Ruler size={18} color="#8b5cf6" />
            <Text style={styles.mValue}>{metrics.volume.toFixed(2)}</Text>
            <Text style={styles.mLabel}>CBM (TOTAL)</Text>
          </View>
        </View>

        {/* Documents */}
        <Text style={styles.sectionTitle}>DOCUMENTS D'EXPÉDITION</Text>
        <View style={styles.docsContainer}>
          <TouchableOpacity 
            style={styles.docBtn}
            onPress={downloadPackingList}
            disabled={downloadingPackingList}
          >
            {downloadingPackingList ? <ActivityIndicator size="small" color={colors.primary} /> : <FileText size={20} color={colors.primary} />}
            <Text style={styles.docText}>Packing List (PDF)</Text>
            <Download size={16} color={colors.textSecondary} style={{ marginLeft: 'auto' }} />
          </TouchableOpacity>

        </View>

        {/* Liste des Colis */}
        <Text style={styles.sectionTitle}>PACKING LIST ({packages.length} COLIS)</Text>
        <View style={styles.packagesList}>
          {packages.map((p, idx) => (
            <TouchableOpacity 
              key={p.id} 
              style={[styles.pkgItem, idx < packages.length - 1 && styles.pkgBorder]}
              onPress={() => router.push(`/colis/${p.id}`)}
            >
              <View style={styles.pkgIcon}>
                <Box size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.pkgTracking}>{p.tracking_number}</Text>
                <Text style={styles.pkgDesc} numberOfLines={1}>{p.description}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.pkgWeight}>{p.weight_real} kg</Text>
                <Text style={styles.pkgValue}>{p.declared_value} {p.currency}</Text>
              </View>
            </TouchableOpacity>
          ))}
          {packages.length === 0 && (
            <Text style={{ textAlign: 'center', padding: 20, color: colors.textSecondary }}>Aucun colis dans ce conteneur</Text>
          )}
        </View>

          <Text style={styles.sectionTitle}>SUIVI DE L'EXPÉDITION</Text>
          <View style={styles.cardNoPadding}>
            <MapSimulation 
              mode={groupage.mode} 
              status={groupage.status} 
              origin={groupage.origin_port} 
              dest={groupage.destination_port} 
            />
            <View style={{ padding: spacing.lg }}>
              <GroupageTimeline mode={groupage.mode} status={groupage.status} departureDate={groupage.departure_date} eta={groupage.estimated_arrival} origin={groupage.origin_port} dest={groupage.destination_port} />
            </View>
          </View>

      </ScrollView>
    </SafeAreaView>
  );
}

function MapSimulation({ mode, status, origin, dest }: any) {
  const STEPS = ['loading', 'departed', 'in_transit', 'arrived'];
  const currentIndex = STEPS.indexOf(status);
  const progress = Math.max(0, Math.min(100, Math.round(((currentIndex + 1) / STEPS.length) * 100)));
  
  const Icon = mode === 'air' ? PlaneTakeoff : Anchor;
  const leftPos = 10 + (progress * 0.8);
  const arcHeight = mode === 'air' ? Math.sin((progress / 100) * Math.PI) * 30 : 0;

  return (
    <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.mapCard}>
      {/* Decorative Grid */}
      <View style={styles.mapGrid} />
      
      <View style={styles.mapContent}>
        {/* Route dashed line */}
        <View style={styles.mapRouteLine} />
        
        {/* Origin */}
        <View style={styles.mapOrigin}>
          <View style={[styles.mapDot, { backgroundColor: '#10B981', shadowColor: '#10B981' }]} />
          <Text style={styles.mapCity}>{origin || 'Guangzhou'}</Text>
          <Text style={styles.mapCountry}>Chine</Text>
        </View>
        
        {/* Destination */}
        <View style={styles.mapDest}>
          <View style={[styles.mapDot, { backgroundColor: '#3B82F6', shadowColor: '#3B82F6' }]} />
          <Text style={styles.mapCity}>{dest || 'Douala'}</Text>
          <Text style={styles.mapCountry}>Cameroun</Text>
        </View>
        
        {/* Moving Vehicle */}
        <View style={[styles.mapVehicle, { left: `${leftPos}%`, top: 55 - arcHeight }]}>
          <View style={styles.vehicleIconBg}>
            <Icon size={14} color="#FFF" />
          </View>
          <View style={styles.progressTooltip}>
            <Text style={styles.progressTooltipText}>{progress}%</Text>
          </View>
        </View>
      </View>
    </LinearGradient>
  );
}

function GroupageTimeline({ mode, status, departureDate, eta, origin, dest }: any) {
  const { t } = useTranslation();
  
  const STEPS = ['loading', 'departed', 'in_transit', 'arrived'];
  const currentIndex = STEPS.indexOf(status);
  
  const getIcon = (step: string) => {
    if (step === 'loading') return Box;
    if (step === 'departed') return mode === 'air' ? PlaneTakeoff : Anchor;
    if (step === 'in_transit') return Truck;
    if (step === 'arrived') return MapPin;
    return Check;
  };
  
  const getLabel = (step: string) => {
    if (step === 'loading') return 'Chargement';
    if (step === 'departed') return mode === 'air' ? 'Décollage' : 'Départ navire';
    if (step === 'in_transit') return 'En transit';
    if (step === 'arrived') return 'Arrivé à destination';
    return step;
  };
  
  const getSubtext = (step: string) => {
    if (step === 'loading') return origin;
    if (step === 'arrived') return dest;
    return undefined;
  };
  
  const getDate = (step: string) => {
    if (step === 'departed') return new Date(departureDate).toLocaleDateString();
    if (step === 'arrived') return new Date(eta).toLocaleDateString();
    return undefined;
  };

  const progress = Math.max(0, Math.round(((currentIndex + 1) / STEPS.length) * 100));

  return (
    <View style={{ paddingVertical: 0 }}>
      {STEPS.map((step, idx) => {
        const isFuture = idx > currentIndex;
        const isCurrent = idx === currentIndex;
        const isDone = idx < currentIndex;
        const isLast = idx === STEPS.length - 1;
        const Icon = getIcon(step);
        const subtext = getSubtext(step);
        const dateStr = getDate(step);
        
        return (
          <View key={step} style={[styles.tRow, isFuture && { opacity: 0.5 }]}>
            <View style={styles.tLeft}>
              <View style={[styles.tNode, isDone && styles.tNodeDone, isCurrent && styles.tNodeCurrent, isFuture && styles.tNodeFuture]}>
                {isDone ? <Check size={10} color="#fff" strokeWidth={4} /> : <Icon size={10} color={isCurrent ? '#fff' : '#9ca3af'} />}
              </View>
              {!isLast && <View style={[styles.tLine, (isDone || isCurrent) && styles.tLineDone, isFuture && styles.tLineFuture]} />}
            </View>
            <View style={styles.tContent}>
              <Text style={[styles.tLabel, (isDone || isCurrent) && { color: colors.text, fontWeight: '700' }]}>{getLabel(step)}</Text>
              {(subtext || dateStr) && (
                <View style={styles.tDetails}>
                  {subtext && <Text style={styles.tSubtext}>{subtext}</Text>}
                  {dateStr && <Text style={styles.tDate}>{subtext ? ' • ' : ''}{dateStr}</Text>}
                </View>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg },
  headerTitle: { fontSize: 18, fontWeight: '800', color: colors.text, fontFamily: fonts.heading },
  scroll: { padding: spacing.lg, paddingTop: 0, paddingBottom: 40 },
  
  containerCard: { backgroundColor: colors.primary, borderRadius: radii.card, padding: spacing.xl, ...shadow.card, marginBottom: spacing.lg },
  cTitle: { color: '#fff', fontSize: 22, fontFamily: fonts.mono, fontWeight: '800', letterSpacing: 1, marginBottom: 8 },
  cRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cMode: { color: '#D1D5DB', fontSize: 13, fontWeight: '700', textTransform: 'uppercase' },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: spacing.md },
  cRoute: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  port: { color: '#fff', fontSize: 16, fontWeight: '700' },
  routeLine: { flex: 1, height: 2, backgroundColor: 'rgba(255,255,255,0.3)', marginHorizontal: spacing.md, borderStyle: 'dashed' },
  datesRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dateLabel: { color: '#9CA3AF', fontSize: 11, fontWeight: '700' },

  sectionTitle: { fontSize: 13, fontWeight: '800', color: colors.textSecondary, marginTop: spacing.md, marginBottom: spacing.md, textTransform: 'uppercase' },
  
  metricsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  metricBox: { flex: 1, backgroundColor: '#fff', padding: spacing.md, borderRadius: radii.card, alignItems: 'center', ...shadow.card },
  mValue: { fontSize: 16, fontWeight: '800', color: colors.text, marginTop: 8 },
  mLabel: { fontSize: 10, fontWeight: '700', color: colors.textSecondary, marginTop: 2 },

  docsContainer: { backgroundColor: '#fff', borderRadius: radii.card, ...shadow.card, marginBottom: spacing.xl },
  docBtn: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, gap: 12 },
  docText: { fontSize: 15, fontWeight: '600', color: colors.text },
  hDivider: { height: 1, backgroundColor: '#F3F4F6', marginHorizontal: spacing.lg },

  packagesList: { backgroundColor: '#fff', borderRadius: radii.card, ...shadow.card },
  pkgItem: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: 12 },
  pkgBorder: { borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  pkgIcon: { width: 40, height: 40, borderRadius: radii.input, backgroundColor: `${colors.primary}15`, alignItems: 'center', justifyContent: 'center' },
  pkgTracking: { fontFamily: fonts.mono, fontSize: 13, fontWeight: '700', color: colors.primary },
  pkgDesc: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  pkgWeight: { fontSize: 13, fontWeight: '700', color: colors.text },
  pkgValue: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  actionText: { color: colors.primary, fontWeight: '700', fontSize: 14 },
  actionTextDisabled: { color: colors.textSecondary },
  support: { backgroundColor: colors.success },
  
  card: { backgroundColor: '#fff', borderRadius: radii.card, padding: spacing.lg, ...shadow.card, marginBottom: spacing.xl },
  cardNoPadding: { backgroundColor: '#fff', borderRadius: radii.card, overflow: 'hidden', ...shadow.card, marginBottom: spacing.xl },
  
  // Map Simulation Styles
  mapCard: { height: 160, position: 'relative', overflow: 'hidden' },
  mapGrid: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.1, backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '10px 10px' }, // Note: React Native doesn't support backgroundImage natively like this, so we rely on the gradient background mostly.
  mapContent: { flex: 1, position: 'relative' },
  mapRouteLine: { position: 'absolute', top: 75, left: '10%', right: '10%', height: 2, borderBottomWidth: 2, borderColor: 'rgba(255,255,255,0.2)', borderStyle: 'dashed' },
  mapOrigin: { position: 'absolute', top: 69, left: '10%', transform: [{ translateX: -8 }], alignItems: 'center' },
  mapDest: { position: 'absolute', top: 69, right: '10%', transform: [{ translateX: 8 }], alignItems: 'center' },
  mapDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 3, borderColor: '#0F172A', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 8 },
  mapCity: { color: '#FFF', fontSize: 12, fontWeight: '700', marginTop: 8, letterSpacing: 0.5 },
  mapCountry: { color: '#94A3B8', fontSize: 10, marginTop: 2 },
  mapVehicle: { position: 'absolute', transform: [{ translateX: -16 }, { translateY: -16 }], alignItems: 'center' },
  vehicleIconBg: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFF', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 4, zIndex: 10 },
  progressTooltip: { backgroundColor: 'rgba(255,255,255,0.9)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 4 },
  progressTooltipText: { fontSize: 10, fontWeight: '800', color: colors.primary },

  tRow: { flexDirection: 'row' },
  tLeft: { width: 32, alignItems: 'center' },
  tNode: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', borderWidth: 2, borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center', zIndex: 2, marginTop: 2 },
  tNodeDone: { backgroundColor: colors.success, borderColor: colors.success },
  tNodeCurrent: { backgroundColor: colors.primary, borderColor: colors.primary },
  tNodeFuture: { backgroundColor: '#F9FAFB', borderColor: '#D1D5DB' },
  tLine: { position: 'absolute', top: 24, bottom: 0, left: 15, width: 2, backgroundColor: '#F3F4F6' },
  tLineDone: { backgroundColor: colors.success, opacity: 0.5 },
  tLineFuture: { backgroundColor: '#E5E7EB', borderStyle: 'dashed' },
  tContent: { flex: 1, paddingLeft: spacing.md, paddingBottom: spacing.lg },
  tLabel: { fontSize: 14, color: colors.textSecondary, fontWeight: '500' },
  tDetails: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  tSubtext: { fontSize: 12, color: colors.primary, fontWeight: '600' },
  tDate: { fontSize: 11, color: colors.textSecondary, fontWeight: '600', textTransform: 'uppercase' },
});
