import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { LogOut, Package, Scan, List, Lock, Clock, RotateCcw } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '../../src/store/authStore';
import { colisApi } from '../../src/api/colis';
import { darkColors as colors, fonts, radii, shadow, spacing } from '../../src/constants/theme';

export default function OperatorDashboard() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  
  const [kpi, setKpi] = useState({ pending: 0, warehouse: 0, transit: 0, delivered: 0 });
  const [recent, setRecent] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [shiftActive, setShiftActive] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [kpiData, recentData] = await Promise.all([
        colisApi.kpi(),
        colisApi.list({ limit: 5, status: 'received' })
      ]);
      setKpi(kpiData);
      setRecent(recentData);
    } catch (e) {
      console.log('Error fetching dashboard data', e);
    } finally {
      setLoading(false);
    }
  };

  const onLogout = async () => {
    if (shiftActive) {
      Alert.alert("Service en cours", "Veuillez terminer votre service avant de vous déconnecter.");
      return;
    }
    await logout();
    router.replace('/(auth)/login');
  };

  const toggleShift = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShiftActive(!shiftActive);
  };

  const onUndo = (colis: any) => {
    Alert.alert(
      "Annuler Réception",
      `Êtes-vous sûr de vouloir remettre le colis ${colis.tracking_number} en attente ?`,
      [
        { text: "Non", style: "cancel" },
        { 
          text: "Oui, Annuler", 
          style: "destructive",
          onPress: async () => {
            try {
              // In a real app, you'd call a specific /undo endpoint.
              // Here we just patch status back to pending_reception.
              await colisApi.updateStatus(colis.id, 'pending_reception', 'Erreur de saisie opérateur');
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              fetchData();
            } catch (e) {
              Alert.alert("Erreur", "Impossible d'annuler");
            }
          }
        }
      ]
    );
  };

  const isAdmin = user?.role === 'admin';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.badge}>MODE OPÉRATEUR</Text>
          <Text style={styles.userName}>{user?.full_name || 'Agent'}</Text>
        </View>
        <TouchableOpacity onPress={onLogout} style={styles.logoutBtn}>
          <LogOut size={20} color={colors.danger} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <TouchableOpacity 
          style={[styles.shiftBtn, shiftActive ? styles.shiftActive : styles.shiftInactive]} 
          onPress={toggleShift}
        >
          <Clock size={20} color={shiftActive ? '#fff' : colors.text} />
          <Text style={[styles.shiftText, shiftActive && { color: '#fff' }]}>
            {shiftActive ? 'Fin de Service' : 'Prendre mon Service'}
          </Text>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Réception & Audit</Text>
        
        <TouchableOpacity 
          style={styles.mainAction} 
          onPress={() => router.push('/(operator)/reception')}
        >
          <View style={styles.actionIcon}>
            <Scan size={32} color="#fff" />
          </View>
          <View>
            <Text style={styles.actionTitle}>Nouvelle Réception</Text>
            <Text style={styles.actionDesc}>Scanner Shipping Mark & Audit</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.grid}>
          <TouchableOpacity style={styles.subAction} onPress={() => router.push('/(operator)/reception')}>
            <List size={24} color={colors.primary} />
            <Text style={styles.subActionTitle}>Mes Réceptions</Text>
          </TouchableOpacity>
          {isAdmin && (
            <TouchableOpacity style={styles.subAction} onPress={() => router.push('/(operator)/cloture')}>
              <Lock size={24} color={colors.danger} />
              <Text style={styles.subActionTitle}>Clôture & PL</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.statsCard}>
          <View style={styles.statsHeader}>
            <Text style={styles.statsTitle}>Aujourd'hui</Text>
            <TouchableOpacity onPress={fetchData}>
              <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>Actualiser</Text>
            </TouchableOpacity>
          </View>
          
          {loading ? <ActivityIndicator color={colors.primary} style={{ padding: 20 }}/> : (
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{kpi.warehouse}</Text>
                <Text style={styles.statLabel}>Colis Reçus</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{kpi.pending}</Text>
                <Text style={styles.statLabel}>En attente</Text>
              </View>
            </View>
          )}
        </View>

        <Text style={[styles.sectionTitle, { marginTop: spacing.xl }]}>Historique Récent (Undo)</Text>
        {recent.length === 0 && !loading && (
          <Text style={{ color: colors.textSecondary, fontStyle: 'italic' }}>Aucun colis réceptionné récemment.</Text>
        )}
        {recent.map((colis) => (
          <View key={colis.id} style={styles.recentCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.recentTracking}>{colis.tracking_number}</Text>
              <Text style={styles.recentNature}>{colis.nature || 'Marchandise'}</Text>
            </View>
            <TouchableOpacity style={styles.undoBtn} onPress={() => onUndo(colis)}>
              <RotateCcw size={16} color={colors.danger} />
              <Text style={styles.undoText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    padding: spacing.lg,
    backgroundColor: colors.card,
    ...shadow.card,
  },
  badge: { 
    fontSize: 10, 
    fontWeight: '800', 
    color: colors.primary, 
    backgroundColor: `${colors.primary}20`,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  userName: { fontSize: 20, fontWeight: '800', color: colors.text, fontFamily: fonts.heading },
  logoutBtn: { padding: 8, backgroundColor: colors.dangerBg, borderRadius: radii.button },
  scroll: { padding: spacing.lg, paddingBottom: 100 },
  shiftBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 14, borderRadius: radii.button, marginBottom: spacing.lg, ...shadow.card },
  shiftInactive: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  shiftActive: { backgroundColor: colors.success },
  shiftText: { fontSize: 16, fontWeight: '700', color: colors.text },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.textSecondary, marginBottom: spacing.md, textTransform: 'uppercase', letterSpacing: 1 },
  mainAction: { 
    backgroundColor: colors.primary, 
    borderRadius: radii.card, 
    padding: spacing.xl, 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: spacing.lg,
    ...shadow.floating,
    marginBottom: spacing.lg,
  },
  actionIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  actionTitle: { fontSize: 20, fontWeight: '800', color: '#fff' },
  actionDesc: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  grid: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
  subAction: { 
    flex: 1, 
    backgroundColor: colors.card, 
    borderRadius: radii.card, 
    padding: spacing.lg, 
    alignItems: 'center', 
    gap: 10,
    ...shadow.card,
  },
  subActionTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  statsCard: { backgroundColor: colors.card, borderRadius: radii.card, padding: spacing.lg, ...shadow.card },
  statsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  statsTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  statsRow: { flexDirection: 'row', alignItems: 'center' },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 32, fontWeight: '900', color: colors.primary },
  statLabel: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
  statDivider: { width: 1, height: 50, backgroundColor: colors.borderLight },
  recentCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, padding: spacing.md, borderRadius: radii.card, marginBottom: spacing.sm, ...shadow.card },
  recentTracking: { fontSize: 15, fontWeight: '800', color: colors.text, fontFamily: fonts.mono },
  recentNature: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  undoBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.dangerBg, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radii.button },
  undoText: { color: colors.danger, fontSize: 12, fontWeight: '700' },
});
