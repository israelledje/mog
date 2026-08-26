import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { CheckCircle2, Building2, Smartphone, ShieldCheck, AlertTriangle, Zap, Radio } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { paymentsApi } from '../api/payments';
import { colors, fonts, radii, spacing, shadow } from '../constants/theme';

export type PaymentMethodKey = 'om' | 'momo' | 'bank';

interface Props {
  selectedMethod: PaymentMethodKey;
  onSelectMethod: (m: PaymentMethodKey) => void;
  phone?: string;
  onSuggestMethod?: (m: PaymentMethodKey) => void;
}

export function detectCarrier(phone: string): 'om' | 'momo' | 'unknown' {
  const clean = phone.replace(/[^0-9]/g, '');
  const local = clean.startsWith('237') ? clean.slice(3) : clean;
  if (local.length < 2) return 'unknown';

  const p2 = local.slice(0, 2);
  const p3 = local.slice(0, 3);

  // Orange Cameroun : 69x, 655x, 656x, 657x, 658x, 659x
  if (p2 === '69') return 'om';
  if (['655', '656', '657', '658', '659'].includes(p3)) return 'om';

  // MTN Cameroun : 67x, 68x, 650x, 651x, 652x, 653x, 654x
  if (p2 === '67' || p2 === '68') return 'momo';
  if (['650', '651', '652', '653', '654'].includes(p3)) return 'momo';

  return 'unknown';
}

export default function PaymentMethodSelector({
  selectedMethod,
  onSelectMethod,
  phone = '',
  onSuggestMethod,
}: Props) {
  const [gatewayStatus, setGatewayStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await paymentsApi.methods();
        if (mounted) setGatewayStatus(res);
      } catch (e) {
        // Fallback standard
        if (mounted) {
          setGatewayStatus({
            gateway_active: true,
            mode: 'live',
            methods: {
              om: { available: true, instant: true },
              momo: { available: true, instant: true },
              bank: { available: true, instant: false },
            },
          });
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const carrier = detectCarrier(phone);
  const isCarrierMismatch =
    phone.length >= 8 &&
    carrier !== 'unknown' &&
    ((selectedMethod === 'om' && carrier === 'momo') ||
      (selectedMethod === 'momo' && carrier === 'om'));

  const methodsList = [
    {
      key: 'om' as PaymentMethodKey,
      title: 'Orange Money',
      subtitle: 'Instantané · USSD / Push',
      badge: 'Orange Cameroun',
      badgeColor: '#FF7900',
      bgColor: '#FFF7ED',
      borderColor: '#FF7900',
      logo: (
        <View style={styles.omLogo}>
          <Text style={styles.omLogoTxt}>OM</Text>
        </View>
      ),
    },
    {
      key: 'momo' as PaymentMethodKey,
      title: 'MTN MoMo',
      subtitle: 'Instantané · Code *126#',
      badge: 'MTN Cameroun',
      badgeColor: '#EAB308',
      bgColor: '#FEFCE8',
      borderColor: '#EAB308',
      logo: (
        <View style={styles.momoLogo}>
          <Text style={styles.momoLogoTxt}>MoMo</Text>
        </View>
      ),
    },
    {
      key: 'bank' as PaymentMethodKey,
      title: 'Virement Bancaire',
      subtitle: 'Validation sous 3 jours',
      badge: 'Bancaire / Agence',
      badgeColor: '#0284C7',
      bgColor: '#F0F9FF',
      borderColor: '#0284C7',
      logo: (
        <View style={styles.bankLogo}>
          <Building2 size={20} color="#fff" />
        </View>
      ),
    },
  ];

  return (
    <View style={styles.container}>
      {/* Statut de la passerelle */}
      <View style={styles.gatewayBar}>
        <View style={styles.liveDot} />
        <Text style={styles.gatewayText}>
          Passerelle MOG active · {gatewayStatus?.mode === 'demo' ? 'Mode Démo Connecté' : 'Paiements Sécurisés'}
        </Text>
      </View>

      {/* Cartes de sélection */}
      <View style={styles.cardsWrap}>
        {methodsList.map((m) => {
          const isSelected = selectedMethod === m.key;
          return (
            <TouchableOpacity
              key={m.key}
              activeOpacity={0.88}
              style={[
                styles.card,
                isSelected && {
                  borderColor: m.borderColor,
                  backgroundColor: m.bgColor,
                  ...shadow.md,
                },
              ]}
              onPress={() => {
                Haptics.selectionAsync();
                onSelectMethod(m.key);
              }}
            >
              <View style={styles.cardHeader}>
                {m.logo}
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <View style={styles.titleRow}>
                    <Text style={[styles.cardTitle, isSelected && { color: colors.text, fontWeight: '800' }]}>
                      {m.title}
                    </Text>
                    {isSelected && (
                      <CheckCircle2 size={18} color={m.borderColor} />
                    )}
                  </View>
                  <Text style={styles.cardSub}>{m.subtitle}</Text>
                </View>
              </View>

              <View style={styles.cardFooter}>
                <View style={[styles.badgePill, { backgroundColor: `${m.badgeColor}18` }]}>
                  <Text style={[styles.badgeText, { color: m.badgeColor }]}>{m.badge}</Text>
                </View>
                {m.key !== 'bank' && (
                  <View style={styles.instantPill}>
                    <Zap size={11} color="#059669" />
                    <Text style={styles.instantText}>Direct</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Suggestion d'inversion automatique d'opérateur */}
      {isCarrierMismatch && onSuggestMethod && (
        <TouchableOpacity
          style={styles.carrierAlert}
          activeOpacity={0.85}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onSuggestMethod(carrier as PaymentMethodKey);
          }}
        >
          <AlertTriangle size={18} color="#D97706" />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.carrierAlertTitle}>
              Numéro {carrier === 'om' ? 'Orange' : 'MTN'} détecté
            </Text>
            <Text style={styles.carrierAlertSub}>
              Cliquez ici pour basculer sur {carrier === 'om' ? 'Orange Money' : 'MTN MoMo'}.
            </Text>
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.sm,
  },
  gatewayBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.full,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignSelf: 'flex-start',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginRight: 8,
  },
  gatewayText: {
    fontSize: 11,
    fontFamily: fonts.medium,
    color: '#64748B',
  },
  cardsWrap: {
    gap: spacing.sm,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: radii.xl,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  omLogo: {
    width: 42,
    height: 42,
    borderRadius: radii.md,
    backgroundColor: '#FF7900',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF7900',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  omLogoTxt: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 16,
    fontFamily: fonts.bold,
  },
  momoLogo: {
    width: 42,
    height: 42,
    borderRadius: radii.md,
    backgroundColor: '#FFCC00',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#004F71',
    shadowColor: '#EAB308',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  momoLogoTxt: {
    color: '#004F71',
    fontWeight: '900',
    fontSize: 13,
    fontFamily: fonts.bold,
  },
  bankLogo: {
    width: 42,
    height: 42,
    borderRadius: radii.md,
    backgroundColor: '#0284C7',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: colors.text,
  },
  cardSub: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    marginTop: 2,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.04)',
  },
  badgePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: fonts.bold,
  },
  instantPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  instantText: {
    fontSize: 10,
    fontFamily: fonts.bold,
    color: '#059669',
  },
  carrierAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.sm + 2,
    marginTop: spacing.sm,
  },
  carrierAlertTitle: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: '#92400E',
  },
  carrierAlertSub: {
    fontSize: 11,
    fontFamily: fonts.medium,
    color: '#B45309',
    marginTop: 1,
  },
});
