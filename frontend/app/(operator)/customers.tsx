import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Modal,
  ActivityIndicator, ScrollView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ChevronLeft, Search, Gift, Package, FileText, ShoppingBag, Pencil, Plus, Smartphone,
} from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { adminApi, type AdminUser } from '../../src/api/admin';
import { invoicesApi } from '../../src/api/colis';
import { marketplaceApi } from '../../src/api/marketplace';
import { formatErr } from '../../src/api/client';
import { useAuthStore } from '../../src/store/authStore';
import { darkColors as colors, radii, spacing } from '../../src/constants/theme';

export default function CustomersAdminScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';
  const canAccess = user?.role === 'admin' || user?.role === 'operator';

  const [items, setItems] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'app' | 'walkin'>('all');
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [packages, setPackages] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editCity, setEditCity] = useState('');
  const [saving, setSaving] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newForm, setNewForm] = useState({ full_name: '', phone: '', city: 'Douala', notes: '' });

  const [showEnable, setShowEnable] = useState(false);
  const [enableEmail, setEnableEmail] = useState('');
  const [enabling, setEnabling] = useState(false);

  const load = useCallback(async () => {
    if (!canAccess) return;
    try {
      const data = await adminApi.customers();
      setItems(Array.isArray(data) ? data : []);
    } catch (e: any) {
      Toast.show({ type: 'error', text1: formatErr(e, 'Chargement clients') });
    } finally {
      setLoading(false);
    }
  }, [canAccess]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    let list = items;
    if (filter === 'app') list = list.filter((c) => c.app_enabled);
    if (filter === 'walkin') list = list.filter((c) => !c.app_enabled);
    const s = q.trim().toLowerCase();
    if (!s) return list;
    return list.filter((c) =>
      `${c.full_name || ''} ${c.email || ''} ${c.phone || ''} ${c.client_code || ''}`.toLowerCase().includes(s),
    );
  }, [items, q, filter]);

  const openDetail = async (c: AdminUser) => {
    setSelected(c);
    setEditName(c.full_name || '');
    setEditPhone(c.phone || '');
    setEditCity(c.city || '');
    setEnableEmail(c.email?.endsWith('@mog.local') ? '' : (c.email || ''));
    setDetailLoading(true);
    try {
      const [pkgs, inv, ords] = await Promise.all([
        adminApi.customerPackages(c.id).catch(() => []),
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
    if (!selected || !isAdmin) return;
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

  const createOperational = async () => {
    if (!newForm.full_name.trim() || !newForm.phone.trim()) {
      Toast.show({ type: 'error', text1: 'Nom et téléphone requis' });
      return;
    }
    setCreating(true);
    try {
      const created = await adminApi.createOperationalCustomer({
        full_name: newForm.full_name.trim(),
        phone: newForm.phone.trim(),
        city: newForm.city.trim() || 'Douala',
        notes: newForm.notes.trim() || undefined,
      });
      setShowCreate(false);
      setNewForm({ full_name: '', phone: '', city: 'Douala', notes: '' });
      Toast.show({
        type: 'success',
        text1: created.reused ? 'Fiche existante réutilisée' : 'Fiche client créée (sans compte app)',
      });
      setLoading(true);
      await load();
      openDetail(created);
    } catch (e: any) {
      Toast.show({ type: 'error', text1: formatErr(e, 'Création impossible') });
    } finally {
      setCreating(false);
    }
  };

  const enableApp = async () => {
    if (!selected) return;
    if (!enableEmail.trim() || !enableEmail.includes('@') || enableEmail.endsWith('@mog.local')) {
      Toast.show({ type: 'error', text1: 'Indiquez un vrai email client' });
      return;
    }
    setEnabling(true);
    try {
      const res = await adminApi.enableCustomerApp(selected.id, { email: enableEmail.trim().toLowerCase() });
      setShowEnable(false);
      Alert.alert(
        'Compte app activé',
        `Email : ${res.email}\nMot de passe temporaire : ${res.temporary_password}\n\nCommuniquez-le au client.`,
      );
      setSelected(null);
      setLoading(true);
      load();
    } catch (e: any) {
      Toast.show({ type: 'error', text1: formatErr(e, 'Activation impossible') });
    } finally {
      setEnabling(false);
    }
  };

  if (!canAccess) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Text style={styles.empty}>Accès réservé au personnel</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><ChevronLeft size={24} color={colors.text} /></TouchableOpacity>
        <Text style={styles.title}>Clients</Text>
        <TouchableOpacity onPress={() => setShowCreate(true)}>
          <Plus size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchRow}>
        <Search size={16} color={colors.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Nom, téléphone, code…"
          placeholderTextColor={colors.textSecondary}
          value={q}
          onChangeText={setQ}
        />
      </View>

      <View style={styles.filters}>
        {([
          ['all', 'Tous'],
          ['walkin', 'Sans compte'],
          ['app', 'Compte app'],
        ] as const).map(([k, label]) => (
          <TouchableOpacity
            key={k}
            style={[styles.filterChip, filter === k && styles.filterOn]}
            onPress={() => setFilter(k)}
          >
            <Text style={[styles.filterText, filter === k && { color: '#fff' }]}>{label}</Text>
          </TouchableOpacity>
        ))}
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
                <Text style={styles.meta}>{item.phone || item.email}</Text>
                <Text style={styles.meta}>
                  Code {item.client_code || '—'} · {item.loyalty_points ?? 0} pts CLUB
                </Text>
                <View style={[styles.badge, item.app_enabled ? styles.badgeApp : styles.badgeWalkin]}>
                  <Text style={styles.badgeText}>
                    {item.app_enabled ? 'Compte app' : 'Sans compte app'}
                  </Text>
                </View>
              </View>
              <Pencil size={16} color={colors.primary} />
            </TouchableOpacity>
          )}
        />
      )}

      {/* Création fiche métier */}
      <Modal visible={showCreate} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Nouveau client (fiche métier)</Text>
            <Text style={styles.hint}>
              Crée une fiche pour réception / stock / facture — sans activer l’app. Vous pourrez générer le compte plus tard.
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Nom complet *"
              placeholderTextColor={colors.textSecondary}
              value={newForm.full_name}
              onChangeText={(v) => setNewForm({ ...newForm, full_name: v })}
            />
            <TextInput
              style={styles.input}
              placeholder="Téléphone *"
              placeholderTextColor={colors.textSecondary}
              keyboardType="phone-pad"
              value={newForm.phone}
              onChangeText={(v) => setNewForm({ ...newForm, phone: v })}
            />
            <TextInput
              style={styles.input}
              placeholder="Ville"
              placeholderTextColor={colors.textSecondary}
              value={newForm.city}
              onChangeText={(v) => setNewForm({ ...newForm, city: v })}
            />
            <TextInput
              style={styles.input}
              placeholder="Notes (optionnel)"
              placeholderTextColor={colors.textSecondary}
              value={newForm.notes}
              onChangeText={(v) => setNewForm({ ...newForm, notes: v })}
            />
            <TouchableOpacity style={styles.cta} onPress={createOperational} disabled={creating}>
              {creating ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>Créer la fiche</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowCreate(false)}>
              <Text style={{ color: colors.textSecondary, textAlign: 'center', fontWeight: '700' }}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Détail */}
      <Modal visible={!!selected} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalBox} keyboardShouldPersistTaps="handled">
            {selected && (
              <>
                <Text style={styles.modalTitle}>{selected.full_name || selected.email}</Text>
                <View style={[styles.badge, selected.app_enabled ? styles.badgeApp : styles.badgeWalkin, { alignSelf: 'flex-start', marginBottom: 12 }]}>
                  <Text style={styles.badgeText}>
                    {selected.app_enabled ? 'Compte app actif' : 'Sans compte app'}
                  </Text>
                </View>

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

                {isAdmin ? (
                  <>
                    <TextInput style={styles.input} value={editName} onChangeText={setEditName} placeholder="Nom" placeholderTextColor={colors.textSecondary} />
                    <TextInput style={styles.input} value={editPhone} onChangeText={setEditPhone} placeholder="Téléphone" placeholderTextColor={colors.textSecondary} />
                    <TextInput style={styles.input} value={editCity} onChangeText={setEditCity} placeholder="Ville" placeholderTextColor={colors.textSecondary} />
                    <TouchableOpacity style={styles.cta} onPress={saveProfile} disabled={saving}>
                      {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>Enregistrer le profil</Text>}
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <Text style={styles.meta}>Tél. {selected.phone || '—'} · {selected.city || '—'}</Text>
                    <Text style={styles.meta}>{selected.email}</Text>
                  </>
                )}

                {isAdmin && !selected.app_enabled && (
                  <TouchableOpacity
                    style={[styles.cta, { backgroundColor: colors.secondary, flexDirection: 'row', gap: 8, justifyContent: 'center' }]}
                    onPress={() => setShowEnable(true)}
                  >
                    <Smartphone size={18} color="#fff" />
                    <Text style={styles.ctaText}>Générer le compte app</Text>
                  </TouchableOpacity>
                )}

                {detailLoading ? (
                  <ActivityIndicator color={colors.primary} style={{ marginTop: 16 }} />
                ) : (
                  <>
                    <Text style={styles.section}>Activité colis</Text>
                    {packages.slice(0, 12).map((p) => (
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

      {/* Activer compte app */}
      <Modal visible={showEnable} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Activer le compte app</Text>
            <Text style={styles.hint}>
              Un email réel et un mot de passe temporaire seront générés. Les colis déjà rattachés seront migrés.
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Email client *"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
              keyboardType="email-address"
              value={enableEmail}
              onChangeText={setEnableEmail}
            />
            <TouchableOpacity style={styles.cta} onPress={enableApp} disabled={enabling}>
              {enabling ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>Activer</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowEnable(false)}>
              <Text style={{ color: colors.textSecondary, textAlign: 'center', fontWeight: '700' }}>Annuler</Text>
            </TouchableOpacity>
          </View>
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
  filters: { flexDirection: 'row', gap: 8, paddingHorizontal: spacing.lg, marginBottom: 8 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.card },
  filterOn: { backgroundColor: colors.primary },
  filterText: { fontWeight: '700', fontSize: 12, color: colors.textSecondary },
  card: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card,
    borderRadius: 14, padding: 14, marginBottom: 10, gap: 10,
  },
  cardTitle: { fontWeight: '800', color: colors.text },
  meta: { marginTop: 4, fontSize: 12, color: colors.textSecondary },
  badge: { marginTop: 8, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeApp: { backgroundColor: `${colors.success}30` },
  badgeWalkin: { backgroundColor: `${colors.accent}30` },
  badgeText: { fontSize: 10, fontWeight: '800', color: colors.text },
  empty: { textAlign: 'center', color: colors.textSecondary, marginTop: 40 },
  hint: { fontSize: 12, color: colors.textSecondary, marginBottom: 12, lineHeight: 18 },
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
