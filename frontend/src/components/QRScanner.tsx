import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, QrCode, CameraOff } from 'lucide-react-native';
import { colors } from '../constants/theme';

const { width } = Dimensions.get('window');
const FRAME = Math.min(width * 0.7, 280);

interface QRScannerProps {
  /** Called once when a code is detected. Re-enable scanning by toggling `active`. */
  onScan: (data: string) => void;
  /** When false, the camera stops decoding (e.g. while processing a result). */
  active?: boolean;
  onClose?: () => void;
  hint?: string;
  /** Optional footer content (e.g. "manual entry" button). */
  footer?: React.ReactNode;
  barcodeTypes?: ('qr' | 'ean13' | 'ean8' | 'code128' | 'code39' | 'upc_a' | 'upc_e' | 'itf14')[];
}

export default function QRScanner({
  onScan,
  active = true,
  onClose,
  hint = 'Alignez le code dans le cadre',
  footer,
  barcodeTypes = ['qr', 'ean13', 'code128', 'code39'],
}: QRScannerProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const insets = useSafeAreaInsets();
  const lockRef = useRef(false);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission]);

  useEffect(() => {
    if (active) lockRef.current = false;
  }, [active]);

  const handleScanned = (result: BarcodeScanningResult) => {
    if (!active || lockRef.current || !result.data) return;
    lockRef.current = true;
    onScan(result.data);
  };

  if (!permission) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.container, styles.center]}>
        <CameraOff size={56} color="#fff" style={{ marginBottom: 20, opacity: 0.9 }} />
        <Text style={styles.permTitle}>Caméra désactivée</Text>
        <Text style={styles.permText}>
          Autorisez l'accès à la caméra pour scanner les codes QR et codes-barres.
        </Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Autoriser la caméra</Text>
        </TouchableOpacity>
        {onClose && (
          <TouchableOpacity style={styles.permCancel} onPress={onClose}>
            <Text style={styles.permCancelText}>Retour</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        onBarcodeScanned={active ? handleScanned : undefined}
        barcodeScannerSettings={{ barcodeTypes }}
      />

      {/* Assombrissement autour de la fenêtre de scan */}
      <View style={styles.mask} pointerEvents="none">
        <View style={styles.maskRow} />
        <View style={styles.maskCenter}>
          <View style={styles.maskSide} />
          <View style={styles.frame}>
            <View style={[styles.corner, styles.cTL]} />
            <View style={[styles.corner, styles.cTR]} />
            <View style={[styles.corner, styles.cBL]} />
            <View style={[styles.corner, styles.cBR]} />
          </View>
          <View style={styles.maskSide} />
        </View>
        <View style={styles.maskRow} />
      </View>

      {onClose && (
        <TouchableOpacity
          style={[styles.close, { top: insets.top + 12 }]}
          onPress={onClose}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <X size={26} color="#fff" />
        </TouchableOpacity>
      )}

      <View style={[styles.footer, { bottom: insets.bottom + 40 }]}>
        <QrCode size={28} color="#fff" strokeWidth={1.6} />
        <Text style={styles.hint}>{hint}</Text>
        {footer}
      </View>
    </View>
  );
}

const DIM = 'rgba(0,0,0,0.6)';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { alignItems: 'center', justifyContent: 'center', padding: 32 },
  mask: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  maskRow: { flex: 1, backgroundColor: DIM },
  maskCenter: { flexDirection: 'row', height: FRAME },
  maskSide: { flex: 1, backgroundColor: DIM },
  frame: { width: FRAME, height: FRAME, position: 'relative' },
  corner: { position: 'absolute', width: 34, height: 34, borderColor: colors.accent },
  cTL: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 8 },
  cTR: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 8 },
  cBL: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 8 },
  cBR: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 8 },
  close: {
    position: 'absolute',
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  footer: { position: 'absolute', left: 0, right: 0, alignItems: 'center', gap: 14, paddingHorizontal: 24 },
  hint: { color: '#fff', fontSize: 15, fontWeight: '600', textAlign: 'center' },
  permTitle: { color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 10, textAlign: 'center' },
  permText: { color: 'rgba(255,255,255,0.75)', fontSize: 14, textAlign: 'center', marginBottom: 28, lineHeight: 20 },
  permBtn: { backgroundColor: colors.primary, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 10 },
  permBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  permCancel: { marginTop: 16, padding: 8 },
  permCancelText: { color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
});
