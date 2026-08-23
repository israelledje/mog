import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import Toast from 'react-native-toast-message';
import {
  Search, AlertTriangle, Clock, PackageCheck, Truck, CheckCircle2, ChevronRight, Sparkles
} from 'lucide-react-native';
import { colors, fonts, radii, shadow, spacing } from '../../constants/theme';
import type { Colis, User } from '../../types';

type Kpi = { pending: number; warehouse: number; transit: number; delivered: number };

type Props = {
  user: User | null;
  colis: Colis[];
  kpi: Kpi;
};

export default function HomeTopPanels({ user, colis, kpi }: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const [trackingQuery, setTrackingQuery] = useState('');

  const totalColis = kpi.pending + kpi.warehouse + kpi.transit + kpi.delivered;

  const actionCount = colis.filter(
    (c) =>
      c.status === 'arrived' ||
      c.payment_status === 'waiting_validation' ||
      (c.payment_status === 'pending' && !['draft', 'pending_reception', 'delivered'].includes(c.status)),
  ).length;

  const onSearchTracking = () => {
    const q = trackingQuery.trim().toLowerCase();
    if (!q) return;
    Haptics.selectionAsync();
    const found = colis.find(
      (c) =>
        c.tracking_number?.toLowerCase().includes(q) ||
        c.description?.toLowerCase().includes(q),
    );
    if (found) {
      router.push(`/colis/${found.id}`);
      setTrackingQuery('');
    } else {
      Toast.show({ type: 'info', text1: t('home.search_not_found') });
    }
  };

  const kpiItems = [
    { key: 'pending', label: t('home.pending'), value: kpi.pending, icon: Clock, color: '#F59E0B', bg: '#FEF3C7' },
    { key: 'warehouse', label: t('home.warehouse'), value: kpi.warehouse, icon: PackageCheck, color: '#2563EB', bg: '#EFF6FF' },
    { key: 'transit', label: t('home.transit'), value: kpi.transit, icon: Truck, color: '#0EA5E9', bg: '#E0F2FE' },
    { key: 'delivered', label: t('home.delivered'), value: kpi.delivered, icon: CheckCircle2, color: '#10B981', bg: '#ECFDF5' },
  ] as const;

  return (
    <View style={styles.wrap}>
      {/* Barre de recherche suivi express */}
      <View style={styles.searchRow}>
        <Search size={18} color="#64748B" />
        <TextInput
          style={styles.searchInput}
          placeholder={t('home.search_tracking')}
          placeholderTextColor="#94A3B8"
          value={trackingQuery}
          onChangeText={setTrackingQuery}
          onSubmitEditing={onSearchTracking}
          returnKeyType="search"
          testID="home-tracking-search"
        />
        {trackingQuery.length > 0 && (
          <TouchableOpacity onPress={onSearchTracking} style={styles.searchBtn}>
            <Text style={styles.searchBtnText}>{t('common.ok')}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Actions requises (Alerte si colis bloqué ou en attente d'action) */}
      {actionCount > 0 && (
        <TouchableOpacity 
          style={styles.alertBanner} 
          onPress={() => {
            Haptics.selectionAsync();
            router.push('/(tabs)/colis');
          }} 
          activeOpacity={0.88}
        >
          <AlertTriangle size={18} color="#B45309" />
          <Text style={styles.alertText}>
            {t('home.action_required', { count: actionCount })}
          </Text>
          <ChevronRight size={16} color="#B45309" />
        </TouchableOpacity>
      )}

      {/* CARTE CYCLE D'EXPÉDITION ULTRA-MODERNE & ÉPURÉE */}
      <View style={styles.pipelineCard}>
        
        {/* Header de la carte */}
        <View style={styles.pipelineTopRow}>
          <View style={styles.pipelineTitleBadge}>
            <View style={styles.livePulseDot} />
            <Text style={styles.pipelineTitleText}>CYCLE D'EXPÉDITION</Text>
          </View>

          <TouchableOpacity 
            style={styles.viewAllPill}
            onPress={() => {
              Haptics.selectionAsync();
              router.push('/(tabs)/colis');
            }}
          >
            <Text style={styles.viewAllPillText}>
              {totalColis > 0 ? `${totalColis} colis au total` : 'Voir mes colis'}
            </Text>
            <ChevronRight size={13} color="#2563EB" />
          </TouchableOpacity>
        </View>

        {/* Ligne de flux du cycle logistique avec indicateurs connectés */}
        <View style={styles.pipelineTrackContainer}>
          {/* Ligne de connexion arrière-plan */}
          <View style={styles.connectingLine} />

          <View style={styles.stepsRow}>
            {kpiItems.map((item) => {
              const Icon = item.icon;
              const hasItems = item.value > 0;
              return (
                <TouchableOpacity
                  key={item.key}
                  style={styles.stepColumn}
                  onPress={() => {
                    Haptics.selectionAsync();
                    router.push('/(tabs)/colis');
                  }}
                  activeOpacity={0.75}
                >
                  {/* Noeud icône avec badge de compteur intégré */}
                  <View style={[
                    styles.nodeCircle, 
                    hasItems ? { backgroundColor: item.color, borderColor: '#FFFFFF', shadowColor: item.color } : styles.nodeCircleInactive
                  ]}>
                    <Icon size={16} color={hasItems ? '#FFFFFF' : '#94A3B8'} strokeWidth={2.4} />
                    
                    {/* Badge de nombre flottant */}
                    <View style={[styles.countBadgeNode, hasItems ? { backgroundColor: '#FFFFFF' } : { backgroundColor: '#F1F5F9' }]}>
                      <Text style={[styles.countBadgeText, hasItems ? { color: item.color } : { color: '#94A3B8' }]}>
                        {item.value}
                      </Text>
                    </View>
                  </View>

                  {/* Label de l'étape */}
                  <Text style={[styles.stepLabel, hasItems && styles.stepLabelActive]} numberOfLines={1}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { 
    paddingHorizontal: spacing.lg, 
    paddingBottom: spacing.sm,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: radii.button + 2,
    paddingHorizontal: 14,
    paddingVertical: 3,
    marginBottom: spacing.sm,
    ...shadow.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  searchInput: { 
    flex: 1, 
    fontSize: 14, 
    color: '#0F172A', 
    paddingVertical: 10, 
    fontWeight: '500' 
  },
  searchBtn: { 
    backgroundColor: '#2563EB', 
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: 10 
  },
  searchBtnText: { 
    color: '#FFFFFF', 
    fontWeight: '800', 
    fontSize: 12 
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: spacing.sm,
  },
  alertText: { 
    flex: 1, 
    color: '#92400E', 
    fontWeight: '700', 
    fontSize: 12 
  },

  /* Carte Cycle d'Expédition */
  pipelineCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 16,
    paddingBottom: 14,
    ...shadow.floating,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  pipelineTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  pipelineTitleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  livePulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  pipelineTitleText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#1E293B',
    letterSpacing: 0.8,
  },
  viewAllPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  viewAllPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2563EB',
  },

  /* Track & Steps */
  pipelineTrackContainer: {
    position: 'relative',
    paddingVertical: 4,
  },
  connectingLine: {
    position: 'absolute',
    top: 20,
    left: '12%',
    right: '12%',
    height: 2,
    backgroundColor: '#E2E8F0',
    zIndex: 0,
  },
  stepsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    zIndex: 1,
  },
  stepColumn: {
    alignItems: 'center',
    width: '23%',
  },
  nodeCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    marginBottom: 6,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
    position: 'relative',
  },
  nodeCircleInactive: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    shadowOpacity: 0,
    elevation: 0,
  },
  countBadgeNode: {
    position: 'absolute',
    top: -5,
    right: -6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  countBadgeText: {
    fontSize: 9,
    fontWeight: '900',
  },
  stepLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'center',
  },
  stepLabelActive: {
    color: '#0F172A',
    fontWeight: '800',
  },
});
