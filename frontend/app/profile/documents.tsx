import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, FileText, Download, Receipt, Package } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { colisApi, groupagesApi } from '../../src/api/colis';
import { fileService } from '../../src/api/files';
import { colors, fonts, radii, shadow, spacing } from '../../src/constants/theme';
import Toast from 'react-native-toast-message';

export default function DocumentsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [colis, packingLists] = await Promise.all([
          colisApi.list().catch(() => []),
          groupagesApi.getMyPackingLists().catch(() => [])
        ]);

        // Factures : on réutilise exactement le mécanisme du détail colis
        // (endpoint /colis/{id}/invoice). On ne liste que les colis déjà facturés.
        const invoiceDocs = colis
          .filter((c) => c.invoice_status && c.invoice_status !== 'none' && c.status !== 'pending_reception')
          .map((c) => ({
            id: c.id,
            title: t('profile.doc_invoice', { tracking: c.tracking_number }),
            date: c.updated_at || c.created_at,
            type: 'invoice',
            downloadPath: `/colis/${c.id}/invoice`,
            filename: `Facture_${c.tracking_number}.pdf`
          }));

        const packingDocs = packingLists.map(pl => ({
          id: pl.id || pl._id,
          title: t('profile.doc_packing_list', { ref: pl.container_number || t('profile.doc_groupage') }),
          date: pl.created_at,
          type: 'packing_list',
          downloadPath: `/groupages/${pl.id || pl._id}/packing-list`,
          filename: `PackingList_${pl.container_number || 'MOG'}.pdf`
        }));

        const allDocs = [...invoiceDocs, ...packingDocs].sort(
          (a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()
        );

        setDocs(allDocs);
      } catch (e) {
        console.error("Error fetching documents:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [t]);

  const onDownload = async (doc: any) => {
    setDownloading(doc.id);
    Haptics.selectionAsync();
    try {
      await fileService.downloadAndShare(doc.downloadPath, doc.filename);
      Toast.show({ type: 'success', text1: t('profile.doc_downloaded') });
    } catch (e) {
      Toast.show({ type: 'error', text1: t('profile.doc_download_error') });
    } finally {
      setDownloading(null);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']} testID="documents-screen">
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} testID="docs-back" accessibilityRole="button" accessibilityLabel={t('common.back')}>
          <ChevronLeft size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('profile.my_documents')}</Text>
        <View style={{ width: 26 }} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <FlatList
          data={docs}
          contentContainerStyle={styles.list}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.docCard}>
              <View style={styles.iconContainer}>
                {item.type === 'invoice' ? (
                  <Receipt size={24} color={colors.primary} />
                ) : (
                  <Package size={24} color={colors.primary} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.docTitle}>{item.title}</Text>
                <Text style={styles.docDate}>{new Date(item.date).toLocaleDateString()}</Text>
              </View>
              <TouchableOpacity 
                style={styles.downloadBtn} 
                onPress={() => onDownload(item)}
                disabled={downloading === item.id}
                accessibilityRole="button"
                accessibilityLabel={t('package.download_invoice')}
              >
                {downloading === item.id ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Download size={20} color={colors.primary} />
                )}
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <FileText size={48} color={colors.textSecondary} strokeWidth={1} />
              <Text style={styles.emptyText}>{t('common.no_data')}</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  list: { padding: spacing.lg, paddingTop: 0 },
  docCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: radii.card, padding: spacing.md, marginBottom: spacing.sm, ...shadow.card, gap: spacing.md },
  iconContainer: { width: 48, height: 48, borderRadius: 12, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  docTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  docDate: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  downloadBtn: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { padding: 40, alignItems: 'center', opacity: 0.5 },
  emptyText: { marginTop: 12, fontWeight: '600', color: colors.textSecondary }
});
