import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, ActivityIndicator,
  TextInput, ScrollView, Alert, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { WebView } from 'react-native-webview';
import {
  ChevronLeft, Plus, CheckCircle2, Trash2, Eye, Download, X, Plane, Ship,
} from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { invoicesApi, colisApi } from '../../src/api/colis';
import { adminApi, type AdminUser } from '../../src/api/admin';
import { fileService } from '../../src/api/files';
import { formatErr } from '../../src/api/client';
import { useAuthStore } from '../../src/store/authStore';
import { darkColors as colors, radii, spacing } from '../../src/constants/theme';
import { airBilledKg, packageCbm, billedQuantitiesForInvoice } from '../../src/utils/freightBilling';
import { tarifsApi, type Tarif } from '../../src/api/tarifs';

export default function InvoicesAdminScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [items, setItems] = useState<any[]>([]);
  const [customers, setCustomers] = useState<AdminUser[]>([]);
  const [tarifs, setTarifs] = useState<Tarif[]>([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [customerQ, setCustomerQ] = useState('');
  const [packages, setPackages] = useState<any[]>([]);
  const [selectedPkgs, setSelectedPkgs] = useState<Record<string, { qty: string; unitPrice: string; unit: string }>>({});
  const [discount, setDiscount] = useState('0');
  const [saving, setSaving] = useState(false);

  const [pdfVisible, setPdfVisible] = useState(false);
  const [pdfUri, setPdfUri] = useState<string | null>(null);
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [pdfTitle, setPdfTitle] = useState('');
  const [pdfEndpoint, setPdfEndpoint] = useState('');
  const [pdfBusy, setPdfBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [inv, cust, tfs] = await Promise.all([
        invoicesApi.list(),
        adminApi.customers().catch(() => []),
        tarifsApi.list().catch(() => []),
      ]);
      setItems(Array.isArray(inv) ? inv : []);
      setCustomers(Array.isArray(cust) ? cust : []);
      setTarifs(Array.isArray(tfs) ? tfs : []);
    } catch (e: any) {
      Toast.show({ type: 'error', text1: formatErr(e, 'Factures') });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filteredCustomers = useMemo(() => {
    const s = customerQ.trim().toLowerCase();
    if (!s) return customers.slice(0, 20);
    return customers.filter((c) =>
      `${c.full_name || ''} ${c.email || ''} ${c.client_code || ''}`.toLowerCase().includes(s),
    ).slice(0, 20);
  }, [customers, customerQ]);

  const openCreate = () => {
    setCustomerId('');
    setCustomerQ('');
    setPackages([]);
    setSelectedPkgs({});
    setDiscount('0');
    setShow(true);
  };

  const pickCustomer = async (c: AdminUser) => {
    setCustomerId(c.email);
    setCustomerQ(c.full_name || c.email);
    try {
      const pkgs = await colisApi.list({ owner_id: c.email, limit: 100 });
      const billable = (Array.isArray(pkgs) ? pkgs : []).filter(
        (p: any) => !p.invoice_id || p.invoice_status === 'none' || p.invoice_status === 'draft',
      );
      setPackages(billable);
      const defaults: Record<string, { qty: string; unitPrice: string; unit: string }> = {};
      for (const p of billable as any[]) {
        const mode = (p.transport_mode || p.mode || 'sea') as string;
        const isAir = mode === 'air' || mode === 'air_express';
        const pid = String(p.id || p._id);
        // Qty individuelle par défaut ; le total facture applique le regroupement sur la sélection
        const qty = isAir ? airBilledKg(p) : packageCbm(p);
        const cat = p.category_key || 'standard';
        const tarif = tarifs.find((t) => t.mode === (isAir ? 'air' : 'sea') && t.category_key === cat)
          || tarifs.find((t) => t.mode === (isAir ? 'air' : 'sea'));
        defaults[pid] = {
          qty: String(qty || 0),
          unitPrice: String(tarif?.price ?? p.total_price ?? 0),
          unit: isAir ? 'kg' : 'cbm',
        };
      }
      setSelectedPkgs(defaults);
    } catch {
      setPackages([]);
    }
  };

  const togglePkg = (id: string) => {
    setSelectedPkgs((prev) => {
      const next = { ...prev };
      if (next[id] && (next as any)[`_sel_${id}`]) {
        delete (next as any)[`_sel_${id}`];
      } else {
        (next as any)[`_sel_${id}`] = true;
        if (!next[id]) next[id] = { qty: '1', unitPrice: '0', unit: 'kg' };
      }
      return { ...next };
    });
  };

  const isSelected = (id: string) => !!(selectedPkgs as any)[`_sel_${id}`];

  const selectedIds = useMemo(
    () => Object.keys(selectedPkgs).filter((id) => !id.startsWith('_sel_') && (selectedPkgs as any)[`_sel_${id}`]),
    [selectedPkgs],
  );

  const groupQtyMap = useMemo(
    () => billedQuantitiesForInvoice(packages, selectedIds, (p) => String(p.id || p._id)),
    [packages, selectedIds],
  );

  const total = useMemo(() => {
    let sum = 0;
    for (const id of selectedIds) {
      const line = selectedPkgs[id];
      if (!line) continue;
      const qty = groupQtyMap.get(id)?.qty ?? Number(line.qty || 0);
      sum += qty * Number(line.unitPrice || 0);
    }
    return Math.max(0, sum - Number(discount || 0));
  }, [selectedPkgs, selectedIds, groupQtyMap, discount]);

  const createInvoice = async () => {
    if (!customerId) {
      Toast.show({ type: 'error', text1: 'Sélectionnez un client' });
      return;
    }
    const lines = selectedIds.map((package_id) => {
      const line = selectedPkgs[package_id];
      const qty = groupQtyMap.get(package_id)?.qty ?? Number(line?.qty || 0);
      return {
        package_id,
        weight_or_volume: qty,
        manual_unit_price: Number(line?.unitPrice || 0),
        calculated_unit_price: Number(line?.unitPrice || 0),
        unit: line?.unit || 'kg',
      };
    });
    if (!lines.length) {
      Toast.show({ type: 'error', text1: 'Sélectionnez au moins un colis' });
      return;
    }
    setSaving(true);
    try {
      const inv = await invoicesApi.create({
        customer_id: customerId,
        packages: lines,
        total_price: total,
        discount: Number(discount || 0),
        include_vat: false,
      });
      const invId = inv.id || inv._id;
      await invoicesApi.finalize(invId);
      setShow(false);
      setLoading(true);
      await load();
      Toast.show({ type: 'success', text1: 'Facture créée' });
      // Ouvre directement le PDF
      await openPdf({ id: invId, invoice_number: inv.invoice_number || `facture_${invId}` });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: formatErr(e, 'Erreur facture') });
    } finally {
      setSaving(false);
    }
  };

  const finalize = async (id: string) => {
    try {
      await invoicesApi.finalize(id);
      load();
      Toast.show({ type: 'success', text1: 'Facture finalisée' });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: formatErr(e, 'Erreur') });
    }
  };

  const remove = (id: string) => {
    Alert.alert('Supprimer', 'Supprimer cette facture ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive',
        onPress: async () => {
          try {
            await invoicesApi.remove(id);
            load();
          } catch (e: any) {
            Toast.show({ type: 'error', text1: formatErr(e, 'Erreur') });
          }
        },
      },
    ]);
  };

  const invoiceIdOf = (item: any) => item?.id || item?._id;

  const openPdf = async (item: any) => {
    const id = invoiceIdOf(item);
    if (!id) {
      Toast.show({ type: 'error', text1: 'Identifiant facture manquant' });
      return;
    }
    // Même endpoint que web-admin : GET /api/invoices/{id}/pdf
    const endpoint = `/invoices/${id}/pdf`;
    const filename = `${item.invoice_number || id}.pdf`;
    setPdfBusy(true);
    setPdfTitle(item.invoice_number || 'Facture');
    setPdfEndpoint(endpoint);
    setPdfVisible(true);
    setPdfUri(null);
    setPdfBase64(null);
    try {
      const pdf = await fileService.downloadPdf(endpoint, filename);
      setPdfUri(pdf.uri);
      setPdfBase64(pdf.base64);
    } catch (e: any) {
      const msg = e?.message || formatErr(e, 'PDF indisponible');
      Toast.show({ type: 'error', text1: String(msg).slice(0, 120) });
      setPdfVisible(false);
    } finally {
      setPdfBusy(false);
    }
  };

  const sharePdf = async () => {
    if (!pdfEndpoint) return;
    setPdfBusy(true);
    try {
      await fileService.downloadAndShare(pdfEndpoint, `${pdfTitle || 'facture'}.pdf`);
      Toast.show({ type: 'success', text1: 'Partage / téléchargement prêt' });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: e?.message || formatErr(e, 'Téléchargement échoué') });
    } finally {
      setPdfBusy(false);
    }
  };

  const closePdf = () => {
    if (Platform.OS === 'web' && pdfUri?.startsWith('blob:')) {
      try { window.URL.revokeObjectURL(pdfUri); } catch { /* ignore */ }
    }
    setPdfVisible(false);
    setPdfUri(null);
    setPdfBase64(null);
    setPdfEndpoint('');
  };

  const pdfViewerHtml = (b64: string) => `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=3" />
  <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
  <style>
    html,body{margin:0;padding:0;background:#1a1a1a;}
    #wrap{padding:8px;display:flex;flex-direction:column;align-items:center;gap:8px;}
    canvas{max-width:100%;height:auto;box-shadow:0 2px 8px rgba(0,0,0,.4);}
    .err{color:#fff;font-family:sans-serif;padding:24px;text-align:center;}
  </style>
</head>
<body>
  <div id="wrap"><p class="err" id="status">Chargement…</p></div>
  <script>
    (async function(){
      try {
        pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        const raw = atob('${b64}');
        const bytes = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
        const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
        const wrap = document.getElementById('wrap');
        wrap.innerHTML = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 1.35 });
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          wrap.appendChild(canvas);
          await page.render({ canvasContext: ctx, viewport }).promise;
        }
      } catch (e) {
        document.getElementById('status').textContent = 'Aperçu impossible — utilisez Télécharger.';
      }
    })();
  </script>
</body>
</html>`;

  if (user?.role !== 'admin' && user?.role !== 'operator') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Text style={styles.empty}>Accès refusé</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><ChevronLeft size={24} color={colors.text} /></TouchableOpacity>
        <Text style={styles.title}>Factures clients</Text>
        <TouchableOpacity onPress={openCreate}><Plus size={22} color={colors.primary} /></TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: spacing.lg }}
          ListEmptyComponent={<Text style={styles.empty}>Aucune facture</Text>}
          renderItem={({ item }) => {
            const id = item.id || item._id;
            return (
            <View style={styles.card}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{item.invoice_number}</Text>
                <Text style={styles.meta}>{item.customer_name || item.customer_id}</Text>
                <Text style={styles.meta}>
                  {Number(item.total_price || 0).toLocaleString()} XAF · {item.status} · {item.payment_status}
                </Text>
              </View>
              <TouchableOpacity onPress={() => openPdf(item)} style={styles.iconBtn} accessibilityLabel="Voir PDF">
                <Eye size={18} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => {
                  try {
                    await fileService.downloadAndShare(
                      `/invoices/${id}/pdf`,
                      `${item.invoice_number || id}.pdf`,
                    );
                    Toast.show({ type: 'success', text1: 'Téléchargement prêt' });
                  } catch (e: any) {
                    Toast.show({ type: 'error', text1: e?.message || formatErr(e, 'Erreur PDF') });
                  }
                }}
                style={styles.iconBtn}
                accessibilityLabel="Télécharger PDF"
              >
                <Download size={18} color={colors.secondary} />
              </TouchableOpacity>
              {item.status !== 'final' && (
                <TouchableOpacity onPress={() => finalize(id)} style={styles.iconBtn}>
                  <CheckCircle2 size={18} color={colors.success} />
                </TouchableOpacity>
              )}
              {user?.role === 'admin' && (
                <TouchableOpacity onPress={() => remove(id)} style={styles.iconBtn}>
                  <Trash2 size={18} color={colors.danger} />
                </TouchableOpacity>
              )}
            </View>
            );
          }}
        />
      )}

      {/* Create invoice */}
      <Modal visible={show} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalBox} keyboardShouldPersistTaps="handled">
            <Text style={styles.modalTitle}>Nouvelle facture</Text>
            <TextInput
              style={styles.input}
              placeholder="Rechercher un client…"
              placeholderTextColor={colors.textSecondary}
              value={customerQ}
              onChangeText={setCustomerQ}
            />
            {!customerId && filteredCustomers.map((c) => (
              <TouchableOpacity key={c.id} style={styles.custRow} onPress={() => pickCustomer(c)}>
                <Text style={styles.cardTitle}>{c.full_name || c.email}</Text>
                <Text style={styles.meta}>{c.email}</Text>
              </TouchableOpacity>
            ))}
            {!!customerId && (
              <>
                <Text style={styles.meta}>Client : {customerId}</Text>
                <Text style={[styles.meta, { marginVertical: 8 }]}>Sélectionnez les colis</Text>
                {packages.map((p) => {
                  const id = p.id || p._id;
                  const sel = isSelected(id);
                  const line = selectedPkgs[id];
                  const mode = (p.transport_mode || p.mode || 'sea') as string;
                  const isAir = mode === 'air' || mode === 'air_express';
                  const ModeIcon = isAir ? Plane : Ship;
                  return (
                    <View key={id} style={[styles.pkgRow, sel && styles.pkgOn]}>
                      <TouchableOpacity onPress={() => togglePkg(id)} style={{ flex: 1, flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                        <View style={[styles.modeMini, isAir ? styles.badgeAir : styles.badgeSea]}>
                          <ModeIcon size={14} color="#fff" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.cardTitle}>{p.tracking_number}</Text>
                          <Text style={styles.meta}>
                            {isAir ? 'Aérien' : 'Maritime'} · {p.status} · {p.nature || p.description || '—'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                      {sel && line && (
                        <View style={{ width: 120, gap: 4 }}>
                          <TextInput
                            style={styles.miniInput}
                            value={line.qty}
                            keyboardType="decimal-pad"
                            onChangeText={(v) => setSelectedPkgs((s) => ({ ...s, [id]: { ...line, qty: v } }))}
                            placeholder={isAir ? 'kg' : 'CBM'}
                            placeholderTextColor={colors.textSecondary}
                          />
                          <TextInput
                            style={styles.miniInput}
                            value={line.unitPrice}
                            keyboardType="numeric"
                            onChangeText={(v) => setSelectedPkgs((s) => ({ ...s, [id]: { ...line, unitPrice: v } }))}
                            placeholder="Prix u."
                            placeholderTextColor={colors.textSecondary}
                          />
                        </View>
                      )}
                    </View>
                  );
                })}
                {!packages.length && <Text style={styles.meta}>Aucun colis facturable</Text>}
                <TextInput
                  style={styles.input}
                  placeholder="Remise XAF"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numeric"
                  value={discount}
                  onChangeText={setDiscount}
                />
                <Text style={styles.total}>Total : {total.toLocaleString()} XAF</Text>
                <TouchableOpacity style={styles.cta} onPress={createInvoice} disabled={saving}>
                  {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>Créer, finaliser & voir PDF</Text>}
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity onPress={() => setShow(false)} style={{ marginTop: 12 }}>
              <Text style={styles.cancel}>Annuler</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* PDF viewer — rendu PDF.js (Android WebView n'affiche pas les file:// PDF) */}
      <Modal visible={pdfVisible} animationType="slide" onRequestClose={closePdf}>
        <SafeAreaView style={styles.pdfContainer} edges={['top', 'bottom']}>
          <View style={styles.pdfHeader}>
            <TouchableOpacity onPress={closePdf} style={styles.pdfHeaderBtn}>
              <X size={22} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.pdfTitle} numberOfLines={1}>{pdfTitle}</Text>
            <TouchableOpacity onPress={sharePdf} style={styles.pdfHeaderBtn} disabled={pdfBusy || !pdfBase64}>
              <Download size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>
          {pdfBusy || !pdfBase64 ? (
            <View style={styles.pdfLoader}>
              <ActivityIndicator color={colors.primary} size="large" />
              <Text style={styles.meta}>Chargement du PDF…</Text>
            </View>
          ) : Platform.OS === 'web' && pdfUri ? (
            <View style={{ flex: 1 }}>
              {/* @ts-ignore iframe web */}
              <iframe src={pdfUri} style={{ flex: 1, width: '100%', height: '100%', border: 'none' } as any} title={pdfTitle} />
            </View>
          ) : (
            <WebView
              originWhitelist={['*', 'https://*', 'http://*']}
              source={{ html: pdfViewerHtml(pdfBase64) }}
              style={{ flex: 1, backgroundColor: '#1a1a1a' }}
              javaScriptEnabled
              domStorageEnabled
              mixedContentMode="always"
              allowFileAccess
              setSupportMultipleWindows={false}
              startInLoadingState
              renderLoading={() => (
                <View style={styles.pdfLoader}>
                  <ActivityIndicator color={colors.primary} />
                </View>
              )}
            />
          )}
          <TouchableOpacity style={styles.shareBar} onPress={sharePdf} disabled={pdfBusy}>
            {pdfBusy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Download size={18} color="#fff" />
                <Text style={styles.shareBarText}>Télécharger / partager</Text>
              </>
            )}
          </TouchableOpacity>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg },
  title: { fontSize: 18, fontWeight: '800', color: colors.text },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 14, padding: 14, marginBottom: 10, gap: 4 },
  cardTitle: { fontWeight: '800', color: colors.text },
  meta: { marginTop: 4, fontSize: 12, color: colors.textSecondary },
  iconBtn: { padding: 8 },
  empty: { textAlign: 'center', color: colors.textSecondary, marginTop: 40 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40 },
  modalTitle: { fontSize: 18, fontWeight: '900', color: colors.text, marginBottom: 16 },
  input: { backgroundColor: colors.background, borderRadius: radii.input, padding: 12, color: colors.text, marginBottom: 10 },
  custRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  pkgRow: { flexDirection: 'row', gap: 8, padding: 12, borderRadius: 12, backgroundColor: colors.background, marginBottom: 8 },
  pkgOn: { borderWidth: 1, borderColor: colors.primary },
  modeMini: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  badgeAir: { backgroundColor: '#0EA5E9' },
  badgeSea: { backgroundColor: '#0369A1' },
  miniInput: { backgroundColor: colors.card, borderRadius: 8, padding: 8, color: colors.text, fontSize: 12 },
  total: { fontSize: 16, fontWeight: '900', color: colors.text, marginBottom: 12, textAlign: 'right' },
  cta: { backgroundColor: colors.primary, borderRadius: radii.button, paddingVertical: 14, alignItems: 'center' },
  ctaText: { color: '#fff', fontWeight: '800' },
  cancel: { color: colors.textSecondary, textAlign: 'center', fontWeight: '700' },
  pdfContainer: { flex: 1, backgroundColor: colors.background },
  pdfHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  pdfHeaderBtn: { padding: 8 },
  pdfTitle: { flex: 1, textAlign: 'center', fontWeight: '800', color: colors.text, fontSize: 14 },
  pdfLoader: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  shareBar: {
    margin: 16, backgroundColor: colors.primary, borderRadius: radii.button,
    paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  shareBarText: { color: '#fff', fontWeight: '800' },
});
