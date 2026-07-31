import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Modal,
  ActivityIndicator, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, Search, Gift, Package, FileText, ShoppingBag, Pencil } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { adminApi, type AdminUser } from '../../src/api/admin';
import { colisApi, invoicesApi } from '../../src/api/colis';
import { marketplaceApi } from '../../src/api/marketplace';
import { formatErr } from '../../src/api/client';
import { useAuthStore } from '../../src/store/authStore';
import { darkColors as colors, radii, spacing } from '../../src/constants/theme';

export default function CustomersAdminScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [items, setItems] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [packages, setPackages] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editCity, setEditCity] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (user?.role !== 'admin') return;
    try {
      const data = await adminApi.customers();
      setItems(Array.isArray(data) ? data : []);
    } catch (e: any) {
      Toast.show({ type: 'error', text1: formatErr(e, 'Chargement clients') });
    } finally {
      setLoading(false);
    }
  }, [user?.role]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((c) =>
      `${c.full_name || ''} ${c.email || ''} ${c.phone || ''} ${c.client_code || ''}`.toLowerCase().includes(s),
    );
  }, [items, q]);

  const openDetail = async (c: AdminUser) => {
    setSelected(c);
    setEditName(c.full_name || '');
    setEditPhone(c.phone || '');
    setEditCity(c.city || '');
    setDetailLoading(true);
    try {
      const [pkgs, inv, ords] = await Promise.all([
        colisApi.list({ owner_id: c.email, limit: 50 }).catch(() => []),
        invoicesApi.list(c.email).catch(() => []),
        marketplaceApi.listOrders().catch(() => []),
      ]);
      setPackages(Array.isArray(pkgs) ? pkgs : []);
      setInvoices(Array.isArray(inv) ? inv : []);
      const allOrders = Array.isArray(ords) ? ords : [];
      setOrders(allOrders.filter((o: any) => o.customer_id === c.email || o.owner_id === c.email || o.user_email === c.email));
    } finally {
      setDetailLoading(false);
    }
  };

  const saveProfile = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await adminApi.updateUser(selected.id, {
        full_name: editName.trim(),
        phone: editPhone.trim(),
        city: editCity.trim(),
      });
      Toast.show({ type: 'success', text1: 'Client mis à jour' });
      setSelected(null);
      setLoading(true);
      load();
    } catch (e: any) {
      Toast.show({ type: 'error', text1: formatErr(e, 'Erreur') });
    } finally {
      setSaving(false);
    }
  };

  if (user?.role !== 'admin') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Text style={styles.empty}>Accès réservé aux administrateurs</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><ChevronLeft size={24} color={colors.text} /></TouchableOpacity>
        <Text style={styles.title}>Clients</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.searchRow}>
        <Search size={16} color={colors.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Nom, email, code client…"
          placeholderTextColor={colors.textSecondary}
          value={q}
          onChangeText={setQ}
        />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: spacing.lg }}
          ListEmptyComponent={<Text style={styles.empty}>Aucun client</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => openDetail(item)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{item.full_name || item.email}</Text>
                <Text style={styles.meta}>{item.email}</Text>
                <Text style={styles.meta}>
                  Code {item.client_code || '—'} · {item.loyalty_points ?? 0} pts CLUB
                </Text>
              </View>
              <Pencil size={16} color={colors.primary} />
            </TouchableOpacity>
          )}
        />
      )}

      <Modal visible={!!selected} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalBox} keyboardShouldPersistTaps="handled">
            {selected && (
              <>
                <Text style={styles.modalTitle}>{selected.full_name || selected.email}</Text>
                <View style={styles.kpiRow}>
                  <View style={styles.kpi}>
                    <Gift size={16} color="#F59E0B" />
                    <Text style={styles.kpiVal}>{selected.loyalty_points ?? 0}</Text>
                    <Text style={styles.kpiLab}>Points</Text>
                  </View>
                  <View style={styles.kpi}>
                    <Package size={16} color={colors.primary} />
                    <Text style={styles.kpiVal}>{packages.length}</Text>
                    <Text style={styles.kpiLab}>Colis</Text>
                  </View>
                  <View style={styles.kpi}>
                    <FileText size={16} color={colors.secondary} />
                    <Text style={styles.kpiVal}>{invoices.length}</Text>
                    <Text style={styles.kpiLab}>Factures</Text>
                  </View>
                  <View style={styles.kpi}>
                    <ShoppingBag size={16} color={colors.accent} />
                    <Text style={styles.kpiVal}>{orders.length}</Text>
                    <Text style={styles.kpiLab}>Commandes</Text>
                  </View>
                </View>

                <TextInput style={styles.input} value={editName} onChangeText={setEditName} placeholder="Nom" placeholderTextColor={colors.textSecondary} />
                <TextInput style={styles.input} value={editPhone} onChangeText={setEditPhone} placeholder="Téléphone" placeholderTextColor={colors.textSecondary} />
                <TextInput style={styles.input} value={editCity} onChangeText={setEditCity} placeholder="Ville" placeholderTextColor={colors.textSecondary} />

                <TouchableOpacity style={styles.cta} onPress={saveProfile} disabled={saving}>
                  {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>Enregistrer le profil</Text>}
                </TouchableOpacity>

                {detailLoading ? (
                  <ActivityIndicator color={colors.primary} style={{ marginTop: 16 }} />
                ) : (
                  <>
                    <Text style={styles.section}>Activité colis</Text>
                    {packages.slice(0, 8).map((p) => (
                      <Text key={p.id || p._id} style={styles.line}>
                        {p.tracking_number} · {p.status} · {p.payment_status || '—'}
                      </Text>
                    ))}
                    {!packages.length && <Text style={styles.meta}>Aucun colis</Text>}

                    <Text style={styles.section}>Factures</Text>
                    {invoices.slice(0, 8).map((inv) => (
                      <Text key={inv.id} style={styles.line}>
                        {inv.invoice_number} · {inv.status} · {Number(inv.total_price || 0).toLocaleString()} XAF
                      </Text>
                    ))}
                    {!invoices.length && <Text style={styles.meta}>Aucune facture</Text>}

                    <Text style={styles.section}>Commandes Market</Text>
                    {orders.slice(0, 8).map((o) => (
                      <Text key={o.id} style={styles.line}>
                        {o.product_title || o.id} · {o.status} · {Number(o.total_xaf || 0).toLocaleString()} XAF
                      </Text>
                    ))}
                    {!orders.length && <Text style={styles.meta}>Aucune commande</Text>}
                  </>
                )}

                <TouchableOpacity onPress={() => setSelected(null)} style={{ marginTop: 16 }}>
                  <Text style={{ color: colors.textSecondary, textAlign: 'center', fontWeight: '700' }}>Fermer</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg },
  title: { fontSize: 18, fontWeight: '800', color: colors.text },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: spacing.lg,
    backgroundColor: colors.card, borderRadius: radii.input, paddingHorizontal: 12, marginBottom: 8,
  },
  searchInput: { flex: 1, height: 44, color: colors.text },
  card: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card,
    borderRadius: 14, padding: 14, marginBottom: 10, gap: 10,
  },
  cardTitle: { fontWeight: '800', color: colors.text },
  meta: { marginTop: 4, fontSize: 12, color: colors.textSecondary },
  empty: { textAlign: 'center', color: colors.textSecondary, marginTop: 40 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40 },
  modalTitle: { fontSize: 18, fontWeight: '900', color: colors.text, marginBottom: 12 },
  kpiRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  kpi: { flex: 1, backgroundColor: colors.background, borderRadius: 12, padding: 10, alignItems: 'center', gap: 4 },
  kpiVal: { fontWeight: '900', color: colors.text, fontSize: 16 },
  kpiLab: { fontSize: 10, color: colors.textSecondary, fontWeight: '700' },
  input: { backgroundColor: colors.background, borderRadius: radii.input, padding: 12, color: colors.text, marginBottom: 10 },
  cta: { backgroundColor: colors.primary, borderRadius: radii.button, paddingVertical: 14, alignItems: 'center', marginBottom: 8 },
  ctaText: { color: '#fff', fontWeight: '800' },
  section: { marginTop: 14, marginBottom: 6, fontWeight: '800', color: colors.textSecondary, textTransform: 'uppercase', fontSize: 11 },
  line: { color: colors.text, fontSize: 12, marginBottom: 4 },
});
