import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { AlertTriangle, RefreshCcw } from 'lucide-react-native';
import { captureException } from '../api/monitoring';
import { colors, radii, spacing } from '../constants/theme';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    captureException(error, { componentStack: info.componentStack });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <View style={styles.container}>
        <View style={styles.iconWrap}>
          <AlertTriangle size={48} color={colors.danger} />
        </View>
        <Text style={styles.title}>Une erreur est survenue</Text>
        <Text style={styles.desc}>
          L'application a rencontré un problème inattendu. Vous pouvez réessayer.
        </Text>

        {__DEV__ && this.state.error && (
          <ScrollView style={styles.debugBox}>
            <Text style={styles.debugText}>{this.state.error.toString()}</Text>
          </ScrollView>
        )}

        <TouchableOpacity style={styles.btn} onPress={this.handleReset} activeOpacity={0.85}>
          <RefreshCcw size={20} color="#fff" />
          <Text style={styles.btnText}>Réessayer</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  iconWrap: {
    width: 96, height: 96, borderRadius: 48, backgroundColor: colors.dangerBg,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xl,
  },
  title: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: spacing.sm, textAlign: 'center' },
  desc: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.xl, lineHeight: 22 },
  debugBox: { maxHeight: 160, backgroundColor: '#00000010', borderRadius: radii.card, padding: spacing.md, marginBottom: spacing.lg, alignSelf: 'stretch' },
  debugText: { fontSize: 12, color: colors.danger, fontFamily: 'monospace' },
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.primary,
    paddingHorizontal: 28, paddingVertical: 14, borderRadius: radii.button,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
