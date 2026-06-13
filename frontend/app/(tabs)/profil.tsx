import React, { useState, useEffect } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Switch, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ChevronRight, LogOut, MapPin, Globe, Bell, FileText, HelpCircle, Edit3, User as UserIcon, Box, Truck, CheckCircle, Camera } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Toast from 'react-native-toast-message';
import { LinearGradient } from 'expo-linear-gradient';
import LanguageSelector from '../../src/components/LanguageSelector';
import { useAuthStore } from '../../src/store/authStore';
import { useColisStore } from '../../src/store/colisStore';
import { biometricService } from '../../src/api/biometrics';
import { BASE } from '../../src/api/client';
import { colors, fonts, radii, shadow, spacing } from '../../src/constants/theme';

export default function ProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const lastPassword = useAuthStore((s) => s.lastPassword);
  const logout = useAuthStore((s) => s.logout);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const uploadAvatar = useAuthStore((s) => s.uploadAvatar);
  const kpi = useColisStore((s) => s.kpi);
  const [notif, setNotif] = useState({ received: true, quoted: true, departed: true, delivered: true });

  useEffect(() => {
    const prefs = (user as any)?.notification_preferences;
    if (prefs) {
      setNotif(prefs);
    }
  }, [user]);

  const updateNotif = async (key: string, val: boolean) => {
    const newNotif = { ...notif, [key]: val };
    setNotif(newNotif);
    
    try {
      await updateProfile({ notification_preferences: newNotif } as any);
    } catch (e) {
      setNotif(notif);
      Toast.show({ type: 'error', text1: 'Erreur', text2: 'Impossible de sauvegarder vos préférences' });
    }
  };

  const [biometrics, setBiometrics] = useState(false);
  const [bioAvailable, setBioAvailable] = useState(false);

  useEffect(() => {
    (async () => {
      const avail = await biometricService.isAvailable();
      setBioAvailable(avail);
      const enabled = await biometricService.isEnabled();
      setBiometrics(enabled);
    })();
  }, []);

  const handleAvatarPick = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission requise', 'Nous avons besoin de votre permission pour accéder à vos photos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled && result.assets[0]) {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Toast.show({ type: 'info', text1: 'Upload en cours...' });
        await uploadAvatar(result.assets[0].uri);
        Toast.show({ type: 'success', text1: 'Photo mise à jour !' });
      } catch (error) {
        Toast.show({ type: 'error', text1: 'Erreur', text2: 'Impossible de mettre à jour la photo' });
      }
    }
  };

  const onLogout = () => {
    Alert.alert(t('profile.logout'), t('profile.logout_confirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.confirm'),
        style: 'destructive',
        onPress: async () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const toggleBiometrics = async (val: boolean) => {
    if (val && !bioAvailable) {
      Alert.alert("Indisponible", "Votre appareil ne supporte pas la biométrie ou elle n'est pas configurée.");
      return;
    }

    Haptics.selectionAsync();
    
    try {
      if (val) {
        if (!lastPassword) {
          Alert.alert("Action requise", "Pour des raisons de sécurité, veuillez vous reconnecter manuellement une fois avant d'activer la biométrie.");
          return;
        }
        await biometricService.setEnabled(true, user?.email, lastPassword);
      } else {
        await biometricService.setEnabled(false);
      }
      
      setBiometrics(val);
      Toast.show({
        type: 'success',
        text1: val ? 'Biométrie activée' : 'Biométrie désactivée',
        text2: val ? 'Utilisez FaceID/Empreinte à la prochaine connexion' : undefined
      });
    } catch (e) {
      Alert.alert("Erreur", "Impossible de configurer la biométrie.");
    }
  };

  if (!user) return null;

  return (
    <View style={styles.container} testID="profile-screen">
      <ScrollView contentContainerStyle={styles.scroll} bounces={false}>
        {/* HEADER GRAPHIQUE */}
        <LinearGradient
          colors={[colors.primaryDark, colors.primary]}
          style={styles.headerGradient}
        >
          <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
            <View style={styles.headerContent}>
              <TouchableOpacity style={styles.avatarContainer} onPress={handleAvatarPick} activeOpacity={0.8}>
                <Image 
                  source={{ uri: user.avatar_url ? `${BASE}${user.avatar_url}` : (user.gender === 'male' ? 'https://cdn-icons-png.flaticon.com/512/6997/6997674.png' : 'https://cdn-icons-png.flaticon.com/512/6997/6997662.png') }} 
                  style={styles.avatarImage}
                />
                <View style={styles.editAvatarBadge}>
                  <Camera size={14} color="#FFF" />
                </View>
              </TouchableOpacity>
              <Text style={styles.name}>{user.full_name}</Text>
              <Text style={styles.email}>{user.email}</Text>
              <View style={styles.codeChip}>
                <Text style={styles.codeLabel}>{t('profile.client_code')}</Text>
                <Text style={styles.codeValue}>{user.client_code}</Text>
              </View>
            </View>
          </SafeAreaView>
        </LinearGradient>

        {/* BARRE DE STATISTIQUES (KPIs) */}
        <View style={styles.kpiContainer}>
          <View style={styles.kpiCard}>
            <KpiItem icon={<Box size={20} color={colors.secondary} />} label="Entrepôt" value={kpi.warehouse} />
            <View style={styles.kpiDivider} />
            <KpiItem icon={<Truck size={20} color={colors.warning} />} label="En transit" value={kpi.transit} />
            <View style={styles.kpiDivider} />
            <KpiItem icon={<CheckCircle size={20} color={colors.success} />} label="Livrés" value={kpi.delivered} />
          </View>
        </View>

        <View style={styles.content}>
          {/* PRÉFÉRENCES */}
          <Section title="Préférences">
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <Globe size={20} color={colors.primary} />
                <Text style={styles.rowText}>{t('profile.language')}</Text>
              </View>
              <LanguageSelector />
            </View>
            <View style={styles.divider} />
            <ItemRow
              testID="profile-address"
              icon={<MapPin size={20} color={colors.textSecondary} />}
              label={t('profile.default_address')}
              value={user.default_delivery_address || '—'}
              onPress={() => { Haptics.selectionAsync(); router.push('/profile/edit'); }}
            />
          </Section>

          {/* SÉCURITÉ */}
          <Section title="Sécurité & Accès">
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <UserIcon size={20} color={colors.textSecondary} />
                <Text style={styles.rowText}>Identification Biométrique</Text>
              </View>
              <Switch
                value={biometrics}
                onValueChange={toggleBiometrics}
                trackColor={{ true: colors.primary, false: '#D1D5DB' }}
                thumbColor="#fff"
              />
            </View>
          </Section>

          {/* NOTIFICATIONS */}
          <Section title={t('profile.notifications_prefs')}>
            {(['received', 'quoted', 'departed', 'delivered'] as const).map((k, index, arr) => (
              <React.Fragment key={k}>
                <View style={styles.row} testID={`notif-${k}`}>
                  <View style={styles.rowLeft}>
                    <Bell size={20} color={colors.textSecondary} />
                    <Text style={styles.rowText}>{t(`status.${k}`)}</Text>
                  </View>
                  <Switch
                    value={notif[k as keyof typeof notif]}
                    onValueChange={(v) => updateNotif(k, v)}
                    trackColor={{ true: colors.primary, false: '#D1D5DB' }}
                    thumbColor="#fff"
                  />
                </View>
                {index < arr.length - 1 && <View style={styles.divider} />}
              </React.Fragment>
            ))}
          </Section>

          {/* MON COMPTE & SUPPORT */}
          <Section title="Gestion du compte">
            <ItemRow
              testID="profile-edit"
              icon={<Edit3 size={20} color={colors.textSecondary} />}
              label={t('profile.edit')}
              onPress={() => { Haptics.selectionAsync(); router.push('/profile/edit'); }}
            />
            <View style={styles.divider} />
            <ItemRow
              testID="profile-docs"
              icon={<FileText size={20} color={colors.textSecondary} />}
              label={t('profile.my_documents')}
              onPress={() => { Haptics.selectionAsync(); router.push('/profile/documents'); }}
            />
            <View style={styles.divider} />
            <ItemRow
              testID="profile-faq"
              icon={<HelpCircle size={20} color={colors.textSecondary} />}
              label={t('profile.support')}
              onPress={() => { Haptics.selectionAsync(); router.push('/profile/faq'); }}
            />
          </Section>

          <TouchableOpacity style={styles.logout} onPress={onLogout} testID="profile-logout" activeOpacity={0.7}>
            <LogOut size={20} color={colors.danger} />
            <Text style={styles.logoutText}>{t('profile.logout')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function ItemRow({ icon, label, value, onPress }: { icon: React.ReactNode; label: string; value?: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.6}>
      <View style={styles.rowLeft}>
        {icon}
        <Text style={styles.rowText}>{label}</Text>
      </View>
      <View style={styles.rowRight}>
        {value && <Text style={styles.rowValue} numberOfLines={1}>{value}</Text>}
        <ChevronRight size={20} color={colors.textSecondary} />
      </View>
    </TouchableOpacity>
  );
}

function KpiItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <View style={styles.kpiItem}>
      {icon}
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingBottom: 40 },
  headerGradient: {
    paddingBottom: 40,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerSafeArea: {
    paddingHorizontal: spacing.lg,
  },
  headerContent: {
    alignItems: 'center',
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  avatarContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#fff',
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    ...shadow.floating,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 40,
  },
  editAvatarBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: colors.primary,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  name: { fontSize: 22, fontWeight: '800', color: '#fff', fontFamily: fonts.heading },
  email: { color: 'rgba(255,255,255,0.8)', fontSize: 14, marginTop: 4 },
  codeChip: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,215,0,0.15)',
    borderColor: 'rgba(255,215,0,0.5)',
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    marginTop: spacing.md,
    gap: 8,
    alignItems: 'center',
  },
  codeLabel: { color: '#FFE066', fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  codeValue: { color: '#FFF', fontSize: 14, fontWeight: '900', fontFamily: fonts.mono, letterSpacing: 1 },
  kpiContainer: {
    paddingHorizontal: spacing.lg,
    marginTop: -30,
    marginBottom: spacing.xl,
  },
  kpiCard: {
    backgroundColor: '#fff',
    borderRadius: radii.card,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    ...shadow.card,
  },
  kpiItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    fontFamily: fonts.heading,
  },
  kpiLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  kpiDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.borderLight,
  },
  content: {
    paddingHorizontal: spacing.lg,
  },
  section: { marginBottom: spacing.xl },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 0.5, marginLeft: 4 },
  card: { backgroundColor: '#fff', borderRadius: radii.card, ...shadow.card, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowText: { color: colors.text, fontSize: 15, fontWeight: '500', flex: 1 },
  rowValue: { color: colors.textSecondary, fontSize: 14, maxWidth: 120 },
  divider: { height: 1, backgroundColor: colors.borderLight, marginLeft: 50 },
  logout: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, padding: spacing.lg, backgroundColor: '#fff', borderRadius: radii.card, marginTop: spacing.sm, ...shadow.card },
  logoutText: { color: colors.danger, fontWeight: '700', fontSize: 16 },
});
