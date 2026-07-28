import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, MessageCircle } from 'lucide-react-native';
import { useSettingsStore } from '../../src/store/settingsStore';
import { buildWhatsAppUrl, getSupportPhoneDigits } from '../../src/utils/support';
import { colors, radii, spacing } from '../../src/constants/theme';

const CONTENT: Record<string, { title: string; body: string[]; cta?: string }> = {
  assistance: {
    title: 'Assistance client pendant le séjour',
    body: [
      'Un conseiller M.O.G vous accompagne tout au long de votre séjour en Chine.',
      'Aide aux démarches locales, urgences, orientation et suivi de vos commandes.',
      'Disponible 7j/7 via WhatsApp et téléphone.',
    ],
  },
  airport: {
    title: "Service d'accueil à l'aéroport",
    body: [
      "Prise en charge à l'aéroport (Guangzhou / Shenzhen / autres sur demande).",
      'Transfert vers votre hôtel ou entrepôt, assistance bagages et orientation.',
      "Réservez au moins 48h avant votre arrivée.",
    ],
  },
  student: {
    title: "Service d'inscription étudiant",
    body: [
      'Accompagnement pour inscriptions universitaires et écoles en Chine.',
      'Aide au dossier, traduction de documents et suivi administratif.',
      'Contactez-nous pour un devis personnalisé.',
    ],
  },
  hotel: {
    title: "Réservation d'hôtel",
    body: [
      "Réservation d'hôtels partenaires près des zones commerciales et entrepôts.",
      'Tarifs négociés M.O.G, confirmation rapide.',
      'Indiquez vos dates, ville et budget via WhatsApp.',
    ],
  },
  translator: {
    title: 'Service de traducteur',
    body: [
      'Traducteur français / anglais / chinois pour vos rendez-vous fournisseurs.',
      'Accompagnement en usine, négociation et contrôle qualité.',
      'Forfait demi-journée ou journée complète.',
    ],
  },
};

export default function ServiceDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const settings = useSettingsStore((s) => s.settings);
  const phone = getSupportPhoneDigits(settings);
  const content = CONTENT[slug || ''] || {
    title: t('services.unknown', { defaultValue: 'Service' }),
    body: [t('services.contact_us', { defaultValue: 'Contactez-nous pour plus d\'informations.' })],
  };

  const onContact = () => {
    const msg = `Bonjour M.O.G, je souhaite le service : ${content.title}`;
    Linking.openURL(buildWhatsAppUrl(phone, msg));
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{content.title}</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        {content.body.map((p, i) => (
          <Text key={i} style={styles.para}>{p}</Text>
        ))}
        <TouchableOpacity style={styles.cta} onPress={onContact}>
          <MessageCircle size={18} color="#fff" />
          <Text style={styles.ctaText}>{t('services.contact_whatsapp', { defaultValue: 'Demander via WhatsApp' })}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FB' },
  header: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, backgroundColor: '#fff' },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '800', color: colors.text },
  scroll: { padding: spacing.lg },
  para: { fontSize: 15, lineHeight: 24, color: colors.text, marginBottom: spacing.md, backgroundColor: '#fff', padding: spacing.lg, borderRadius: radii.card },
  cta: { marginTop: spacing.md, backgroundColor: '#25D366', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: radii.button },
  ctaText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
