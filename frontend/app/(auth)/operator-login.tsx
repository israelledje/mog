import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { RefreshCcw, ShieldCheck, Mail, Lock, KeyRound, ScanLine } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Toast from 'react-native-toast-message';
import { useAuthStore } from '../../src/store/authStore';
import QRScanner from '../../src/components/QRScanner';
import { colors, radii, spacing, shadow } from '../../src/constants/theme';

export default function OperatorLoginScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const loginWithQR = useAuthStore((s) => s.loginWithQR);
  const loginManualOTP = useAuthStore((s) => s.loginManualOTP);
  const confirmQRLogin = useAuthStore((s) => s.confirmQRLogin);
  const login = useAuthStore((s) => s.login);
  const loading = useAuthStore((s) => s.loading);

  const [scanned, setScanned] = useState(false);
  const isScanningRef = useRef(false);
  const [step, setStep] = useState<'scan' | 'manual' | 'otp'>('manual');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');

  const resetScan = () => {
    setScanned(false);
    isScanningRef.current = false;
  };

  const onBarcodeScanned = async (data: string) => {
    if (isScanningRef.current || step !== 'scan') return;
    isScanningRef.current = true;
    setScanned(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    try {
      const res = await loginWithQR(data);
      setEmail(res.email);
      setStep('otp');
      Toast.show({ type: 'info', text1: t('operator.otp_sent_whatsapp') });
    } catch (e: any) {
      Alert.alert(t('errors.server'), t('operator.badge_invalid'), [{
        text: t('common.retry'),
        onPress: resetScan
      }]);
    }
  };

  // Connexion directe email + mot de passe (sans QR ni OTP)
  const handleDirectLogin = async () => {
    if (!email || !password) return;
    try {
      const user = await login(email.trim(), password);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (user.role === 'operator' || user.role === 'admin') {
        router.replace('/(operator)');
      } else {
        router.replace('/(tabs)');
      }
    } catch (e: any) {
      Alert.alert(t('errors.server'), t('operator.access_denied'));
    }
  };

  const handleManualSubmit = async () => {
    if (!email || !password) return;
    try {
      const res = await loginManualOTP(email, password);
      setEmail(res.email);
      setStep('otp');
      Toast.show({ type: 'info', text1: t('operator.otp_sent_whatsapp') });
    } catch (e: any) {
      Alert.alert(t('errors.server'), t('operator.access_denied'));
    }
  };

  const handleVerify = async () => {
    if (otp.length < 4) return;
    try {
      await confirmQRLogin(email, otp);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Toast.show({ type: 'success', text1: t('operator.auth_success') });
      router.replace('/(operator)');
    } catch (e: any) {
      Alert.alert(t('errors.server'), t('operator.otp_incorrect'));
    }
  };

  if (step === 'otp') {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.container, styles.centerContent]}>
        <View style={styles.otpCard}>
          <View style={styles.otpIcon}>
            <ShieldCheck size={40} color={colors.primary} />
          </View>
          <Text style={styles.otpTitle}>Vérification WhatsApp</Text>
          <Text style={styles.otpDesc}>Entrez le code reçu par WhatsApp au numéro lié à votre compte.</Text>
          
          <TextInput
            style={styles.otpInput}
            value={otp}
            onChangeText={setOtp}
            keyboardType="number-pad"
            maxLength={4}
            placeholder="0000"
            placeholderTextColor={colors.textSecondary}
          />

          <TouchableOpacity 
            style={[styles.submitBtn, loading && { opacity: 0.7 }]} 
            onPress={handleVerify}
            disabled={loading || otp.length < 4}
          >
            <Text style={styles.submitBtnText}>{loading ? 'Vérification...' : 'Confirmer'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.resendBtn} onPress={() => { setStep('manual'); resetScan(); }}>
            <Text style={styles.resendText}>Annuler et recommencer</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  if (step === 'scan') {
    return (
      <QRScanner
        active={!scanned}
        onScan={onBarcodeScanned}
        onClose={() => { setStep('manual'); resetScan(); }}
        hint="Scannez le code QR de votre badge opérateur"
        barcodeTypes={['qr']}
        footer={
          scanned ? (
            <View style={{ alignItems: 'center', marginTop: 8 }}>
              <RefreshCcw size={26} color={colors.accent} />
              <Text style={{ color: colors.accent, marginTop: 8, fontWeight: '700' }}>Envoi de l'OTP WhatsApp...</Text>
            </View>
          ) : null
        }
      />
    );
  }

  // Écran principal : connexion opérateur par email + mot de passe
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.container, styles.centerContent]}>
      <View style={styles.otpCard}>
        <View style={styles.otpIcon}>
          <KeyRound size={40} color={colors.primary} />
        </View>
        <Text style={styles.otpTitle}>Connexion Opérateur</Text>
        <Text style={styles.otpDesc}>Identifiez-vous avec votre email et mot de passe professionnels.</Text>

        <View style={[styles.inputWrapper, { marginBottom: spacing.md }]}>
          <Mail size={20} color={colors.textSecondary} />
          <TextInput
            style={styles.input}
            placeholder={t('operator.pro_email')}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholderTextColor={colors.textSecondary}
          />
        </View>

        <View style={[styles.inputWrapper, { marginBottom: spacing.xl }]}>
          <Lock size={20} color={colors.textSecondary} />
          <TextInput
            style={styles.input}
            placeholder={t('auth.password')}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholderTextColor={colors.textSecondary}
          />
        </View>

        <TouchableOpacity
          style={[styles.submitBtn, loading && { opacity: 0.7 }]}
          onPress={handleDirectLogin}
          disabled={loading || !email || !password}
        >
          <Text style={styles.submitBtnText}>{loading ? 'Connexion...' : 'Se connecter'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryLink} onPress={handleManualSubmit} disabled={loading || !email || !password}>
          <Text style={styles.secondaryLinkText}>Connexion sécurisée avec code OTP WhatsApp</Text>
        </TouchableOpacity>

        <View style={styles.dividerRow}>
          <View style={styles.divider} />
          <Text style={styles.dividerText}>OU</Text>
          <View style={styles.divider} />
        </View>

        <TouchableOpacity style={styles.badgeBtn} onPress={() => { setStep('scan'); resetScan(); }}>
          <ScanLine size={20} color={colors.primary} />
          <Text style={styles.badgeBtnText}>Scanner mon badge QR</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.resendBtn} onPress={() => router.back()}>
          <Text style={styles.resendText}>← Retour</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centerContent: { justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  secondaryLink: { marginTop: spacing.md, alignItems: 'center' },
  secondaryLinkText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginVertical: spacing.lg, width: '100%' },
  divider: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { fontSize: 12, color: colors.textSecondary, fontWeight: '700' },
  badgeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, width: '100%', paddingVertical: 14, borderRadius: radii.button, borderWidth: 2, borderColor: colors.primary },
  badgeBtnText: { color: colors.primary, fontWeight: '700', fontSize: 15 },

  otpCard: { backgroundColor: '#fff', width: '90%', borderRadius: radii.card, padding: spacing.xl, alignItems: 'center', ...shadow.floating },
  otpIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: `${colors.primary}10`, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  otpTitle: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 8 },
  otpDesc: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.xl },
  otpInput: { width: '100%', height: 60, backgroundColor: colors.background, borderRadius: radii.input, fontSize: 32, fontWeight: '900', textAlign: 'center', color: colors.primary, letterSpacing: 10, marginBottom: spacing.xl },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background, borderRadius: radii.input, paddingHorizontal: 16, height: 52, width: '100%', borderWidth: 1, borderColor: colors.border },
  input: { flex: 1, marginLeft: 10, fontSize: 16, color: colors.text },
  submitBtn: { width: '100%', backgroundColor: colors.primary, paddingVertical: 16, borderRadius: radii.button, alignItems: 'center' },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  resendBtn: { marginTop: spacing.lg },
  resendText: { color: colors.textSecondary, fontWeight: '600', fontSize: 13 },
});
