import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Modal,
  ActivityIndicator, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ChevronLeft, Plus, Pencil, Users, Shield, UserCog, Building2,
  Mail, Phone, Lock, User, Check, X, Sparkles,
} from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { adminApi, type AdminUser } from '../../src/api/admin';
import { entrepotsApi, type Entrepot } from '../../src/api/entrepots';
import { formatErr } from '../../src/api/client';
import { useAuthStore } from '../../src/store/authStore';
import { darkColors as colors, radii, spacing, fonts, shadow } from '../../src/constants/theme';

const blank = {
  email: '', full_name: '', phone: '', password: '', role: 'operator', assigned_entrepot_id: '',
};

export default function TeamAdminScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [items, setItems] = useState<AdminUser[]>([]);
  const [entrepots, setEntrepots] = useState<Entrepot[]>([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...blank });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (user?.role !== 'admin') return;
    try {
      const [team, wh] = await Promise.all([adminApi.team(), entrepotsApi.list()]);
      setItems(Array.isArray(team) ? team : []);
      setEntrepots(Array.isArray(wh) ? wh : []);
    } catch (e: any) {
      Toast.show({ type: 'error', text1: formatErr(e, 'Chargement équipe') });
    } finally {
      setLoading(false);
    }
  }, [user?.role]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditId(null);
    setForm({ ...blank });
    setShow(true);
  };

  const openEdit = (m: AdminUser) => {
    setEditId(m.id);
    setForm({
      email: m.email,
      full_name: m.full_name || '',
      phone: m.phone || '',
      password: '',
      role: m.role || 'operator',
      assigned_entrepot_id: m.assigned_entrepot_id || '',
    });
    setShow(true);
  };

  const save = async () => {
    if (!editId && (!form.email.trim() || !form.password || form.password.length < 6)) {
      Toast.show({ type: 'error', text1: 'Email et mot de passe (6 caractères min.) requis' });
      return;
    }
    setSaving(true);
    try {
      if (editId) {
        const payload: Record<string, any> = {
          full_name: form.full_name.trim(),
          phone: form.phone.trim(),
          role: form.role,
          assigned_entrepot_id: form.assigned_entrepot_id || null,
        };
        if (form.password) payload.password = form.password;
        await adminApi.updateUser(editId, payload);
      } else {
        await adminApi.createUser({
          email: form.email.trim().toLowerCase(),
          full_name: form.full_name.trim(),
          phone: form.phone.trim(),
          password: form.password,
          role: form.role,
          assigned_entrepot_id: form.assigned_entrepot_id || undefined,
        });
      }
      setShow(false);
      setLoading(true);
      load();
      Toast.show({ type: 'success', text1: editId ? 'Membre mis à jour' : 'Membre de l’équipe créé avec succès' });
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

  const whName = (id?: string) => entrepots.find((e) => (e.id || e._id) === id)?.name || 'Tous / Flottant';

  const getInitials = (name?: string, email?: string) => {
    if (name?.trim()) {
      const parts = name.trim().split(' ');
      if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      return name.slice(0, 2).toUpperCase();
    }
    if (email) return email.slice(0, 2).toUpperCase();
    return 'OP';
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Équipes & Opérateurs</Text>
        <TouchableOpacity onPress={openCreate} style={styles.headerAddBtn}>
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
              <Users size={40} color={colors.textSecondary} />
              <Text style={styles.empty}>Aucun membre dans l’équipe</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={openCreate}>
                <Plus size={16} color="#fff" />
                <Text style={styles.emptyBtnText}>Ajouter un opérateur</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item }) => {
            const isAdmin = item.role === 'admin';
            const assignedWh = whName(item.assigned_entrepot_id);
            const initials = getInitials(item.full_name, item.email);

            return (
              <View style={styles.card}>
                <View style={[styles.avatar, isAdmin ? styles.avatarAdmin : styles.avatarOperator]}>
                  <Text style={styles.avatarText}>{initials}</Text>
                </View>

                <View style={{ flex: 1 }}>
                  <View style={styles.cardNameRow}>
                    <Text style={styles.cardTitle}>{item.full_name || item.email}</Text>
                    <View style={[styles.roleBadge, isAdmin ? styles.roleBadgeAdmin : styles.roleBadgeOperator]}>
                      {isAdmin ? <Shield size={10} color="#F59E0B" /> : <UserCog size={10} color="#38BDF8" />}
                      <Text style={[styles.roleBadgeText, isAdmin ? styles.roleTextAdmin : styles.roleTextOperator]}>
                        {isAdmin ? 'ADMIN' : 'OPÉRATEUR'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.metaRow}>
                    <Mail size={12} color={colors.textSecondary} />
                    <Text style={styles.meta}>{item.email}</Text>
                  </View>

                  {item.phone ? (
                    <View style={styles.metaRow}>
                      <Phone size={12} color={colors.textSecondary} />
                      <Text style={styles.meta}>{item.phone}</Text>
                    </View>
                  ) : null}

                  <View style={styles.whMetaPill}>
                    <Building2 size={12} color={colors.primary} />
                    <Text style={styles.whMetaText}>Entrepôt : {assignedWh}</Text>
                  </View>
                </View>

                <TouchableOpacity onPress={() => openEdit(item)} style={styles.editBtn}>
                  <Pencil size={16} color={colors.primary} />
                </TouchableOpacity>
              </View>
            );
          }}
        />
      )}

      {/* MODALE CRÉATION & ÉDITION D'OPÉRATEUR */}
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
                <UserCog size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>{editId ? "Modifier l'opérateur" : "Nouveau membre"}</Text>
                <Text style={styles.modalSubtitle}>Permissions d’accès et assignation d'entrepôt</Text>
              </View>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShow(false)}>
                <X size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScroll}>
              {/* Identité */}
              <Text style={styles.formSectionLabel}>1. Informations personnelles</Text>
              <View style={styles.inputWrapper}>
                <User size={18} color={colors.primary} style={styles.inputIcon} />
                <TextInput
                  style={styles.fieldInput}
                  placeholder="Nom complet *"
                  placeholderTextColor={colors.textSecondary}
                  value={form.full_name}
                  onChangeText={(v) => setForm({ ...form, full_name: v })}
                />
              </View>

              <View style={[styles.inputWrapper, { marginTop: 8 }]}>
                <Mail size={18} color={colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={[styles.fieldInput, editId ? { opacity: 0.6 } : {}]}
                  placeholder="Email de connexion *"
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  editable={!editId}
                  value={form.email}
                  onChangeText={(v) => setForm({ ...form, email: v })}
                />
              </View>

              <View style={[styles.inputWrapper, { marginTop: 8 }]}>
                <Phone size={18} color={colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.fieldInput}
                  placeholder="Téléphone *"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="phone-pad"
                  value={form.phone}
                  onChangeText={(v) => setForm({ ...form, phone: v })}
                />
              </View>

              <View style={[styles.inputWrapper, { marginTop: 8 }]}>
                <Lock size={18} color={colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.fieldInput}
                  placeholder={editId ? 'Nouveau mot de passe (optionnel)' : 'Mot de passe (6+ caractères) *'}
                  placeholderTextColor={colors.textSecondary}
                  secureTextEntry
                  value={form.password}
                  onChangeText={(v) => setForm({ ...form, password: v })}
                />
              </View>

              {/* Rôle */}
              <Text style={styles.formSectionLabel}>2. Rôle & permissions</Text>
              <View style={styles.roleSelectorRow}>
                <TouchableOpacity
                  style={[styles.roleCard, form.role === 'operator' && styles.roleCardActive]}
                  onPress={() => setForm({ ...form, role: 'operator' })}
                >
                  <UserCog size={18} color={form.role === 'operator' ? '#38BDF8' : colors.textSecondary} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.roleCardTitle, form.role === 'operator' && { color: '#38BDF8' }]}>
                      👷 Opérateur
                    </Text>
                    <Text style={styles.roleCardDesc}>Réceptions, scans, stocks & colis</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.roleCard, form.role === 'admin' && styles.roleCardAdminActive]}
                  onPress={() => setForm({ ...form, role: 'admin' })}
                >
                  <Shield size={18} color={form.role === 'admin' ? '#F59E0B' : colors.textSecondary} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.roleCardTitle, form.role === 'admin' && { color: '#F59E0B' }]}>
                      👑 Administrateur
                    </Text>
                    <Text style={styles.roleCardDesc}>Accès complet, tarifs, équipes & finances</Text>
                  </View>
                </TouchableOpacity>
              </View>

              {/* Entrepôt assigné */}
              <Text style={styles.formSectionLabel}>3. Entrepôt assigné</Text>
              <View style={styles.whChipsWrap}>
                <TouchableOpacity
                  style={[styles.whChip, !form.assigned_entrepot_id && styles.whChipActive]}
                  onPress={() => setForm({ ...form, assigned_entrepot_id: '' })}
                >
                  <Text style={[styles.whChipText, !form.assigned_entrepot_id && { color: '#fff' }]}>
                    🌐 Aucun (Flottant / Tous)
                  </Text>
                </TouchableOpacity>

                {entrepots.map((e) => {
                  const id = e.id || e._id || '';
                  const isSelected = form.assigned_entrepot_id === id;
                  const flag = e.country?.toLowerCase().includes('chin') ? '🇨🇳' : e.country?.toLowerCase().includes('cam') ? '🇨🇲' : '🌍';
                  return (
                    <TouchableOpacity
                      key={id}
                      style={[styles.whChip, isSelected && styles.whChipActive]}
                      onPress={() => setForm({ ...form, assigned_entrepot_id: id })}
                    >
                      <Text style={styles.whFlag}>{flag}</Text>
                      <Text style={[styles.whChipText, isSelected && { color: '#fff' }]}>
                        {e.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Footer */}
              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.submitBtn}
                  onPress={save}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Check size={18} color="#fff" />
                      <Text style={styles.submitBtnText}>Enregistrer le membre</Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarOperator: { backgroundColor: 'rgba(56,189,248,0.15)', borderWidth: 1, borderColor: '#38BDF8' },
  avatarAdmin: { backgroundColor: 'rgba(245,158,11,0.15)', borderWidth: 1, borderColor: '#F59E0B' },
  avatarText: { fontWeight: '900', fontSize: 16, color: colors.text },

  cardNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  cardTitle: { fontWeight: '800', color: colors.text, fontSize: 15 },
  roleBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  roleBadgeOperator: { backgroundColor: 'rgba(56,189,248,0.15)' },
  roleBadgeAdmin: { backgroundColor: 'rgba(245,158,11,0.15)' },
  roleBadgeText: { fontSize: 9, fontWeight: '900' },
  roleTextOperator: { color: '#38BDF8' },
  roleTextAdmin: { color: '#F59E0B' },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  meta: { fontSize: 12, color: colors.textSecondary },

  whMetaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.03)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  whMetaText: { fontSize: 11, fontWeight: '700', color: colors.textSecondary },

  editBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${colors.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
  },

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

  formSectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 12,
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

  roleSelectorRow: { gap: 8, marginBottom: 8 },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  roleCardActive: { borderColor: '#38BDF8', backgroundColor: 'rgba(56,189,248,0.12)' },
  roleCardAdminActive: { borderColor: '#F59E0B', backgroundColor: 'rgba(245,158,11,0.12)' },
  roleCardTitle: { fontSize: 14, fontWeight: '800', color: colors.text },
  roleCardDesc: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },

  whChipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  whChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  whChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  whFlag: { fontSize: 14 },
  whChipText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },

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
