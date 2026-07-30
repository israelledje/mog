import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { marketplaceApi, type MarketplaceOrder } from '../../src/api/marketplace';
import { colors, spacing } from '../../src/constants/theme';

export default function MarketplaceOrdersScreen() {
  const router = useRouter();
  const [orders, setOrders] = useState<MarketplaceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await marketplaceApi.myOrders();
      setOrders(Array.isArray(data) ? data : []);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><ChevronLeft size={24} color={colors.text} /></TouchableOpacity>
        <Text style={styles.title}>Mes commandes</Text>
        <View style={{ width: 24 }} />
      </View>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => o.id}
          contentContainerStyle={{ padding: spacing.lg }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          ListEmptyComponent={<Text style={styles.empty}>Aucune commande marketplace</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => item.tracking_number && router.push(`/colis/${(item as any).package_id || ''}` as any)}
              disabled={!(item as any).package_id}
            >
              <Text style={styles.tracking}>{item.tracking_number}</Text>
              <Text style={styles.name}>{item.product_title} ×{item.quantity || 1}</Text>
              <Text style={styles.meta}>
                {Number(item.total_xaf || 0).toLocaleString('fr-FR')} XAF · {item.payment_status || 'pending'} · {item.status}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FB' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, backgroundColor: '#fff' },
  title: { fontSize: 18, fontWeight: '800', color: colors.text },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10 },
  tracking: { fontWeight: '900', color: colors.primary, fontFamily: 'monospace' },
  name: { marginTop: 4, fontWeight: '700', color: colors.text },
  meta: { marginTop: 4, fontSize: 12, color: colors.textSecondary },
  empty: { textAlign: 'center', marginTop: 40, color: colors.textSecondary },
});
