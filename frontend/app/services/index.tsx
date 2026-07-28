import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  ChevronLeft, Headphones, Plane, GraduationCap, Hotel, Languages, Car, ChevronRight,
} from 'lucide-react-native';
import { colors, radii, spacing, shadow } from '../../src/constants/theme';

const SERVICES = [
  { href: '/services/assistance', title: 'Assistance client pendant le séjour', Icon: Headphones, color: '#2563EB' },
  { href: '/services/airport', title: "Accueil à l'aéroport", Icon: Plane, color: '#0EA5E9' },
  { href: '/services/student', title: 'Inscription étudiant', Icon: GraduationCap, color: '#7C3AED' },
  { href: '/services/hotel', title: "Réservation d'hôtel", Icon: Hotel, color: '#D97706' },
  { href: '/services/translator', title: 'Traducteur', Icon: Languages, color: '#059669' },
  { href: '/services/vehicles', title: 'Achat & expédition de véhicules', Icon: Car, color: '#DC2626' },
];

export default function ServicesHubScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('services.menu', { defaultValue: 'Services' })}</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.intro}>
          {t('services.intro', {
            defaultValue: 'M.O.G Group Multiservice — accompagnement logistique et services sur mesure Chine ↔ Afrique.',
          })}
        </Text>
        {SERVICES.map((s) => (
          <TouchableOpacity key={s.href} style={styles.row} onPress={() => router.push(s.href as any)}>
            <View style={[styles.icon, { backgroundColor: `${s.color}18` }]}>
              <s.Icon size={22} color={s.color} />
            </View>
            <Text style={styles.rowTitle}>{s.title}</Text>
            <ChevronRight size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FB' },
  header: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, backgroundColor: '#fff' },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '800', color: colors.text },
  scroll: { padding: spacing.lg },
  intro: { color: colors.textSecondary, fontSize: 14, lineHeight: 20, marginBottom: spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    gap: 12,
    ...shadow.sm,
  },
  icon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.text },
});
