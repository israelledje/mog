import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Modal,
  ActivityIndicator, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ChevronLeft, Plus, Percent, Tag, Sparkles, X, Check, FileText,
  DollarSign, ArrowRight, ToggleLeft, ToggleRight,
} from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { growthApi } from '../../src/api/growth';
import { formatErr } from '../../src/api/client';
import { darkColors as colors, radii, spacing, fonts, shadow } from '../../src/constants/theme';

export default function OperatorPromosScreen() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    code: '', label: '', discount_type: 'percent' as 'percent' | 'fixed', discount_value: '', applicable_to: 'all',
  });

  const load = useCallback(async () => {
    try {
      const data = await growthApi.listPromos();
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const applyPreset = (code: string, label: string, type: 'percent' | 'fixed', value: string) => {
    setForm({
      code,
      label,
      discount_type: type,
      discount_value: value,
      applicable_to: 'all',
    });
  };

  const create = async () => {
    if (!form.code.trim() || !form.discount_value) {
      Toast.show({ type: 'error', text1: 'Code et valeur de réduction requis' });
      return;
    }
    setSaving(true);
    try {
      await growthApi.createPromo({
        code: form.code.trim().toUpperCase(),
        label: form.label.trim() || undefined,
        discount_type: form.discount_type,
        discount_value: Number(form.discount_value),
        applicable_to: form.applicable_to,
        active: true,
      });
      setShow(false);
      setForm({ code: '', label: '', discount_type: 'percent', discount_value: '', applicable_to: 'all' });
      setLoading(true);
      load();
      Toast.show({ type: 'success', text1: 'Code promo créé avec succès' });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: formatErr(e, 'Erreur de création') });
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (item: any) => {
    try {
      await growthApi.updatePromo(item.id, { active: !item.active });
      load();
      Toast.show({
        type: 'info',
        text1: item.active ? 'Code promo désactivé' : 'Code promo activé',
      });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: formatErr(e, 'Erreur') });
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Codes promotionnels</Text>
        <TouchableOpacity onPress={() => setShow(true)} style={styles.headerAddBtn}>
          <Plus size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Tag size={40} color={colors.textSecondary} />
              <Text style={styles.empty}>Aucun code promo créé</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => setShow(true)}>
                <Plus size={16} color="#fff" />
                <Text style={styles.emptyBtnText}>Créer un premier code</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item }) => {
            const isPercent = item.discount_type === 'percent';
            return (
              <TouchableOpacity style={styles.card} onPress={() => toggle(item)} activeOpacity={0.8}>
                <View style={styles.cardHeader}>
                  <View style={styles.codeRow}>
                    <Tag size={16} color={colors.primary} />
                    <Text style={styles.code}>{item.code}</Text>
                  </View>
                  <View style={[styles.statusBadge, item.active ? styles.statusBadgeActive : styles.statusBadgeInactive]}>
                    <Text style={[styles.statusBadgeText, item.active ? styles.statusTextActive : styles.statusTextInactive]}>
                      {item.active ? 'ACTIF' : 'INACTIF'}
                    </Text>
                  </View>
                </View>

                {item.label ? <Text style={styles.cardLabel}>{item.label}</Text> : null}

                <View style={styles.cardFooter}>
                  <View style={styles.discountPill}>
                    <Text style={styles.discountPillText}>
                      {isPercent ? `-${item.discount_value}%` : `-${Number(item.discount_value).toLocaleString()} XAF`}
                    </Text>
                  </View>
                  <Text style={styles.meta}>
                    {item.used_count || 0} utilisation(s)
                  </Text>
                  <View style={{ flex: 1 }} />
                  <Text style={styles.toggleHint}>
                    {item.active ? 'Désactiver' : 'Activer'}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* MODALE DE CRÉATION PROPRE & PROFESSIONNELLE */}
      <Modal
        visible={show}
        animationType="slide"
        transparent
        onRequestClose={() => setShow(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShow(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={styles.modalBox}
            onPress={(e) => e.stopPropagation?.()}
          >
            {/* Header */}
            <View style={styles.modalHeaderRow}>
              <View style={styles.modalHeaderIconBadge}>
                <Percent size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Nouveau Code Promo</Text>
                <Text style={styles.modalSubtitle}>Offres spéciales, remises & fidélisation clients</Text>
              </View>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShow(false)}>
                <X size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScroll}>
              {/* Presets rapides */}
              <View style={styles.presetSection}>
                <View style={styles.presetHeader}>
                  <Sparkles size={14} color={colors.primary} />
                  <Text style={styles.presetLabel}>Modèles rapides en 1 clic :</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetScroll}>
                  <TouchableOpacity
                    style={styles.presetChip}
                    onPress={() => applyPreset('BIENVENUE10', 'Offre de bienvenue nouveau client', 'percent', '10')}
                  >
                    <Text style={styles.presetChipText}>🎁 BIENVENUE (-10%)</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.presetChip}
                    onPress={() => applyPreset('MARITIME15', 'Réduction fret maritime groupé', 'percent', '15')}
                  >
                    <Text style={styles.presetChipText}>🚢 MARITIME (-15%)</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.presetChip}
                    onPress={() => applyPreset('REMISE5K', 'Remise directe 5 000 XAF', 'fixed', '5000')}
                  >
                    <Text style={styles.presetChipText}>💰 5 000 XAF</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.presetChip}
                    onPress={() => applyPreset('VIPEXPRESS', 'Offre VIP Fret Aérien Express', 'percent', '20')}
                  >
                    <Text style={styles.presetChipText}>✈️ VIP EXPRESS (-20%)</Text>
                  </TouchableOpacity>
                </ScrollView>
              </View>

              {/* Code */}
              <Text style={styles.formSectionLabel}>1. Code promo & libellé</Text>
              <View style={styles.inputWrapper}>
                <Tag size={18} color={colors.primary} style={styles.inputIcon} />
                <TextInput
                  style={styles.fieldInput}
                  placeholder="CODE PROMO (ex: MOG2026)"
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="characters"
                  value={form.code}
                  onChangeText={(v) => setForm({ ...form, code: v.toUpperCase() })}
                />
              </View>

              <View style={[styles.inputWrapper, { marginTop: 8 }]}>
                <FileText size={18} color={colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.fieldInput}
                  placeholder="Libellé descriptif (ex: Réduction d'ouverture)"
                  placeholderTextColor={colors.textSecondary}
                  value={form.label}
                  onChangeText={(v) => setForm({ ...form, label: v })}
                />
              </View>

              {/* Type de réduction */}
              <Text style={styles.formSectionLabel}>2. Type de remise & valeur</Text>
              <View style={styles.typeSelectorRow}>
                <TouchableOpacity
                  style={[styles.typeCard, form.discount_type === 'percent' && styles.typeCardActive]}
                  onPress={() => setForm({ ...form, discount_type: 'percent' })}
                >
                  <Percent size={18} color={form.discount_type === 'percent' ? colors.primary : colors.textSecondary} />
                  <Text style={[styles.typeCardTitle, form.discount_type === 'percent' && styles.typeCardTitleActive]}>
                    Pourcentage (%)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.typeCard, form.discount_type === 'fixed' && styles.typeCardActive]}
                  onPress={() => setForm({ ...form, discount_type: 'fixed' })}
                >
                  <DollarSign size={18} color={form.discount_type === 'fixed' ? colors.primary : colors.textSecondary} />
                  <Text style={[styles.typeCardTitle, form.discount_type === 'fixed' && styles.typeCardTitleActive]}>
                    Montant fixe (XAF)
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Valeur */}
              <View style={styles.inputWrapper}>
                <Text style={{ color: colors.primary, fontWeight: '900', fontSize: 16, marginRight: 8 }}>
                  {form.discount_type === 'percent' ? '%' : 'XAF'}
                </Text>
                <TextInput
                  style={styles.fieldInput}
                  placeholder={form.discount_type === 'percent' ? "Valeur (ex: 15 pour 15%)" : "Montant (ex: 5000)"}
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numeric"
                  value={form.discount_value}
                  onChangeText={(v) => setForm({ ...form, discount_value: v })}
                />
              </View>

              {/* Footer */}
              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.submitBtn}
                  onPress={create}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Check size={18} color="#fff" />
                      <Text style={styles.submitBtnText}>Créer le code promo</Text>
                    </View>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.dismissBtn}
                  onPress={() => setShow(false)}
                >
                  <Text style={styles.dismissBtnText}>Annuler</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg },
  headerBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerAddBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: `${colors.primary}18`, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '800', color: colors.text },

  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 8,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  code: { fontWeight: '900', color: colors.text, fontFamily: fonts.mono, fontSize: 16, letterSpacing: 0.5 },
  cardLabel: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  discountPill: {
    backgroundColor: `${colors.primary}20`,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  discountPillText: { fontSize: 12, fontWeight: '900', color: colors.primary },
  meta: { fontSize: 12, color: colors.textSecondary },
  toggleHint: { fontSize: 11, fontWeight: '700', color: colors.primary },

  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusBadgeActive: { backgroundColor: 'rgba(16,185,129,0.15)' },
  statusBadgeInactive: { backgroundColor: 'rgba(148,163,184,0.15)' },
  statusBadgeText: { fontSize: 10, fontWeight: '800' },
  statusTextActive: { color: '#10B981' },
  statusTextInactive: { color: '#94A3B8' },

  emptyWrap: { alignItems: 'center', justifyContent: 'center', marginTop: 60, gap: 12 },
  empty: { textAlign: 'center', color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 8,
  },
  emptyBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalBox: {
    backgroundColor: '#161B26',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 28,
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  modalHeaderIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: `${colors.primary}20`,
    borderWidth: 1,
    borderColor: `${colors.primary}40`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: { fontSize: 18, fontWeight: '900', color: colors.text, letterSpacing: -0.3 },
  modalSubtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  modalCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScroll: { maxHeight: 460 },

  presetSection: {
    marginBottom: 14,
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  presetHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  presetLabel: { fontSize: 12, fontWeight: '700', color: colors.primary },
  presetScroll: { gap: 8 },
  presetChip: {
    backgroundColor: colors.card,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  presetChipText: { fontSize: 12, fontWeight: '600', color: colors.text },

  formSectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 10,
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
  },
  inputIcon: { marginRight: 10 },
  fieldInput: { flex: 1, paddingVertical: 12, color: colors.text, fontSize: 14, fontWeight: '600' },

  typeSelectorRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  typeCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  typeCardActive: { borderColor: colors.primary, backgroundColor: `${colors.primary}18` },
  typeCardTitle: { fontSize: 13, fontWeight: '800', color: colors.textSecondary },
  typeCardTitleActive: { color: colors.primary },

  modalFooter: { marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', gap: 8 },
  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  dismissBtn: { paddingVertical: 10, alignItems: 'center' },
  dismissBtnText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
});
