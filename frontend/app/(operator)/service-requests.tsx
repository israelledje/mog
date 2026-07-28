import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Linking, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, Phone, MessageCircle, Check, Clock } from 'lucide-react-native';
import { servicesApi, type ServiceRequest } from '../../src/api/services';
import { darkColors as colors, spacing, shadow } from '../../src/constants/theme';

const STATUS_LABEL: Record<string, string> = {
  new: 'Nouvelle',
  contacted: 'Contacté',
  done: 'Terminé',
  cancelled: 'Annulé',
};

export default function OperatorServiceRequests() {
  const router = useRouter();
  const [items, setItems] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'new' | 'all'>('new');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await servicesApi.listForOps(filter === 'new' ? 'new' : undefined);
      setItems(data);
    } catch (e: any) {
      Alert.alert('Erreur', e?.response?.data?.detail || 'Impossible de charger les demandes');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const mark = async (id: string, status: ServiceRequest['status']) => {
    try {
      await servicesApi.updateStatus(id, status);
      load();
    } catch {
      Alert.alert('Erreur', 'Mise à jour impossible');
    }
  };

  const callPhone = (phone?: string) => {
    if (!phone) return;
    Linking.openURL(`tel:${phone.replace(/\s/g, '')}`);
  };

  const wa = (phone?: string, summary?: string) => {
    if (!phone) return;
    const digits = phone.replace(/\D/g, '');
    const text = encodeURIComponent(`Bonjour, suite à votre demande M.O.G.\n\n${summary || ''}`);
    Linking.openURL(`https://wa.me/${digits}?text=${text}`);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <ChevronLeft size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Demandes services</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.filters}>
        {(['new', 'all'] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.chip, filter === f && styles.chipActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.chipText, filter === f && styles.chipTextActive]}>
              {f === 'new' ? 'Nouvelles' : 'Toutes'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading && items.length === 0 ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />}
          ListEmptyComponent={<Text style={styles.empty}>Aucune demande</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.title}>{item.service_title}</Text>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{STATUS_LABEL[item.status] || item.status}</Text>
                </View>
              </View>
              <Text style={styles.meta}>
                {(item.customer_name || 'Client')} · {item.customer_phone || item.customer_email || '—'}
              </Text>
              <Text style={styles.summary} numberOfLines={8}>{item.summary}</Text>
              <View style={styles.actions}>
                <TouchableOpacity style={styles.actionBtn} onPress={() => callPhone(item.customer_phone)}>
                  <Phone size={16} color="#fff" />
                  <Text style={styles.actionTxt}>Appeler</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#25D366' }]} onPress={() => wa(item.customer_phone, item.summary)}>
                  <MessageCircle size={16} color="#fff" />
                  <Text style={styles.actionTxt}>WhatsApp</Text>
                </TouchableOpacity>
                {item.status === 'new' ? (
                  <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#F59E0B' }]} onPress={() => mark(item.id, 'contacted')}>
                    <Clock size={16} color="#fff" />
                    <Text style={styles.actionTxt}>Contacté</Text>
                  </TouchableOpacity>
                ) : item.status !== 'done' ? (
                  <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.success }]} onPress={() => mark(item.id, 'done')}>
                    <Check size={16} color="#fff" />
                    <Text style={styles.actionTxt}>OK</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '800', color: '#fff' },
  filters: { flexDirection: 'row', gap: 8, paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textSecondary, fontWeight: '700', fontSize: 13 },
  chipTextActive: { color: '#fff' },
  list: { padding: spacing.lg, paddingTop: 0, gap: 12 },
  empty: { textAlign: 'center', color: colors.textSecondary, marginTop: 40 },
  card: { backgroundColor: colors.card, borderRadius: 16, padding: 14, ...shadow.sm, marginBottom: 10 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginBottom: 6 },
  title: { flex: 1, color: colors.text, fontWeight: '800', fontSize: 15 },
  badge: { backgroundColor: '#1E3A5F', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeText: { color: '#93C5FD', fontSize: 11, fontWeight: '700' },
  meta: { color: colors.textSecondary, fontSize: 12, marginBottom: 8 },
  summary: { color: colors.text, fontSize: 13, lineHeight: 19, marginBottom: 12 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  actionTxt: { color: '#fff', fontWeight: '700', fontSize: 12 },
});
