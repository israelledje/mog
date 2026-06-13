import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Lock, FileText, Package, CheckCircle2, Ship, Plane } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { groupagesApi } from '../../src/api/colis';
import type { Groupage } from '../../src/types';
import { darkColors as colors, radii, spacing, shadow, fonts } from '../../src/constants/theme';

export default function ClotureScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [containers, setContainers] = useState<Groupage[]>([]);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState<string | null>(null);

  useEffect(() => {
    fetchContainers();
  }, []);

  const fetchContainers = async () => {
    try {
      const data = await groupagesApi.list();
      setContainers(data.filter(c => c.status === 'open'));
    } catch (e) {
      Alert.alert('Erreur', 'Impossible de charger les conteneurs.');
    } finally {
      setLoading(false);
    }
  };

  const onCloture = async (id: string, number: string) => {
    Alert.alert(
      'Clôture du conteneur',
      `Êtes-vous sûr de vouloir clôturer le conteneur ${number} ? Cette action notifiera tous les clients.`,
      [
        { text: 'Annuler', style: 'cancel' },
        { 
          text: 'Confirmer la Clôture', 
          style: 'destructive',
          onPress: async () => {
            setClosing(id);
            try {
              await groupagesApi.updateStatus(id, 'closed');
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Succès', 'Conteneur clôturé et clients notifiés.');
              fetchContainers();
            } catch (e) {
              Alert.alert('Erreur', 'La clôture a échoué.');
            } finally {
              setClosing(null);
            }
          }
        }
      ]
    );
  };

  const renderItem = ({ item }: { item: Groupage }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.iconWrap}>
          {item.transport_mode === 'sea' ? <Ship size={24} color={colors.secondary} /> : <Plane size={24} color={colors.accent} />}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.containerNum}>{item.container_number}</Text>
          <Text style={styles.route}>{item.origin_city} ➔ {item.destination_city}</Text>
        </View>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>OUVERT</Text>
        </View>
      </View>

      <View style={styles.details}>
        <View style={styles.detailItem}>
          <Package size={16} color={colors.textSecondary} />
          <Text style={styles.detailText}>{item.packages_ids.length} colis chargés</Text>
        </View>
        <View style={styles.detailItem}>
          <FileText size={16} color={colors.textSecondary} />
          <Text style={styles.detailText}>ETA: {new Date(item.estimated_arrival).toLocaleDateString()}</Text>
        </View>
      </View>

      <TouchableOpacity 
        style={styles.closeBtn} 
        onPress={() => onCloture(item.id, item.container_number)}
        disabled={closing === item.id}
      >
        {closing === item.id ? <ActivityIndicator color="#fff" /> : (
          <>
            <Lock size={18} color="#fff" />
            <Text style={styles.closeBtnText}>Clôturer le Chargement</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <ChevronLeft size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Clôture & Packing List</Text>
        <View style={{ width: 26 }} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <FlatList
          data={containers}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <CheckCircle2 size={64} color={colors.success} opacity={0.5} />
              <Text style={styles.emptyText}>Aucun conteneur ouvert pour le moment.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, backgroundColor: '#fff', ...shadow.card },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  back: { padding: 4 },
  list: { padding: spacing.lg },
  card: { backgroundColor: '#fff', borderRadius: radii.card, padding: spacing.lg, marginBottom: spacing.lg, ...shadow.card },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  iconWrap: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  containerNum: { fontSize: 18, fontWeight: '800', color: colors.text, fontFamily: fonts.mono },
  route: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  statusBadge: { backgroundColor: `${colors.success}15`, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusText: { color: colors.success, fontSize: 10, fontWeight: '800' },
  details: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.borderLight, paddingTop: spacing.md, marginBottom: spacing.lg },
  detailItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailText: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
  closeBtn: { backgroundColor: colors.primary, borderRadius: radii.button, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, ...shadow.floating },
  closeBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 100, gap: spacing.md },
  emptyText: { color: colors.textSecondary, fontSize: 16, fontWeight: '600', textAlign: 'center' },
});
