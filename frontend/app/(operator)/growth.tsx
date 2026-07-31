import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, TextInput, Modal, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Plus, Check } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { growthApi } from '../../src/api/growth';
import { formatErr } from '../../src/api/client';
import { useAuthStore } from '../../src/store/authStore';
import { darkColors as colors, radii, spacing } from '../../src/constants/theme';

const DEFAULT_TIERS = [
  { id: 'bronze', name: 'Bronze', min_cbm: 0, points_per_cbm: 10, emoji: '🥉' },
  { id: 'silver', name: 'Silver', min_cbm: 20, points_per_cbm: 15, emoji: '🥈' },
  { id: 'gold', name: 'Gold', min_cbm: 50, points_per_cbm: 20, emoji: '🥇' },
  { id: 'vip', name: 'VIP', min_cbm: 100, points_per_cbm: 25, emoji: '🏆' },
];

type Tab = 'agents' | 'commissions' | 'settings';

export default function OperatorGrowthScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';
  const [tab, setTab] = useState<Tab>((params.tab as Tab) || 'agents');
  const [agents, setAgents] = useState<any[]>([]);
  const [commissions, setCommissions] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [showAgent, setShowAgent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [agentForm, setAgentForm] = useState({
    full_name: '', email: '', phone: '', referral_code: '', commission_rate_percent: '5',
  });
  const [clubForm, setClubForm] = useState({
    point_value_xaf: '20',
    default_commission_rate_percent: '5',
    referral_signup_bonus_points: '50',
    vip_benefits: '',
    loyalty_tiers: DEFAULT_TIERS as any[],
  });

  const load = useCallback(async () => {
    try {
      const [a, c, s] = await Promise.all([
        growthApi.listAgents(),
        growthApi.listCommissions(),
        growthApi.getSettings(),
      ]);
      setAgents(Array.isArray(a) ? a : []);
      setCommissions(Array.isArray(c) ? c : []);
      setSettings(s || {});
      setClubForm({
        point_value_xaf: String(s?.point_value_xaf ?? 20),
        default_commission_rate_percent: String(s?.default_commission_rate_percent ?? 5),
        referral_signup_bonus_points: String(s?.referral_signup_bonus_points ?? 50),
        vip_benefits: s?.vip_benefits || '',
        loyalty_tiers: Array.isArray(s?.loyalty_tiers) && s.loyalty_tiers.length ? s.loyalty_tiers : DEFAULT_TIERS,
      });
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (params.tab === 'settings' || params.tab === 'agents' || params.tab === 'commissions') {
      setTab(params.tab);
    }
  }, [params.tab]);

  const createAgent = async () => {
    if (!isAdmin) return;
    if (!agentForm.full_name.trim() || !agentForm.email.trim()) {
      Toast.show({ type: 'error', text1: 'Nom et email requis' });
      return;
    }
    setSaving(true);
    try {
      await growthApi.createAgent({
        full_name: agentForm.full_name.trim(),
        email: agentForm.email.trim(),
        phone: agentForm.phone || null,
        referral_code: agentForm.referral_code.trim().toUpperCase() || null,
        commission_rate_percent: Number(agentForm.commission_rate_percent),
        active: true,
      });
      setShowAgent(false);
      setAgentForm({ full_name: '', email: '', phone: '', referral_code: '', commission_rate_percent: '5' });
      load();
      Toast.show({ type: 'success', text1: 'Partenaire créé' });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: formatErr(e, 'Erreur') });
    } finally {
      setSaving(false);
    }
  };

  const toggleAgent = async (item: any) => {
    if (!isAdmin) return;
    try {
      await growthApi.updateAgent(item.id, { active: !item.active });
      load();
    } catch (e: any) {
      Toast.show({ type: 'error', text1: formatErr(e, 'Erreur') });
    }
  };

  const payCommission = async (id: string) => {
    if (!isAdmin) return;
    try {
      await growthApi.payCommission(id);
      Toast.show({ type: 'success', text1: 'Commission payée' });
      load();
    } catch (e: any) {
      Toast.show({ type: 'error', text1: formatErr(e, 'Erreur') });
    }
  };

  const saveClub = async () => {
    if (!isAdmin) return;
    setSaving(true);
    try {
      await growthApi.updateSettings({
        point_value_xaf: Number(clubForm.point_value_xaf),
        default_commission_rate_percent: Number(clubForm.default_commission_rate_percent),
        referral_signup_bonus_points: Number(clubForm.referral_signup_bonus_points),
        vip_benefits: clubForm.vip_benefits,
        loyalty_tiers: clubForm.loyalty_tiers.map((t) => ({
          ...t,
          min_cbm: Number(t.min_cbm),
          points_per_cbm: Number(t.points_per_cbm),
        })),
      });
      Toast.show({ type: 'success', text1: 'Règles M.O.G CLUB enregistrées' });
      load();
    } catch (e: any) {
      Toast.show({ type: 'error', text1: formatErr(e, 'Erreur') });
    } finally {
      setSaving(false);
    }
  };

  const pendingTotal = commissions
    .filter((c) => c.status === 'pending')
    .reduce((s, c) => s + Number(c.commission_xaf || 0), 0);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><ChevronLeft size={24} color={colors.text} /></TouchableOpacity>
        <Text style={styles.title}>{isAdmin ? 'M.O.G PARTNERS' : 'Commerciaux'}</Text>
        {isAdmin && tab === 'agents' ? (
          <TouchableOpacity onPress={() => setShowAgent(true)}><Plus size={22} color={colors.primary} /></TouchableOpacity>
        ) : <View style={{ width: 24 }} />}
      </View>

      {isAdmin && (
        <Text style={styles.pendingBanner}>
          Commissions en attente · {pendingTotal.toLocaleString()} XAF
        </Text>
      )}

      <View style={styles.tabs}>
        {([
          ['agents', 'Partenaires'],
          ['commissions', 'Commissions'],
          ['settings', 'M.O.G CLUB'],
        ] as const).map(([k, label]) => (
          <TouchableOpacity key={k} style={[styles.tab, tab === k && styles.tabOn]} onPress={() => setTab(k)}>
            <Text style={[styles.tabText, tab === k && styles.tabTextOn]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : tab === 'settings' ? (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}>
          {!isAdmin && (
            <Text style={styles.hint}>Lecture seule — réservé aux administrateurs pour modification.</Text>
          )}
          <Text style={styles.label}>Valeur 1 point (FCFA)</Text>
          <TextInput style={styles.input} keyboardType="numeric" editable={isAdmin} value={clubForm.point_value_xaf} onChangeText={(v) => setClubForm({ ...clubForm, point_value_xaf: v })} placeholderTextColor={colors.textSecondary} />
          <Text style={styles.label}>% commission défaut</Text>
          <TextInput style={styles.input} keyboardType="numeric" editable={isAdmin} value={clubForm.default_commission_rate_percent} onChangeText={(v) => setClubForm({ ...clubForm, default_commission_rate_percent: v })} placeholderTextColor={colors.textSecondary} />
          <Text style={styles.label}>Bonus points inscription</Text>
          <TextInput style={styles.input} keyboardType="numeric" editable={isAdmin} value={clubForm.referral_signup_bonus_points} onChangeText={(v) => setClubForm({ ...clubForm, referral_signup_bonus_points: v })} placeholderTextColor={colors.textSecondary} />
          <Text style={styles.label}>Avantages VIP</Text>
          <TextInput style={[styles.input, { minHeight: 70 }]} multiline editable={isAdmin} value={clubForm.vip_benefits} onChangeText={(v) => setClubForm({ ...clubForm, vip_benefits: v })} placeholderTextColor={colors.textSecondary} />

          <Text style={[styles.label, { marginTop: 8 }]}>Paliers (seuil CBM → pts/CBM)</Text>
          {clubForm.loyalty_tiers.map((tier, idx) => (
            <View key={tier.id} style={styles.tierRow}>
              <Text style={styles.tierName}>{tier.emoji} {tier.name}</Text>
              <TextInput
                style={styles.tierInput}
                keyboardType="numeric"
                editable={isAdmin}
                value={String(tier.min_cbm)}
                onChangeText={(v) => {
                  const next = [...clubForm.loyalty_tiers];
                  next[idx] = { ...tier, min_cbm: v };
                  setClubForm({ ...clubForm, loyalty_tiers: next });
                }}
                placeholderTextColor={colors.textSecondary}
              />
              <TextInput
                style={styles.tierInput}
                keyboardType="numeric"
                editable={isAdmin}
                value={String(tier.points_per_cbm)}
                onChangeText={(v) => {
                  const next = [...clubForm.loyalty_tiers];
                  next[idx] = { ...tier, points_per_cbm: v };
                  setClubForm({ ...clubForm, loyalty_tiers: next });
                }}
                placeholderTextColor={colors.textSecondary}
              />
            </View>
          ))}
          <Text style={styles.hint}>Points crédités à l’expédition confirmée (en transit).</Text>
          {isAdmin && (
            <TouchableOpacity style={styles.cta} onPress={saveClub} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>Enregistrer</Text>}
            </TouchableOpacity>
          )}
          <Text style={styles.hint}>Market : {settings.marketplace_enabled === false ? 'off' : 'on'}</Text>
        </ScrollView>
      ) : (
        <FlatList
          data={tab === 'agents' ? agents : commissions}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: spacing.lg }}
          ListEmptyComponent={<Text style={styles.empty}>Aucune donnée</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              {tab === 'agents' ? (
                <>
                  <View style={styles.cardHead}>
                    <Text style={styles.cardTitle}>{item.full_name}</Text>
                    {isAdmin && (
                      <TouchableOpacity onPress={() => toggleAgent(item)} style={[styles.statusChip, item.active ? styles.statusOn : styles.statusOff]}>
                        <Text style={styles.statusText}>{item.active ? 'Actif' : 'Off'}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <Text style={styles.meta}>Code {item.referral_code} · {item.commission_rate_percent ?? clubForm.default_commission_rate_percent}%</Text>
                  <Text style={styles.statsLine}>
                    {item.stats?.clients_count ?? 0} clients · {item.stats?.orders_count ?? 0} cmd · {Number(item.stats?.total_cbm || 0).toLocaleString()} CBM
                  </Text>
                  <Text style={styles.pendingLine}>
                    À payer · {Number(item.stats?.pending_commission_xaf || 0).toLocaleString()} XAF
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.cardTitle}>{item.agent_name || item.agent_code}</Text>
                  <Text style={styles.meta}>
                    {Number(item.commission_xaf || 0).toLocaleString()} XAF · {item.source} · {item.status}
                  </Text>
                  {isAdmin && item.status === 'pending' && (
                    <TouchableOpacity style={styles.payBtn} onPress={() => payCommission(item.id)}>
                      <Check size={14} color="#fff" />
                      <Text style={styles.payBtnText}>Marquer payé</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>
          )}
        />
      )}

      <Modal visible={showAgent} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalBox}>
            <Text style={styles.modalTitle}>Nouveau partenaire</Text>
            <TextInput style={styles.input} placeholder="Nom complet" placeholderTextColor={colors.textSecondary} value={agentForm.full_name} onChangeText={(v) => setAgentForm({ ...agentForm, full_name: v })} />
            <TextInput style={styles.input} placeholder="Email" placeholderTextColor={colors.textSecondary} autoCapitalize="none" keyboardType="email-address" value={agentForm.email} onChangeText={(v) => setAgentForm({ ...agentForm, email: v })} />
            <TextInput style={styles.input} placeholder="Téléphone" placeholderTextColor={colors.textSecondary} value={agentForm.phone} onChangeText={(v) => setAgentForm({ ...agentForm, phone: v })} />
            <TextInput style={styles.input} placeholder="Code (auto si vide)" placeholderTextColor={colors.textSecondary} autoCapitalize="characters" value={agentForm.referral_code} onChangeText={(v) => setAgentForm({ ...agentForm, referral_code: v })} />
            <TextInput style={styles.input} placeholder="% commission" placeholderTextColor={colors.textSecondary} keyboardType="numeric" value={agentForm.commission_rate_percent} onChangeText={(v) => setAgentForm({ ...agentForm, commission_rate_percent: v })} />
            <TouchableOpacity style={styles.cta} onPress={createAgent} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>Créer</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowAgent(false)} style={{ marginTop: 12 }}>
              <Text style={{ color: colors.textSecondary, textAlign: 'center', fontWeight: '700' }}>Annuler</Text>
            </TouchableOpacity>
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
  pendingBanner: {
    marginHorizontal: spacing.lg,
    marginBottom: 8,
    color: '#FBBF24',
    fontSize: 12,
    fontWeight: '700',
  },
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: spacing.lg, marginBottom: 8 },
  tab: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.card },
  tabOn: { backgroundColor: colors.primary },
  tabText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  tabTextOn: { color: '#fff' },
  card: { backgroundColor: colors.card, borderRadius: 14, padding: 14, marginBottom: 10 },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardTitle: { fontWeight: '800', color: colors.text, flex: 1 },
  meta: { marginTop: 4, fontSize: 12, color: colors.textSecondary },
  statsLine: { marginTop: 6, fontSize: 12, fontWeight: '700', color: colors.text },
  pendingLine: { marginTop: 4, fontSize: 12, fontWeight: '800', color: '#FBBF24' },
  statusChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusOn: { backgroundColor: 'rgba(16,185,129,0.2)' },
  statusOff: { backgroundColor: 'rgba(148,163,184,0.2)' },
  statusText: { fontSize: 10, fontWeight: '800', color: colors.text },
  payBtn: {
    marginTop: 10, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#059669', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
  },
  payBtnText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  empty: { textAlign: 'center', color: colors.textSecondary, marginTop: 40 },
  label: { color: colors.textSecondary, fontWeight: '700', marginBottom: 8, marginTop: 4 },
  input: { backgroundColor: colors.card, borderRadius: radii.input, padding: 12, color: colors.text, marginBottom: 12 },
  tierRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  tierName: { width: 90, color: colors.text, fontWeight: '700', fontSize: 12 },
  tierInput: { flex: 1, backgroundColor: colors.card, borderRadius: 10, padding: 10, color: colors.text },
  cta: { backgroundColor: colors.primary, borderRadius: radii.button, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  ctaText: { color: '#fff', fontWeight: '800' },
  hint: { marginTop: 12, color: colors.textSecondary, fontSize: 12, lineHeight: 17 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40 },
  modalTitle: { fontSize: 18, fontWeight: '900', color: colors.text, marginBottom: 16 },
});
