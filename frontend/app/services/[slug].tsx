import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
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

export default function ServiceDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const settings = useSettingsStore((s) => s.settings);
  const service = getServiceBySlug(slug);

  const initial = useMemo(() => {
    const base: Record<string, string> = {};
    if (!service) return base;
    for (const f of service.fields) base[f.key] = '';
    if (user?.full_name) base.full_name = user.full_name;
    if (user?.phone) base.phone = user.phone;
    if (user?.email && 'email' in base) base.email = user.email;
    return base;
  }, [service, user]);

  const [values, setValues] = useState<Record<string, string>>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [doneId, setDoneId] = useState<string | null>(null);

  useEffect(() => {
    setValues(initial);
  }, [initial]);

  if (!service) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.back}>
            <ChevronLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Service</Text>
          <View style={{ width: 40 }} />
        </View>
        <Text style={styles.missing}>{t('services.unknown', { defaultValue: 'Service introuvable' })}</Text>
      </SafeAreaView>
    );
  }

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
      const summary = humanizePayload(service.fields, values);
      const res = await servicesApi.createRequest({
        service_slug: service.slug,
        service_title: service.title,
        form_data: values,
        summary,
      });
      setDoneId(res.id);
    } catch (e: any) {
      Alert.alert(
        'Erreur',
        e?.response?.data?.detail || e?.message || 'Impossible d\'envoyer la demande. Réessayez.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const onWhatsAppBackup = () => {
    const phone = getSupportPhoneDigits(settings);
    const summary = humanizePayload(service.fields, values);
    const msg = `Bonjour M.O.G, demande de service : ${service.title}\n\n${summary || '(formulaire non rempli)'}`;
    Linking.openURL(buildWhatsAppUrl(phone, msg));
  };

  if (doneId) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.successWrap}>
          <View style={[styles.successIcon, { backgroundColor: `${service.color}18` }]}>
            <CheckCircle2 size={40} color={service.color} />
          </View>
          <Text style={styles.successTitle}>Demande envoyée</Text>
          <Text style={styles.successSub}>
            Un opérateur M.O.G a reçu vos informations et vous contactera rapidement sur le numéro indiqué.
          </Text>
          <TouchableOpacity style={[styles.cta, { backgroundColor: service.color }]} onPress={() => router.back()}>
            <Text style={styles.ctaText}>Retour</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryCta} onPress={onWhatsAppBackup}>
            <MessageCircle size={16} color="#25D366" />
            <Text style={styles.secondaryCtaText}>Aussi via WhatsApp</Text>
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
        <Text style={styles.headerTitle} numberOfLines={1}>{service.shortTitle}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={[styles.hero, { borderColor: `${service.color}33` }]}>
          <View style={[styles.heroIcon, { backgroundColor: `${service.color}18` }]}>
            <service.Icon size={26} color={service.color} />
          </View>
          <Text style={styles.heroTitle}>{service.title}</Text>
          {service.intro.map((p, i) => (
            <Text key={i} style={styles.heroPara}>{p}</Text>
          ))}
        </View>

        <Text style={styles.formTitle}>Votre demande</Text>
        <Text style={styles.formHint}>
          Ces informations permettent à l’opérateur de vous rappeler avec un devis / confirmation précis.
        </Text>

        <ServiceRequestForm
          fields={service.fields}
          values={values}
          onChange={onChange}
          errors={errors}
        />

        <TouchableOpacity
          style={[styles.cta, { backgroundColor: service.color }, submitting && { opacity: 0.7 }]}
          onPress={onSubmit}
          disabled={submitting}
          activeOpacity={0.9}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Send size={18} color="#fff" />
              <Text style={styles.ctaText}>Envoyer la demande</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryCta} onPress={onWhatsAppBackup}>
          <MessageCircle size={16} color="#25D366" />
          <Text style={styles.secondaryCtaText}>Ou contacter via WhatsApp</Text>
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
  hero: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    ...shadow.sm,
  },
  heroIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  heroTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 8 },
  heroPara: { fontSize: 14, lineHeight: 21, color: colors.textSecondary, marginBottom: 6 },
  formTitle: { fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 4 },
  formHint: { fontSize: 13, color: colors.textSecondary, marginBottom: spacing.lg, lineHeight: 18 },
  cta: {
    marginTop: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: radii.button,
  },
  ctaText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  secondaryCta: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: radii.button,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  secondaryCtaText: { color: '#059669', fontWeight: '700', fontSize: 14 },
  successWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  successIcon: { width: 80, height: 80, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  successTitle: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 8 },
  successSub: { textAlign: 'center', color: colors.textSecondary, lineHeight: 22, marginBottom: 24 },
  missing: { padding: spacing.lg, color: colors.textSecondary },
});
