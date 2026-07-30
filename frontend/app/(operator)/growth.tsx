import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { growthApi } from '../../src/api/growth';
import { formatErr } from '../../src/api/client';
import { useAuthStore } from '../../src/store/authStore';
import { darkColors as colors, radii, spacing } from '../../src/constants/theme';

export default function OperatorGrowthScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';
  const [tab, setTab] = useState<'agents' | 'commissions' | 'settings'>('agents');
  const [agents, setAgents] = useState<any[]>([]);
  const [commissions, setCommissions] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>({});
  const [rate, setRate] = useState('5');
  const [loading, setLoading] = useState(true);

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
      setRate(String(s?.default_commission_rate_percent ?? 5));
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveSettings = async () => {
    if (!isAdmin) return;
    try {
      await growthApi.updateSettings({ default_commission_rate_percent: Number(rate) });
      Toast.show({ type: 'success', text1: 'Paramètres enregistrés' });
      load();
    } catch (e: any) {
      Toast.show({ type: 'error', text1: formatErr(e, 'Erreur') });
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><ChevronLeft size={24} color={colors.text} /></TouchableOpacity>
        <Text style={styles.title}>Commerciaux</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.tabs}>
        {([
          ['agents', 'Agents'],
          ['commissions', 'Commissions'],
          ['settings', 'Réglages'],
        ] as const).map(([k, label]) => (
          <TouchableOpacity key={k} style={[styles.tab, tab === k && styles.tabOn]} onPress={() => setTab(k)}>
            <Text style={[styles.tabText, tab === k && styles.tabTextOn]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : tab === 'settings' ? (
        <View style={{ padding: spacing.lg }}>
          <Text style={styles.label}>% commission par défaut</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={rate}
            onChangeText={setRate}
            editable={isAdmin}
            placeholderTextColor={colors.textSecondary}
          />
          {isAdmin && (
            <TouchableOpacity style={styles.cta} onPress={saveSettings}>
              <Text style={styles.ctaText}>Enregistrer</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.hint}>Marketplace : {settings.marketplace_enabled === false ? 'off' : 'on'}</Text>
        </View>
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
                  <Text style={styles.cardTitle}>{item.full_name}</Text>
                  <Text style={styles.meta}>Code {item.referral_code} · {item.commission_rate_percent ?? rate}%</Text>
                </>
              ) : (
                <>
                  <Text style={styles.cardTitle}>{item.agent_name || item.agent_code}</Text>
                  <Text style={styles.meta}>
                    {Number(item.commission_xaf || 0).toLocaleString()} XAF · {item.source} · {item.status}
                  </Text>
                </>
              )}
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg },
  title: { fontSize: 18, fontWeight: '800', color: colors.text },
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: spacing.lg, marginBottom: 8 },
  tab: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.card },
  tabOn: { backgroundColor: colors.primary },
  tabText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  tabTextOn: { color: '#fff' },
  card: { backgroundColor: colors.card, borderRadius: 14, padding: 14, marginBottom: 10 },
  cardTitle: { fontWeight: '800', color: colors.text },
  meta: { marginTop: 4, fontSize: 12, color: colors.textSecondary },
  empty: { textAlign: 'center', color: colors.textSecondary, marginTop: 40 },
  label: { color: colors.textSecondary, fontWeight: '700', marginBottom: 8 },
  input: { backgroundColor: colors.card, borderRadius: radii.input, padding: 12, color: colors.text, marginBottom: 12 },
  cta: { backgroundColor: colors.primary, borderRadius: radii.button, paddingVertical: 14, alignItems: 'center' },
  ctaText: { color: '#fff', fontWeight: '800' },
  hint: { marginTop: 16, color: colors.textSecondary, fontSize: 12 },
});
