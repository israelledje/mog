import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { X, QrCode, RefreshCcw, ShieldCheck, Mail, Lock, KeyRound } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Toast from 'react-native-toast-message';
import { useAuthStore } from '../../src/store/authStore';
import { colors, radii, spacing, shadow } from '../../src/constants/theme';

export default function OperatorLoginScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const loginWithQR = useAuthStore((s) => s.loginWithQR);
  const loginManualOTP = useAuthStore((s) => s.loginManualOTP);
  const confirmQRLogin = useAuthStore((s) => s.confirmQRLogin);
  const loading = useAuthStore((s) => s.loading);
  
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [step, setStep] = useState<'scan' | 'manual' | 'otp'>('scan');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');

  useEffect(() => {
    if (!permission) requestPermission();
  }, [permission]);

  const onBarcodeScanned = async ({ data }: { data: string }) => {
    if (scanned || step !== 'scan') return;
    setScanned(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    try {
      const res = await loginWithQR(data);
      setEmail(res.email);
      setStep('otp');
      Toast.show({ type: 'info', text1: 'OTP envoyé sur WhatsApp' });
    } catch (e: any) {
      Alert.alert('Erreur', 'Badge invalide ou non reconnu.');
      setScanned(false);
    }
  };

  const handleManualSubmit = async () => {
    if (!email || !password) return;
    try {
      const res = await loginManualOTP(email, password);
      setEmail(res.email);
      setStep('otp');
      Toast.show({ type: 'info', text1: 'OTP envoyé sur WhatsApp' });
    } catch (e: any) {
      Alert.alert('Erreur', 'Identifiants incorrects ou accès refusé.');
    }
  };

  const handleVerify = async () => {
    if (otp.length < 4) return;
    try {
      await confirmQRLogin(email, otp);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Toast.show({ type: 'success', text1: 'Authentification réussie' });
      router.replace('/(operator)');
    } catch (e: any) {
      Alert.alert('Erreur', 'Code OTP incorrect ou expiré.');
    }
  };

  if (!permission) return <View style={styles.container} />;

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>Nous avons besoin de la caméra pour scanner votre badge.</Text>
        <TouchableOpacity style={styles.btn} onPress={requestPermission}>
          <Text style={styles.btnText}>Autoriser la caméra</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (step === 'otp') {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
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

          <TouchableOpacity style={styles.resendBtn} onPress={() => { setStep('scan'); setScanned(false); }}>
            <Text style={styles.resendText}>Annuler et recommencer</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  if (step === 'manual') {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
        <View style={styles.otpCard}>
          <View style={styles.otpIcon}>
            <KeyRound size={40} color={colors.primary} />
          </View>
          <Text style={styles.otpTitle}>Saisie Manuelle</Text>
          <Text style={styles.otpDesc}>Identifiez-vous sans badge. Vous devrez tout de même confirmer par OTP WhatsApp.</Text>
          
          <View style={[styles.inputWrapper, { marginBottom: spacing.md }]}>
            <Mail size={20} color={colors.textSecondary} />
            <TextInput
              style={styles.input}
              placeholder="Email ou Pseudo"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              placeholderTextColor={colors.textSecondary}
            />
          </View>

          <View style={[styles.inputWrapper, { marginBottom: spacing.xl }]}>
            <Lock size={20} color={colors.textSecondary} />
            <TextInput
              style={styles.input}
              placeholder="Mot de passe"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholderTextColor={colors.textSecondary}
            />
          </View>

          <TouchableOpacity 
            style={[styles.submitBtn, loading && { opacity: 0.7 }]} 
            onPress={handleManualSubmit}
            disabled={loading || !email || !password}
          >
            <Text style={styles.submitBtnText}>{loading ? 'Chargement...' : 'Suivant (OTP)'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.resendBtn} onPress={() => { setStep('scan'); setScanned(false); }}>
            <Text style={styles.resendText}>← Retour au Scan Badge</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        onBarcodeScanned={scanned ? undefined : onBarcodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
      />

      <View style={styles.overlay}>
        <TouchableOpacity style={styles.close} onPress={() => router.back()}>
          <X size={28} color="#fff" />
        </TouchableOpacity>

        <View style={styles.scanArea}>
          <View style={styles.cornerTopLeft} />
          <View style={styles.cornerTopRight} />
          <View style={styles.cornerBottomLeft} />
          <View style={styles.cornerBottomRight} />
        </View>

        <View style={styles.footer}>
          {scanned ? (
            <View style={{ alignItems: 'center' }}>
              <RefreshCcw size={32} color={colors.accent} />
              <Text style={[styles.hint, { color: colors.accent, marginTop: 10 }]}>Envoi de l'OTP WhatsApp...</Text>
            </View>
          ) : (
            <>
              <QrCode size={32} color="#fff" strokeWidth={1.5} />
              <Text style={styles.hint}>Scannez le code QR de votre badge opérateur</Text>
              
              <TouchableOpacity style={styles.manualBtn} onPress={() => setStep('manual')}>
                <Text style={styles.manualBtnText}>Je n'ai pas mon badge (Saisie manuelle)</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  message: { color: '#fff', textAlign: 'center', marginBottom: spacing.lg, paddingHorizontal: spacing.xl },
  btn: { backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: radii.button },
  btnText: { color: '#fff', fontWeight: '700' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center' },
  close: { position: 'absolute', top: 60, right: 20, padding: 8 },
  scanArea: { width: 250, height: 250, position: 'relative' },
  cornerTopLeft: { position: 'absolute', top: 0, left: 0, width: 40, height: 40, borderTopWidth: 4, borderLeftWidth: 4, borderColor: colors.accent },
  cornerTopRight: { position: 'absolute', top: 0, right: 0, width: 40, height: 40, borderTopWidth: 4, borderRightWidth: 4, borderColor: colors.accent },
  cornerBottomLeft: { position: 'absolute', bottom: 0, left: 0, width: 40, height: 40, borderBottomWidth: 4, borderLeftWidth: 4, borderColor: colors.accent },
  cornerBottomRight: { position: 'absolute', bottom: 0, right: 0, width: 40, height: 40, borderBottomWidth: 4, borderRightWidth: 4, borderColor: colors.accent },
  footer: { position: 'absolute', bottom: 60, alignItems: 'center', gap: spacing.md, width: '100%' },
  hint: { color: '#fff', fontSize: 16, fontWeight: '600', textAlign: 'center', paddingHorizontal: spacing.xl },
  manualBtn: { marginTop: spacing.xl, paddingVertical: 10, paddingHorizontal: 20, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: radii.button, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  manualBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  
  otpCard: { backgroundColor: '#fff', width: '85%', borderRadius: radii.card, padding: spacing.xl, alignItems: 'center', ...shadow.floating },
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
