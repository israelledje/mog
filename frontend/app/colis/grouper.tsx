import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, CheckSquare, Square, Layers } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { useColisStore } from '../../src/store/colisStore';
import { colisApi } from '../../src/api/colis';
import { api, formatErr } from '../../src/api/client';
import { colors, radii, spacing } from '../../src/constants/theme';

export default function GroupPackagesScreen() {
  const router = useRouter();
  const colis = useColisStore((s) => s.colis);
  const fetchColis = useColisStore((s) => s.fetchColis);
  const [selected, setSelected] = useState<string[]>([]);
  const [label, setLabel] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchColis();
  }, [fetchColis]);

  const eligible = colis.filter((c) =>
    ['pending_reception', 'received', 'quoted', 'grouped'].includes(c.status) && !c.container_id,
  );

  const toggle = (id: string) => {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };

  const onGroup = async () => {
    if (selected.length < 2) {
      Toast.show({ type: 'error', text1: 'Sélectionnez au moins 2 colis' });
      return;
    }
    setLoading(true);
    try {
      await api.post('/colis/group-client', { package_ids: selected, label: label || undefined });
      Toast.show({ type: 'success', text1: 'Expédition groupée créée' });
      await fetchColis();
      router.back();
    } catch (e: any) {
      Toast.show({ type: 'error', text1: formatErr(e, 'Impossible de grouper') });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><ChevronLeft size={24} color={colors.text} /></TouchableOpacity>
        <Text style={styles.title}>Grouper mes colis</Text>
        <View style={{ width: 24 }} />
      </View>
      <Text style={styles.hint}>Regroupez plusieurs colis en une seule expédition pour faciliter le suivi.</Text>
      <TextInput
        style={styles.input}
        placeholder="Nom de l'expédition (optionnel)"
        placeholderTextColor={colors.textSecondary}
        value={label}
        onChangeText={setLabel}
      />
      <FlatList
        data={eligible}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: spacing.lg }}
        ListEmptyComponent={<Text style={styles.empty}>Aucun colis regroupable</Text>}
        renderItem={({ item }) => {
          const on = selected.includes(item.id);
          return (
            <TouchableOpacity style={[styles.row, on && styles.rowOn]} onPress={() => toggle(item.id)}>
              {on ? <CheckSquare size={22} color={colors.primary} /> : <Square size={22} color={colors.textSecondary} />}
              <View style={{ flex: 1 }}>
                <Text style={styles.tracking}>{item.tracking_number}</Text>
                <Text style={styles.desc} numberOfLines={1}>{item.description}</Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />
      <TouchableOpacity style={styles.cta} onPress={onGroup} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : (
          <>
            <Layers size={18} color="#fff" />
            <Text style={styles.ctaText}>Créer l'expédition ({selected.length})</Text>
          </>
        )}
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FB' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, backgroundColor: '#fff' },
  title: { fontSize: 18, fontWeight: '800', color: colors.text },
  hint: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, color: colors.textSecondary, fontSize: 13, lineHeight: 18 },
  input: { marginHorizontal: spacing.lg, marginTop: spacing.md, backgroundColor: '#fff', borderRadius: radii.input, paddingHorizontal: 14, paddingVertical: 12, color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', padding: 14, borderRadius: 12, marginBottom: 8 },
  rowOn: { borderWidth: 1.5, borderColor: colors.primary },
  tracking: { fontWeight: '800', color: colors.text },
  desc: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  empty: { textAlign: 'center', color: colors.textSecondary, marginTop: 40 },
  cta: { margin: spacing.lg, backgroundColor: colors.primary, borderRadius: radii.button, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  ctaText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
