import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, Send, MessageCircle, CheckCircle2 } from 'lucide-react-native';
import { getServiceBySlug } from '../../src/constants/services';
import {
  ServiceRequestForm, validateServiceForm, humanizePayload,
} from '../../src/components/services/ServiceRequestForm';
import { servicesApi } from '../../src/api/services';
import { useAuthStore } from '../../src/store/authStore';
import { useSettingsStore } from '../../src/store/settingsStore';
import { buildWhatsAppUrl, getSupportPhoneDigits } from '../../src/utils/support';
import { colors, radii, spacing, shadow } from '../../src/constants/theme';

export default function VehiclesServiceScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const settings = useSettingsStore((s) => s.settings);
  const service = getServiceBySlug('vehicles')!;

  const initial = useMemo(() => {
    const base: Record<string, string> = {};
    for (const f of service.fields) base[f.key] = '';
    if (user?.full_name) base.full_name = user.full_name;
    if (user?.phone) base.phone = user.phone;
    return base;
  }, [service, user]);

  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const onChange = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: '' }));
  };

  const onSubmit = async () => {
    const errs = validateServiceForm(service.fields, values);
    setErrors(errs);
    if (Object.keys(errs).length) {
      Alert.alert('Formulaire incomplet', 'Merci de remplir les champs obligatoires.');
      return;
    }
    setSubmitting(true);
    try {
      await servicesApi.createRequest({
        service_slug: service.slug,
        service_title: service.title,
        form_data: values,
        summary: humanizePayload(service.fields, values),
      });
      setDone(true);
    } catch (e: any) {
      Alert.alert('Erreur', e?.response?.data?.detail || e?.message || 'Échec de l\'envoi');
    } finally {
      setSubmitting(false);
    }
  };

  const onWhatsApp = () => {
    const phone = getSupportPhoneDigits(settings);
    Linking.openURL(buildWhatsAppUrl(phone, `Bonjour M.O.G, ${service.title}\n\n${humanizePayload(service.fields, values)}`));
  };

  if (done) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.successWrap}>
          <CheckCircle2 size={40} color={service.color} />
          <Text style={styles.successTitle}>Demande véhicules envoyée</Text>
          <Text style={styles.successSub}>Un opérateur vous rappellera avec les options disponibles pour votre destination.</Text>
          <TouchableOpacity style={[styles.cta, { backgroundColor: service.color }]} onPress={() => router.back()}>
            <Text style={styles.ctaText}>Retour</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Véhicules</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <View style={[styles.heroIcon, { backgroundColor: `${service.color}18` }]}>
            <service.Icon size={26} color={service.color} />
          </View>
          <Text style={styles.heroTitle}>{service.title}</Text>
          {service.intro.map((p, i) => (
            <Text key={i} style={styles.heroPara}>{p}</Text>
          ))}
        </View>

        <Text style={styles.formTitle}>Demande de devis véhicule</Text>
        <ServiceRequestForm fields={service.fields} values={values} onChange={onChange} errors={errors} />

        <TouchableOpacity
          style={[styles.cta, { backgroundColor: service.color }, submitting && { opacity: 0.7 }]}
          onPress={onSubmit}
          disabled={submitting}
        >
          {submitting ? <ActivityIndicator color="#fff" /> : (
            <>
              <Send size={18} color="#fff" />
              <Text style={styles.ctaText}>Envoyer la demande</Text>
            </>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryCta} onPress={onWhatsApp}>
          <MessageCircle size={16} color="#25D366" />
          <Text style={styles.secondaryCtaText}>Ou via WhatsApp</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '800', color: colors.text },
  scroll: { padding: spacing.lg, paddingBottom: 40 },
  hero: { backgroundColor: '#fff', borderRadius: 16, padding: spacing.lg, marginBottom: spacing.lg, ...shadow.sm },
  heroIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  heroTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 8 },
  heroPara: { fontSize: 14, lineHeight: 21, color: colors.textSecondary, marginBottom: 6 },
  formTitle: { fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: spacing.md },
  cta: { marginTop: spacing.xl, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: radii.button },
  ctaText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  secondaryCta: { marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: radii.button, backgroundColor: '#fff', borderWidth: 1, borderColor: '#D1FAE5' },
  secondaryCtaText: { color: '#059669', fontWeight: '700', fontSize: 14 },
  successWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: 12 },
  successTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
  successSub: { textAlign: 'center', color: colors.textSecondary, lineHeight: 22, marginBottom: 12 },
});
