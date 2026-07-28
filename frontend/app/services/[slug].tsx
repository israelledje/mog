import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ChevronLeft } from 'lucide-react-native';
import { getServiceBySlug } from '../../src/constants/services';
import ServiceFormScreen from '../../src/components/services/ServiceFormScreen';
import { colors, spacing } from '../../src/constants/theme';

export default function ServiceDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const service = getServiceBySlug(slug);

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
        <Text style={styles.missing}>
          {t('services.unknown', { defaultValue: 'Service introuvable' })}
        </Text>
      </SafeAreaView>
    );
  }

  return <ServiceFormScreen service={service} />;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F5F8' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E8ECF1',
  },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '800', color: colors.text },
  missing: { padding: spacing.lg, color: colors.textSecondary },
});
