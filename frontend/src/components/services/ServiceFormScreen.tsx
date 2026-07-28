import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Linking, ImageBackground,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ChevronLeft, Send, MessageCircle, CheckCircle2, ShieldCheck, Clock3, Lock, Building2,
} from 'lucide-react-native';
import type { ServiceDef } from '../../constants/services';
import {
  ServiceRequestForm, validateServiceForm, humanizePayload,
} from './ServiceRequestForm';
import { servicesApi } from '../../api/services';
import { useAuthStore } from '../../store/authStore';
import { useSettingsStore } from '../../store/settingsStore';
import { buildWhatsAppUrl, getSupportPhoneDigits } from '../../utils/support';
import { colors, fonts, spacing } from '../../constants/theme';

type Props = {
  service: ServiceDef;
};

export default function ServiceFormScreen({ service }: Props) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const settings = useSettingsStore((s) => s.settings);

  const initial = useMemo(() => {
    const base: Record<string, string> = {};
    for (const f of service.fields) base[f.key] = '';
    if (user?.full_name) base.full_name = user.full_name;
    if (user?.phone) base.phone = user.phone;
    if (user?.email && 'email' in base) base.email = user.email;
    return base;
  }, [service, user]);

  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [doneId, setDoneId] = useState<string | null>(null);

  useEffect(() => {
    setValues(initial);
  }, [initial]);

  const onChange = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: '' }));
  };

  const onSubmit = async () => {
    const errs = validateServiceForm(service.fields, values);
    setErrors(errs);
    if (Object.keys(errs).length) {
      Alert.alert('Formulaire incomplet', 'Merci de renseigner les champs obligatoires marqués d’un astérisque.');
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
        'Envoi impossible',
        e?.response?.data?.detail || e?.message || 'Une erreur est survenue. Veuillez réessayer.',
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
          <View style={[styles.successIcon, { backgroundColor: `${service.color}14` }]}>
            <CheckCircle2 size={36} color={service.color} strokeWidth={2} />
          </View>
          <Text style={styles.successEyebrow}>SARL M.O.G GROUP MULTISERVICE</Text>
          <Text style={styles.successTitle}>Demande enregistrée</Text>
          <Text style={styles.successSub}>
            Votre dossier a bien été transmis à nos opérateurs. Vous serez contacté(e) sous peu sur le numéro indiqué, avec les éléments déjà collectés.
          </Text>
          <View style={styles.successRef}>
            <Text style={styles.successRefLabel}>Référence</Text>
            <Text style={styles.successRefValue}>{doneId.slice(0, 8).toUpperCase()}</Text>
          </View>
          <TouchableOpacity style={[styles.cta, { backgroundColor: colors.primary }]} onPress={() => router.back()}>
            <Text style={styles.ctaText}>Retour à l’accueil</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.linkBtn} onPress={onWhatsAppBackup}>
            <MessageCircle size={15} color={colors.textSecondary} />
            <Text style={styles.linkBtnText}>Contacter aussi via WhatsApp</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back} accessibilityRole="button">
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.topBarCenter}>
          <Text style={styles.topBarBrand}>M.O.G Services</Text>
          <Text style={styles.topBarTitle} numberOfLines={1}>{service.shortTitle}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <ImageBackground
            source={service.heroImage}
            style={styles.heroBg}
            imageStyle={styles.heroBgImage}
            resizeMode="cover"
          >
            <LinearGradient
              colors={['rgba(15,23,42,0.15)', 'rgba(15,23,42,0.55)', 'rgba(15,23,42,0.92)']}
              locations={[0, 0.45, 1]}
              style={styles.heroGradient}
            >
              <View style={styles.heroTop}>
                <View style={styles.heroIcon}>
                  <service.Icon size={22} color="#fff" strokeWidth={2.1} />
                </View>
                <View style={styles.brandChip}>
                  <Building2 size={12} color="#fff" />
                  <Text style={styles.brandChipText}>Service officiel</Text>
                </View>
              </View>
              <View style={[styles.heroColorBar, { backgroundColor: service.color }]} />
              <Text style={styles.heroTitle}>{service.title}</Text>
              {service.intro.slice(0, 2).map((p, i) => (
                <Text key={i} style={styles.heroPara}>{p}</Text>
              ))}
            </LinearGradient>
          </ImageBackground>
        </View>

        <View style={styles.trustRow}>
          <View style={styles.trustItem}>
            <ShieldCheck size={16} color={colors.primary} />
            <Text style={styles.trustText}>Données protégées</Text>
          </View>
          <View style={styles.trustDivider} />
          <View style={styles.trustItem}>
            <Lock size={16} color={colors.primary} />
            <Text style={styles.trustText}>Usage interne MOG</Text>
          </View>
          <View style={styles.trustDivider} />
          <View style={styles.trustItem}>
            <Clock3 size={16} color={colors.primary} />
            <Text style={styles.trustText}>Rappel sous 24h</Text>
          </View>
        </View>

        <Text style={styles.formLead}>Formulaire de demande</Text>
        <Text style={styles.formHint}>
          Remplissez les champs ci-dessous. Un conseiller traitera votre dossier avec les informations déjà renseignées.
        </Text>

        <ServiceRequestForm
          fields={service.fields}
          values={values}
          onChange={onChange}
          errors={errors}
          accentColor={service.color}
        />

        <TouchableOpacity
          style={[styles.cta, submitting && { opacity: 0.7 }]}
          onPress={onSubmit}
          disabled={submitting}
          activeOpacity={0.9}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Send size={17} color="#fff" />
              <Text style={styles.ctaText}>Soumettre ma demande</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.legal}>
          En envoyant ce formulaire, vous autorisez M.O.G à vous contacter pour cette demande. Vos informations ne sont pas revendues.
        </Text>

        <TouchableOpacity style={styles.linkBtn} onPress={onWhatsAppBackup}>
          <MessageCircle size={15} color={colors.textSecondary} />
          <Text style={styles.linkBtnText}>Préférer WhatsApp</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F5F8' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E8ECF1',
  },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topBarCenter: { flex: 1, alignItems: 'center' },
  topBarBrand: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  topBarTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    fontFamily: fonts.heading,
    marginTop: 1,
  },
  scroll: { padding: spacing.lg, paddingBottom: 48 },

  hero: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 14,
    minHeight: 210,
    backgroundColor: '#1E293B',
  },
  heroBg: { minHeight: 210 },
  heroBgImage: { borderRadius: 20 },
  heroGradient: {
    flex: 1,
    minHeight: 210,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 18,
    justifyContent: 'flex-end',
  },
  heroTop: {
    position: 'absolute',
    top: 16,
    left: 18,
    right: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  brandChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  brandChipText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  heroColorBar: {
    width: 36,
    height: 3,
    borderRadius: 2,
    marginBottom: 10,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    fontFamily: fonts.heading,
    marginBottom: 8,
    lineHeight: 26,
  },
  heroPara: {
    fontSize: 13,
    lineHeight: 19,
    color: 'rgba(255,255,255,0.82)',
    marginBottom: 3,
  },

  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E8ECF1',
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginBottom: 20,
  },
  trustItem: { flex: 1, alignItems: 'center', gap: 5 },
  trustText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  trustDivider: { width: 1, height: 28, backgroundColor: '#E8ECF1' },

  formLead: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    fontFamily: fonts.heading,
    marginBottom: 4,
  },
  formHint: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
    marginBottom: 16,
  },

  cta: {
    marginTop: 20,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
  },
  ctaText: { color: '#fff', fontWeight: '800', fontSize: 15, letterSpacing: 0.2 },

  legal: {
    marginTop: 14,
    fontSize: 11,
    lineHeight: 16,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  linkBtn: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  linkBtnText: { color: colors.textSecondary, fontWeight: '600', fontSize: 13 },

  successWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  successIcon: {
    width: 76,
    height: 76,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  successEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    fontFamily: fonts.heading,
    marginBottom: 10,
  },
  successSub: {
    textAlign: 'center',
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: 20,
    fontSize: 14,
  },
  successRef: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E8ECF1',
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 24,
    minWidth: 160,
  },
  successRefLabel: { fontSize: 10, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase' },
  successRefValue: { fontSize: 18, fontWeight: '800', color: colors.text, marginTop: 2, letterSpacing: 1 },
});
