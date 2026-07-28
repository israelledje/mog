import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Car, MessageCircle, MapPin } from 'lucide-react-native';
import { useSettingsStore } from '../../src/store/settingsStore';
import { buildWhatsAppUrl, getSupportPhoneDigits } from '../../src/utils/support';
import { colors, radii, spacing, shadow } from '../../src/constants/theme';

const DESTINATIONS = [
  'Cameroun',
  'Gabon',
  'Guinée équatoriale',
  'Congo',
  'RD Congo',
  'Tchad',
  "Côte d'Ivoire",
];

export default function VehiclesServiceScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const settings = useSettingsStore((s) => s.settings);
  const phone = getSupportPhoneDigits(settings);

  const onContact = (dest?: string) => {
    const msg = dest
      ? `Bonjour M.O.G, je souhaite acheter/expédier un véhicule vers ${dest}.`
      : 'Bonjour M.O.G, je souhaite des infos sur l\'achat et l\'expédition de véhicules.';
    Linking.openURL(buildWhatsAppUrl(phone, msg));
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('services.vehicles_title', { defaultValue: 'Véhicules' })}</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          <Car size={36} color={colors.accent} />
          <Text style={styles.heroTitle}>Achat & expédition de véhicules</Text>
          <Text style={styles.heroSub}>
            Achat en Chine et acheminement en conteneur vers plusieurs destinations d'Afrique centrale et d'Afrique de l'Ouest.
          </Text>
        </View>

        <Text style={styles.section}>Destinations disponibles</Text>
        {DESTINATIONS.map((d) => (
          <TouchableOpacity key={d} style={styles.dest} onPress={() => onContact(d)}>
            <MapPin size={18} color={colors.primary} />
            <Text style={styles.destText}>{d}</Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity style={styles.cta} onPress={() => onContact()}>
          <MessageCircle size={18} color="#fff" />
          <Text style={styles.ctaText}>Demander un devis WhatsApp</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FB' },
  header: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, backgroundColor: '#fff' },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '800', color: colors.text },
  scroll: { padding: spacing.lg, paddingBottom: 40 },
  hero: { backgroundColor: '#fff', borderRadius: radii.card, padding: spacing.lg, alignItems: 'center', marginBottom: spacing.lg, ...shadow.sm },
  heroTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginTop: spacing.md, textAlign: 'center' },
  heroSub: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  section: { fontSize: 13, fontWeight: '800', color: colors.textSecondary, textTransform: 'uppercase', marginBottom: spacing.sm },
  dest: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', padding: 14, borderRadius: 12, marginBottom: 8 },
  destText: { fontSize: 15, fontWeight: '600', color: colors.text },
  cta: { marginTop: spacing.lg, backgroundColor: '#25D366', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: radii.button },
  ctaText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
