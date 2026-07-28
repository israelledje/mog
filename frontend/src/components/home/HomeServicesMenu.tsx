import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  Headphones, Plane, GraduationCap, Hotel, Languages, Car, ChevronRight, Grid3X3,
} from 'lucide-react-native';
import { colors, radii, spacing, shadow } from '../../constants/theme';

type ServiceItem = {
  key: string;
  label: string;
  href: string;
  Icon: any;
  color: string;
};

const ASSIST_SERVICES: ServiceItem[] = [
  { key: 'assist', label: 'Assistance client pendant le séjour', href: '/services/assistance', Icon: Headphones, color: '#2563EB' },
  { key: 'airport', label: "Accueil à l'aéroport", href: '/services/airport', Icon: Plane, color: '#0EA5E9' },
  { key: 'student', label: 'Inscription étudiant', href: '/services/student', Icon: GraduationCap, color: '#7C3AED' },
  { key: 'hotel', label: "Réservation d'hôtel", href: '/services/hotel', Icon: Hotel, color: '#D97706' },
  { key: 'translator', label: 'Service de traducteur', href: '/services/translator', Icon: Languages, color: '#059669' },
];

export default function HomeServicesMenu() {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{t('services.assistants_title', { defaultValue: 'Assistants & Services' })}</Text>
        <TouchableOpacity onPress={() => router.push('/services')} style={styles.seeAll}>
          <Grid3X3 size={16} color={colors.primary} />
          <Text style={styles.seeAllText}>{t('services.all', { defaultValue: 'Tous' })}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.grid}>
        {ASSIST_SERVICES.map((s) => (
          <TouchableOpacity
            key={s.key}
            style={styles.card}
            activeOpacity={0.85}
            onPress={() => router.push(s.href as any)}
          >
            <View style={[styles.iconWrap, { backgroundColor: `${s.color}15` }]}>
              <s.Icon size={20} color={s.color} strokeWidth={2.2} />
            </View>
            <Text style={styles.cardLabel} numberOfLines={2}>{s.label}</Text>
            <ChevronRight size={14} color={colors.textSecondary} />
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.vehicleBanner} onPress={() => router.push('/services/vehicles')} activeOpacity={0.9}>
        <View style={[styles.iconWrap, { backgroundColor: '#FEF2F2' }]}>
          <Car size={22} color={colors.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.vehicleTitle}>{t('services.vehicles_title', { defaultValue: 'Achat & expédition de véhicules' })}</Text>
          <Text style={styles.vehicleSub}>{t('services.vehicles_sub', { defaultValue: 'Vers Afrique centrale & Côte d\'Ivoire' })}</Text>
        </View>
        <ChevronRight size={18} color={colors.accent} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  title: { fontSize: 18, fontWeight: '800', color: colors.text },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  seeAllText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  grid: { gap: 10 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 12,
    ...shadow.sm,
  },
  iconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.text, lineHeight: 18 },
  vehicleBanner: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
    ...shadow.sm,
  },
  vehicleTitle: { fontSize: 14, fontWeight: '800', color: colors.text },
  vehicleSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
});
