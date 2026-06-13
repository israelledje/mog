import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, FileText, Download, Receipt, Package } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { invoicesApi, groupagesApi } from '../../src/api/colis';
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
        const [invoices, packingLists] = await Promise.all([
          invoicesApi.list().catch(() => []),
          groupagesApi.getMyPackingLists().catch(() => [])
        ]);

        const invoiceDocs = invoices.map(i => ({
          id: i.id || i._id,
          title: `Facture ${i.invoice_number || 'N/A'}`,
          date: i.created_at,
          type: 'invoice',
          downloadPath: `/invoices/${i.id || i._id}/pdf`,
          filename: `Facture_${i.invoice_number || 'MOG'}.pdf`
        }));

        const packingDocs = packingLists.map(pl => ({
          id: pl.id || pl._id,
          title: `Packing List - ${pl.container_number || 'Groupage'}`,
          date: pl.created_at,
          type: 'packing_list',
          downloadPath: `/groupages/${pl.id || pl._id}/packing-list`,
          filename: `PackingList_${pl.container_number || 'MOG'}.pdf`
        }));

        const allDocs = [...invoiceDocs, ...packingDocs].sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );

        setDocs(allDocs);
      } catch (e) {
        console.error("Error fetching documents:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const onDownload = async (doc: any) => {
    setDownloading(doc.id);
    Haptics.selectionAsync();
    try {
      await fileService.downloadAndShare(doc.downloadPath, doc.filename);
      Toast.show({ type: 'success', text1: 'Document téléchargé' });
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Erreur lors du téléchargement' });
    } finally {
      setDownloading(null);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']} testID="documents-screen">
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} testID="docs-back">
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
              <Text style={styles.emptyText}>Aucun document disponible</Text>
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
