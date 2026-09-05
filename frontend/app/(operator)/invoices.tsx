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
  Receipt, Search, User, Check, Sparkles, Tag, CheckSquare, Square,
  Award, Gift,
} from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { invoicesApi, colisApi } from '../../src/api/colis';
import { adminApi, type AdminUser } from '../../src/api/admin';
import { growthApi } from '../../src/api/growth';
import { fileService } from '../../src/api/files';
import { formatErr } from '../../src/api/client';
import { useAuthStore } from '../../src/store/authStore';
import { darkColors as colors, radii, spacing } from '../../src/constants/theme';
import { airBilledKg, packageCbm } from '../../src/utils/freightBilling';
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
  const [selectedCustomer, setSelectedCustomer] = useState<AdminUser | null>(null);
  const [customerLoyalty, setCustomerLoyalty] = useState<{
    points: number;
    value_xaf: number;
    point_value_xaf: number;
    tier?: any;
  } | null>(null);
  const [packages, setPackages] = useState<any[]>([]);
  const [selectedPkgs, setSelectedPkgs] = useState<Record<string, { qty: string; unitPrice: string; unit: string }>>({});

  // Discounts
  const [promoInput, setPromoInput] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);
  const [appliedPromo, setAppliedPromo] = useState<{
    code: string;
    discount_xaf: number;
    discount_type?: string;
    discount_value?: number;
    label?: string;
  } | null>(null);
  const [pointsUsed, setPointsUsed] = useState('0');
  const [manualDiscount, setManualDiscount] = useState('0');
  const [saving, setSaving] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // PDF Viewer
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
    if (!s) return customers.slice(0, 15);
    return customers.filter((c) =>
      `${c.full_name || ''} ${c.email || ''} ${c.client_code || ''}`.toLowerCase().includes(s),
    ).slice(0, 15);
  }, [customers, customerQ]);

  const openCreate = () => {
    setCustomerId('');
    setCustomerQ('');
    setSelectedCustomer(null);
    setCustomerLoyalty(null);
    setPackages([]);
    setSelectedPkgs({});
    setPromoInput('');
    setAppliedPromo(null);
    setPointsUsed('0');
    setManualDiscount('0');
    setShow(true);
  };

  const pickCustomer = async (c: AdminUser) => {
    setSelectedCustomer(c);
    setCustomerId(c.email);
    setCustomerQ(c.full_name || c.email);
    setPromoInput('');
    setAppliedPromo(null);
    setPointsUsed('0');
    setManualDiscount('0');

    try {
      // Charger le solde de points en direct
      const summary = await invoicesApi.getCustomerSummary(c.email).catch(() => null);
      if (summary?.loyalty) {
        setCustomerLoyalty(summary.loyalty);
      } else {
        setCustomerLoyalty({
          points: c.loyalty_points || 0,
          value_xaf: (c.loyalty_points || 0) * 20,
          point_value_xaf: 20,
        });
      }

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
      if (next[id]) {
        delete next[id];
      } else {
        const pkg = packages.find((p) => String(p.id || p._id) === id);
        if (pkg) {
          const mode = (pkg.transport_mode || pkg.mode || 'sea') as string;
          const isAir = mode === 'air' || mode === 'air_express';
          const qty = isAir ? airBilledKg(pkg) : packageCbm(pkg);
          const cat = pkg.category_key || 'standard';
          const tarif = tarifs.find((t) => t.mode === (isAir ? 'air' : 'sea') && t.category_key === cat)
            || tarifs.find((t) => t.mode === (isAir ? 'air' : 'sea'));
          next[id] = {
            qty: String(qty || 0),
            unitPrice: String(tarif?.price ?? pkg.total_price ?? 0),
            unit: isAir ? 'kg' : 'cbm',
          };
        }
      }
      return { ...next };
    });
  };

  const isSelected = (id: string) => !!selectedPkgs[id];

  const allSelected = useMemo(() => {
    return packages.length > 0 && packages.every((p) => isSelected(String(p.id || p._id)));
  }, [packages, selectedPkgs]);

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedPkgs({});
    } else {
      const next: Record<string, any> = {};
      for (const p of packages) {
        const pid = String(p.id || p._id);
        const mode = (p.transport_mode || p.mode || 'sea') as string;
        const isAir = mode === 'air' || mode === 'air_express';
        const qty = isAir ? airBilledKg(p) : packageCbm(p);
        const cat = p.category_key || 'standard';
        const tarif = tarifs.find((t) => t.mode === (isAir ? 'air' : 'sea') && t.category_key === cat)
          || tarifs.find((t) => t.mode === (isAir ? 'air' : 'sea'));
        next[pid] = {
          qty: String(qty || 0),
          unitPrice: String(tarif?.price ?? p.total_price ?? 0),
          unit: isAir ? 'kg' : 'cbm',
        };
      }
      setSelectedPkgs(next);
    }
  };

  const selectedIds = useMemo(() => Object.keys(selectedPkgs), [selectedPkgs]);

  // Recalcul dynamique immédiat du sous-total brut à partir des saisies réelles
  const subtotal = useMemo(() => {
    let sum = 0;
    for (const id of selectedIds) {
      const line = selectedPkgs[id];
      if (!line) continue;
      const qty = parseFloat(line.qty) || 0;
      const price = parseFloat(line.unitPrice) || 0;
      sum += qty * price;
    }
    return sum;
  }, [selectedPkgs, selectedIds]);

  // Validation Code Promo
  const applyPromoCode = async () => {
    const code = promoInput.trim().toUpperCase();
    if (!code) return;
    if (subtotal <= 0) {
      Toast.show({ type: 'info', text1: 'Sélectionnez au moins un colis pour appliquer un code promo' });
      return;
    }
    setPromoLoading(true);
    try {
      const res = await growthApi.validatePromo(code, subtotal, 'groupage');
      setAppliedPromo({
        code: res.code || code,
        discount_xaf: Number(res.discount_xaf || 0),
        discount_type: res.discount_type,
        discount_value: res.discount_value,
        label: res.label,
      });
      Toast.show({ type: 'success', text1: `Code promo ${code} appliqué avec succès !` });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: e?.message || formatErr(e, 'Code promo invalide') });
    } finally {
      setPromoLoading(false);
    }
  };

  const removePromoCode = () => {
    setAppliedPromo(null);
    setPromoInput('');
  };

  // Remise Promo dynamique (recalculée si le sous-total change)
  const promoDiscount = useMemo(() => {
    if (!appliedPromo) return 0;
    if (appliedPromo.discount_type === 'percent' && appliedPromo.discount_value) {
      return Math.round((subtotal * appliedPromo.discount_value) / 100);
    }
    return appliedPromo.discount_xaf || 0;
  }, [appliedPromo, subtotal]);

  // Points M.O.G CLUB
  const maxPointsPossible = useMemo(() => {
    const availablePts = customerLoyalty?.points || 0;
    const ptVal = customerLoyalty?.point_value_xaf || 20;
    if (ptVal <= 0 || subtotal <= 0) return 0;
    const remainingToPay = Math.max(0, subtotal - promoDiscount);
    const maxPts = Math.floor(remainingToPay / ptVal);
    return Math.max(0, Math.min(availablePts, maxPts));
  }, [customerLoyalty, subtotal, promoDiscount]);

  const pointsDiscount = useMemo(() => {
    const pts = parseInt(pointsUsed, 10) || 0;
    const actualPts = Math.min(pts, maxPointsPossible);
    const ptVal = customerLoyalty?.point_value_xaf || 20;
    return actualPts * ptVal;
  }, [pointsUsed, maxPointsPossible, customerLoyalty]);

  const applyMaxPoints = () => {
    setPointsUsed(String(maxPointsPossible));
  };

  // Remise Totale & Net à Payer
  const manualDiscNum = useMemo(() => parseFloat(manualDiscount) || 0, [manualDiscount]);

  const totalDiscount = useMemo(() => {
    return Math.min(subtotal, promoDiscount + pointsDiscount + manualDiscNum);
  }, [subtotal, promoDiscount, pointsDiscount, manualDiscNum]);

  const total = useMemo(() => {
    return Math.max(0, subtotal - totalDiscount);
  }, [subtotal, totalDiscount]);

  const createInvoice = async () => {
    if (!customerId) {
      Toast.show({ type: 'error', text1: 'Sélectionnez un client' });
      return;
    }
    const lines = selectedIds.map((package_id) => {
      const line = selectedPkgs[package_id];
      const qty = parseFloat(line?.qty || '0') || 0;
      const price = parseFloat(line?.unitPrice || '0') || 0;
      return {
        package_id,
        weight_or_volume: qty,
        manual_unit_price: price,
        calculated_unit_price: price,
        unit: line?.unit || 'kg',
      };
    });
    if (!lines.length) {
      Toast.show({ type: 'error', text1: 'Sélectionnez au moins un colis' });
      return;
    }
    setSaving(true);
    try {
      const pts = Math.min(parseInt(pointsUsed, 10) || 0, maxPointsPossible);
      const inv = await invoicesApi.create({
        customer_id: customerId,
        packages: lines,
        total_price: total,
        discount: totalDiscount,
        promo_code: appliedPromo?.code || null,
        promo_discount: promoDiscount,
        points_used: pts,
        points_discount: pointsDiscount,
        manual_discount: manualDiscNum,
        include_vat: false,
      });
      const invId = inv.id || inv._id;
      await invoicesApi.finalize(invId);
      setShow(false);
      setLoading(true);
      await load();
      Toast.show({ type: 'success', text1: 'Facture créée avec succès' });
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
      Toast.show({ type: 'success', text1: 'Facture finalisée avec succès' });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: formatErr(e, 'Erreur de finalisation') });
    }
  };

  const remove = (id: string) => {
    Alert.alert('Supprimer la facture', 'Êtes-vous sûr de vouloir supprimer définitivement cette facture ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            await invoicesApi.remove(id);
            Toast.show({ type: 'success', text1: 'Facture supprimée avec succès' });
            load();
          } catch (e: any) {
            Toast.show({ type: 'error', text1: formatErr(e, 'Erreur lors de la suppression') });
          }
        },
      },
    ]);
  };

  const invoiceIdOf = (item: any) => item?.id || item?._id;

  const openPdf = async (item: any) => {
    const id = invoiceIdOf(item);
    if (!id) return;
    const title = item.invoice_number || `facture_${id}`;
    const endpoint = `/invoices/${id}/pdf`;
    setPdfTitle(title);
    setPdfEndpoint(endpoint);
    setPdfVisible(true);
    setPdfBusy(true);
    setPdfUri(null);
    setPdfBase64(null);
    try {
      const pdf = await fileService.downloadPdf(endpoint, `${title}.pdf`);
      setPdfBase64(pdf.base64);
      setPdfUri(pdf.uri);
    } catch (e: any) {
      Toast.show({ type: 'error', text1: e?.message || formatErr(e, 'Erreur aperçu PDF') });
      setPdfVisible(false);
    } finally {
      setPdfBusy(false);
    }
  };

  const closePdf = () => {
    if (pdfUri && Platform.OS === 'web') {
      try { URL.revokeObjectURL(pdfUri); } catch {}
    }
    setPdfVisible(false);
    setPdfUri(null);
    setPdfBase64(null);
  };

  const sharePdf = async () => {
    if (!pdfEndpoint) return;
    setPdfBusy(true);
    Toast.show({ type: 'info', text1: 'Préparation du téléchargement...' });
    try {
      await fileService.downloadAndShare(pdfEndpoint, `${pdfTitle || 'facture'}.pdf`);
      Toast.show({ type: 'success', text1: 'Facture téléchargée / partagée' });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: e?.message || formatErr(e, 'Erreur téléchargement') });
    } finally {
      setPdfBusy(false);
    }
  };

  const downloadDirect = async (item: any) => {
    const id = invoiceIdOf(item);
    if (!id) return;
    setDownloadingId(id);
    Toast.show({ type: 'info', text1: 'Téléchargement de la facture en cours...' });
    try {
      await fileService.downloadAndShare(
        `/invoices/${id}/pdf`,
        `${item.invoice_number || id}.pdf`,
      );
      Toast.show({ type: 'success', text1: 'Facture téléchargée avec succès' });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: e?.message || formatErr(e, 'Erreur lors du téléchargement') });
    } finally {
      setDownloadingId(null);
    }
  };

  const pdfViewerHtml = (base64Data: string) => `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=3.0, user-scalable=yes">
        <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { background: #1a1a1a; display: flex; flex-direction: column; align-items: center; padding: 10px 0; }
          canvas { margin-bottom: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.5); max-width: 98%; height: auto !important; border-radius: 4px; }
          #loading { color: #fff; font-family: sans-serif; padding: 40px; font-size: 14px; text-align: center; }
        </style>
      </head>
      <body>
        <div id="loading">Rendu du document PDF en cours…</div>
        <div id="pdf-container"></div>
        <script>
          pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          const raw = atob('${base64Data}');
          const uint8 = new Uint8Array(raw.length);
          for (let i = 0; i < raw.length; i++) uint8[i] = raw.charCodeAt(i);
          pdfjsLib.getDocument({ data: uint8 }).promise.then(async (pdf) => {
            document.getElementById('loading').style.display = 'none';
            const container = document.getElementById('pdf-container');
            for (let num = 1; num <= pdf.numPages; num++) {
              const page = await pdf.getPage(num);
              const viewport = page.getViewport({ scale: 1.5 });
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              canvas.height = viewport.height;
              canvas.width = viewport.width;
              container.appendChild(canvas);
              await page.render({ canvasContext: ctx, viewport: viewport }).promise;
            }
          }).catch(err => {
            document.getElementById('loading').innerText = 'Erreur affichage PDF: ' + err.message;
          });
        </script>
      </body>
    </html>
  `;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><ChevronLeft size={24} color={colors.text} /></TouchableOpacity>
        <Text style={styles.title}>Factures clients</Text>
        <TouchableOpacity onPress={openCreate} style={styles.createBtn}>
          <Plus size={18} color="#fff" />
          <Text style={styles.createBtnText}>Nouvelle</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id || i._id}
          contentContainerStyle={{ padding: spacing.lg }}
          ListEmptyComponent={<Text style={styles.empty}>Aucune facture générée</Text>}
          renderItem={({ item }) => {
            const id = item.id || item._id;
            const isDownloading = downloadingId === id;
            return (
              <View style={styles.card}>
                <View style={styles.cardIconBox}>
                  <Receipt size={22} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{item.invoice_number}</Text>
                  <Text style={styles.meta}>{item.customer_name || item.customer_id}</Text>
                  <Text style={styles.metaPrice}>
                    {Number(item.total_price || 0).toLocaleString()} XAF · <Text style={{ color: item.status === 'final' ? colors.success : '#F59E0B' }}>{item.status === 'final' ? 'Finalisée' : 'Brouillon'}</Text>
                  </Text>
                </View>
                <TouchableOpacity onPress={() => openPdf(item)} style={styles.iconBtn} accessibilityLabel="Voir PDF">
                  <Eye size={18} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => downloadDirect(item)}
                  style={styles.iconBtn}
                  accessibilityLabel="Télécharger PDF"
                  disabled={isDownloading}
                >
                  {isDownloading ? (
                    <ActivityIndicator size="small" color={colors.secondary} />
                  ) : (
                    <Download size={18} color={colors.secondary} />
                  )}
                </TouchableOpacity>
                {item.status !== 'final' && (
                  <TouchableOpacity onPress={() => finalize(id)} style={styles.iconBtn} accessibilityLabel="Finaliser">
                    <CheckCircle2 size={18} color={colors.success} />
                  </TouchableOpacity>
                )}
                {user?.role === 'admin' && (
                  <TouchableOpacity onPress={() => remove(id)} style={styles.iconBtn} accessibilityLabel="Supprimer">
                    <Trash2 size={18} color={colors.danger} />
                  </TouchableOpacity>
                )}
              </View>
            );
          }}
        />
      )}

      {/* Modernized Create Invoice Modal */}
      <Modal visible={show} animationType="slide" transparent onRequestClose={() => setShow(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={styles.modalHeaderIcon}>
                  <Receipt size={20} color={colors.primary} />
                </View>
                <View>
                  <Text style={styles.modalTitle}>Nouvelle Facture</Text>
                  <Text style={styles.modalSubtitle}>Émission & facturation directe</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setShow(false)} style={styles.modalCloseBtn}>
                <X size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {/* Step 1: Customer selection */}
              {!customerId ? (
                <View style={styles.sectionBox}>
                  <Text style={styles.sectionHeading}>1. Sélectionner le client</Text>
                  <View style={styles.searchBar}>
                    <Search size={16} color={colors.textSecondary} />
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Nom, email ou code MOG..."
                      placeholderTextColor={colors.textSecondary}
                      value={customerQ}
                      onChangeText={setCustomerQ}
                      autoFocus
                    />
                  </View>
                  <View style={{ marginTop: 8, gap: 6 }}>
                    {filteredCustomers.map((c) => (
                      <TouchableOpacity key={c.id} style={styles.custCard} onPress={() => pickCustomer(c)}>
                        <View style={styles.custAvatar}>
                          <User size={16} color={colors.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={styles.custName}>{c.full_name || 'Client sans nom'}</Text>
                            {!!c.client_code && (
                              <View style={styles.clientCodeBadge}>
                                <Text style={styles.clientCodeText}>{c.client_code}</Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.custEmail}>{c.email}</Text>
                        </View>
                        {!!c.loyalty_points && (
                          <View style={styles.pointsPillSmall}>
                            <Award size={12} color="#F59E0B" />
                            <Text style={styles.pointsPillSmallText}>{c.loyalty_points} pts</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    ))}
                    {filteredCustomers.length === 0 && (
                      <Text style={styles.noDataText}>Aucun client trouvé pour cette recherche</Text>
                    )}
                  </View>
                </View>
              ) : (
                <>
                  {/* Selected Customer banner */}
                  <View style={styles.clientCardSelected}>
                    <View style={styles.custAvatarActive}>
                      <User size={18} color="#fff" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.clientSelectedName}>
                          {selectedCustomer?.full_name || customerId}
                        </Text>
                        {!!selectedCustomer?.client_code && (
                          <View style={styles.clientCodeBadgeActive}>
                            <Text style={styles.clientCodeTextActive}>{selectedCustomer.client_code}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.clientSelectedEmail}>{customerId}</Text>
                      {/* Loyalty Balance Tag */}
                      <View style={styles.loyaltyTagRow}>
                        <Award size={13} color={colors.primary} />
                        <Text style={styles.loyaltyTagText}>
                          M.O.G CLUB : <Text style={{ fontWeight: '800', color: colors.text }}>{customerLoyalty?.points ?? selectedCustomer?.loyalty_points ?? 0} pts</Text> (≈ {((customerLoyalty?.points ?? selectedCustomer?.loyalty_points ?? 0) * (customerLoyalty?.point_value_xaf || 20)).toLocaleString()} XAF)
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      onPress={() => {
                        setCustomerId('');
                        setSelectedCustomer(null);
                        setCustomerLoyalty(null);
                        setPackages([]);
                        setSelectedPkgs({});
                        setAppliedPromo(null);
                        setPointsUsed('0');
                        setManualDiscount('0');
                      }}
                      style={styles.changeCustBtn}
                    >
                      <Text style={styles.changeCustText}>Changer</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Step 2: Billable packages */}
                  <View style={styles.sectionBox}>
                    <View style={styles.sectionHeaderRow}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.sectionHeading}>2. Colis à facturer</Text>
                        <View style={styles.countBadge}>
                          <Text style={styles.countBadgeText}>{selectedIds.length}/{packages.length}</Text>
                        </View>
                      </View>
                      {packages.length > 0 && (
                        <TouchableOpacity onPress={toggleSelectAll} style={styles.selectAllBtn}>
                          {allSelected ? (
                            <CheckSquare size={16} color={colors.primary} />
                          ) : (
                            <Square size={16} color={colors.textSecondary} />
                          )}
                          <Text style={[styles.selectAllText, allSelected && { color: colors.primary }]}>
                            {allSelected ? 'Tout décocher' : 'Tout cocher'}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {packages.length === 0 ? (
                      <View style={styles.emptyPkgBox}>
                        <Text style={styles.noDataText}>Aucun colis en attente de facturation pour ce client.</Text>
                      </View>
                    ) : (
                      packages.map((p) => {
                        const id = String(p.id || p._id);
                        const sel = isSelected(id);
                        const line = selectedPkgs[id];
                        const mode = (p.transport_mode || p.mode || 'sea') as string;
                        const isAir = mode === 'air' || mode === 'air_express';
                        const ModeIcon = isAir ? Plane : Ship;
                        const qtyVal = parseFloat(line?.qty || '0') || 0;
                        const unitPriceVal = parseFloat(line?.unitPrice || '0') || 0;
                        const rowTotal = qtyVal * unitPriceVal;

                        return (
                          <View key={id} style={[styles.pkgCard, sel && styles.pkgCardSelected]}>
                            <TouchableOpacity onPress={() => togglePkg(id)} style={styles.pkgCardHeader}>
                              <View style={[styles.checkboxBox, sel && styles.checkboxBoxActive]}>
                                {sel && <Check size={12} color="#fff" strokeWidth={3} />}
                              </View>
                              <View style={[styles.modeMini, isAir ? styles.badgeAir : styles.badgeSea]}>
                                <ModeIcon size={13} color="#fff" />
                              </View>
                              <View style={{ flex: 1 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                  <Text style={styles.pkgTracking}>{p.tracking_number || id}</Text>
                                  <Text style={styles.pkgModeText}>{isAir ? 'Aérien' : 'Maritime'}</Text>
                                </View>
                                <Text style={styles.pkgDesc} numberOfLines={1}>
                                  {p.nature || p.description || 'Colis standard'} {p.weight ? `· ${p.weight} kg` : ''}
                                </Text>
                              </View>
                              {sel && (
                                <View style={styles.rowTotalPill}>
                                  <Text style={styles.rowTotalText}>{rowTotal.toLocaleString()} XAF</Text>
                                </View>
                              )}
                            </TouchableOpacity>

                            {sel && line && (
                              <View style={styles.pkgPricingRow}>
                                <View style={styles.priceCol}>
                                  <Text style={styles.inputMiniLabel}>Quantité ({isAir ? 'kg' : 'CBM'})</Text>
                                  <TextInput
                                    style={styles.inputMini}
                                    value={line.qty}
                                    keyboardType="decimal-pad"
                                    onChangeText={(v) => setSelectedPkgs((s) => ({ ...s, [id]: { ...line, qty: v } }))}
                                    placeholder={isAir ? 'Poids kg' : 'Volume CBM'}
                                    placeholderTextColor={colors.textSecondary}
                                  />
                                </View>
                                <View style={styles.priceCol}>
                                  <Text style={styles.inputMiniLabel}>Prix unitaire (XAF)</Text>
                                  <TextInput
                                    style={styles.inputMini}
                                    value={line.unitPrice}
                                    keyboardType="numeric"
                                    onChangeText={(v) => setSelectedPkgs((s) => ({ ...s, [id]: { ...line, unitPrice: v } }))}
                                    placeholder="Prix unit."
                                    placeholderTextColor={colors.textSecondary}
                                  />
                                </View>
                              </View>
                            )}
                          </View>
                        );
                      })
                    )}
                  </View>

                  {/* Step 3: Discounts & Loyalty Points */}
                  {packages.length > 0 && selectedIds.length > 0 && (
                    <View style={styles.sectionBox}>
                      <Text style={styles.sectionHeading}>3. Réductions & Avantages</Text>

                      {/* Loyalty Points Section */}
                      <View style={styles.discountCardBox}>
                        <View style={styles.discountCardHeader}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Award size={16} color={colors.primary} />
                            <Text style={styles.discountCardTitle}>Points Fidélité M.O.G CLUB</Text>
                          </View>
                          <Text style={styles.pointsAvailText}>
                            {customerLoyalty?.points ?? 0} pts dispo
                          </Text>
                        </View>

                        <View style={styles.pointsActionRow}>
                          <View style={styles.pointsInputWrap}>
                            <TextInput
                              style={styles.pointsInput}
                              keyboardType="numeric"
                              value={pointsUsed}
                              onChangeText={setPointsUsed}
                              placeholder="0"
                              placeholderTextColor={colors.textSecondary}
                            />
                            <Text style={styles.pointsInputSuffix}>pts</Text>
                          </View>

                          <TouchableOpacity
                            style={[styles.pointsMaxBtn, maxPointsPossible === 0 && { opacity: 0.5 }]}
                            onPress={applyMaxPoints}
                            disabled={maxPointsPossible === 0}
                          >
                            <Text style={styles.pointsMaxBtnText}>Utiliser le max ({maxPointsPossible} pts)</Text>
                          </TouchableOpacity>
                        </View>

                        {pointsDiscount > 0 && (
                          <View style={styles.discountSuccessBadge}>
                            <Check size={12} color="#10B981" strokeWidth={3} />
                            <Text style={styles.discountSuccessText}>
                              - {pointsDiscount.toLocaleString()} XAF ({pointsUsed} pts appliqués)
                            </Text>
                          </View>
                        )}
                      </View>

                      {/* Promo Code Section */}
                      <View style={styles.discountCardBox}>
                        <View style={styles.discountCardHeader}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Gift size={16} color={colors.secondary} />
                            <Text style={styles.discountCardTitle}>Code Promo</Text>
                          </View>
                        </View>

                        {!appliedPromo ? (
                          <View style={styles.promoInputRow}>
                            <TextInput
                              style={styles.promoInput}
                              placeholder="Entrer un code promo (ex: MOGPROMO)"
                              placeholderTextColor={colors.textSecondary}
                              value={promoInput}
                              onChangeText={setPromoInput}
                              autoCapitalize="characters"
                            />
                            <TouchableOpacity
                              style={[styles.promoApplyBtn, (!promoInput.trim() || promoLoading) && { opacity: 0.5 }]}
                              onPress={applyPromoCode}
                              disabled={!promoInput.trim() || promoLoading}
                            >
                              {promoLoading ? (
                                <ActivityIndicator size="small" color="#fff" />
                              ) : (
                                <Text style={styles.promoApplyText}>Appliquer</Text>
                              )}
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <View style={styles.appliedPromoBadge}>
                            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                              <Tag size={15} color="#10B981" />
                              <View>
                                <Text style={styles.appliedPromoCodeText}>{appliedPromo.code}</Text>
                                <Text style={styles.appliedPromoDetail}>
                                  {appliedPromo.label || 'Réduction active'} · -{promoDiscount.toLocaleString()} XAF
                                </Text>
                              </View>
                            </View>
                            <TouchableOpacity onPress={removePromoCode} style={styles.removePromoBtn}>
                              <X size={14} color={colors.danger} />
                              <Text style={styles.removePromoText}>Retirer</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>

                      {/* Manual Commercial Discount */}
                      <View style={styles.discountCardBox}>
                        <View style={styles.discountCardHeader}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Tag size={16} color={colors.textSecondary} />
                            <Text style={styles.discountCardTitle}>Remise Commerciale Directe</Text>
                          </View>
                          <View style={styles.manualDiscountWrap}>
                            <TextInput
                              style={styles.manualDiscountInput}
                              placeholder="0"
                              placeholderTextColor={colors.textSecondary}
                              keyboardType="numeric"
                              value={manualDiscount}
                              onChangeText={setManualDiscount}
                            />
                            <Text style={styles.manualDiscountSuffix}>XAF</Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  )}

                  {/* Step 4: Financial Summary Breakdown */}
                  {packages.length > 0 && selectedIds.length > 0 && (
                    <View style={styles.summaryCard}>
                      <Text style={styles.summaryTitle}>Récapitulatif Financier</Text>

                      <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Sous-total brut ({selectedIds.length} colis)</Text>
                        <Text style={styles.summaryValue}>{subtotal.toLocaleString()} XAF</Text>
                      </View>

                      {promoDiscount > 0 && (
                        <View style={styles.summaryRowDiscount}>
                          <Text style={styles.summaryLabelDiscount}>Code Promo ({appliedPromo?.code})</Text>
                          <Text style={styles.summaryValueDiscount}>- {promoDiscount.toLocaleString()} XAF</Text>
                        </View>
                      )}

                      {pointsDiscount > 0 && (
                        <View style={styles.summaryRowDiscount}>
                          <Text style={styles.summaryLabelDiscount}>Points M.O.G CLUB ({pointsUsed} pts)</Text>
                          <Text style={styles.summaryValueDiscount}>- {pointsDiscount.toLocaleString()} XAF</Text>
                        </View>
                      )}

                      {manualDiscNum > 0 && (
                        <View style={styles.summaryRowDiscount}>
                          <Text style={styles.summaryLabelDiscount}>Remise commerciale directe</Text>
                          <Text style={styles.summaryValueDiscount}>- {manualDiscNum.toLocaleString()} XAF</Text>
                        </View>
                      )}

                      {totalDiscount > 0 && (
                        <View style={styles.totalDiscountRow}>
                          <Text style={styles.totalDiscountLabel}>Total des réductions</Text>
                          <Text style={styles.totalDiscountValue}>- {totalDiscount.toLocaleString()} XAF</Text>
                        </View>
                      )}

                      <View style={styles.summaryDivider} />

                      <View style={styles.grandTotalRow}>
                        <View>
                          <Text style={styles.grandTotalLabel}>Net à payer</Text>
                          <Text style={styles.grandTotalSub}>TVA comprise (0%)</Text>
                        </View>
                        <Text style={styles.grandTotalValue}>{total.toLocaleString()} XAF</Text>
                      </View>
                    </View>
                  )}

                  {/* Primary CTA */}
                  <TouchableOpacity
                    style={[styles.primaryCta, (!selectedIds.length || saving) && styles.primaryCtaDisabled]}
                    onPress={createInvoice}
                    disabled={!selectedIds.length || saving}
                  >
                    {saving ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <Sparkles size={18} color="#fff" />
                        <Text style={styles.primaryCtaText}>Générer, finaliser & voir PDF</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* PDF Viewer */}
      <Modal visible={pdfVisible} animationType="slide" onRequestClose={closePdf}>
        <SafeAreaView style={styles.pdfContainer} edges={['top', 'bottom']}>
          <View style={styles.pdfHeader}>
            <TouchableOpacity onPress={closePdf} style={styles.iconBtn}>
              <X size={22} color={colors.text} />
            </TouchableOpacity>
            <Text style={{ fontWeight: '800', color: colors.text }}>{pdfTitle}</Text>
            <TouchableOpacity onPress={sharePdf} style={styles.iconBtn}>
              <Download size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>
          {pdfBusy || !pdfBase64 ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator color={colors.primary} size="large" />
            </View>
          ) : Platform.OS === 'web' ? (
            <iframe src={pdfUri || ''} style={{ flex: 1, width: '100%', border: 'none' }} title="PDF" />
          ) : (
            <WebView
              source={{ html: pdfViewerHtml(pdfBase64) }}
              style={{ flex: 1, backgroundColor: '#1a1a1a' }}
              javaScriptEnabled
              domStorageEnabled
            />
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg },
  title: { fontSize: 18, fontWeight: '800', color: colors.text },
  createBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.primary, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  createBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.card, borderRadius: 14,
    padding: 14, marginBottom: 10, gap: 10,
    borderWidth: 1, borderColor: colors.border,
  },
  cardIconBox: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: 'rgba(217, 119, 6, 0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  cardTitle: { fontWeight: '800', color: colors.text, fontSize: 14 },
  meta: { marginTop: 2, fontSize: 12, color: colors.textSecondary },
  metaPrice: { marginTop: 4, fontSize: 13, fontWeight: '700', color: colors.text },
  iconBtn: { padding: 8 },
  empty: { textAlign: 'center', color: colors.textSecondary, marginTop: 40 },

  // Modal styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    maxHeight: '92%',
    borderWidth: 1, borderColor: colors.border,
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 18, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  modalHeaderIcon: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: 'rgba(217, 119, 6, 0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  modalTitle: { fontSize: 17, fontWeight: '900', color: colors.text },
  modalSubtitle: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  modalCloseBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.background,
    alignItems: 'center', justifyContent: 'center',
  },
  modalBody: { padding: 18, paddingBottom: 36, gap: 16 },

  // Step 1: Customer selector
  sectionBox: { gap: 10 },
  sectionHeading: { fontSize: 14, fontWeight: '800', color: colors.text },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.background, borderRadius: radii.input,
    paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: colors.border,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 13, padding: 0 },
  custCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.background, borderRadius: 12,
    padding: 12, borderWidth: 1, borderColor: colors.border,
  },
  custAvatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(217, 119, 6, 0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  custName: { fontSize: 13, fontWeight: '800', color: colors.text },
  custEmail: { fontSize: 11, color: colors.textSecondary, marginTop: 1 },
  clientCodeBadge: {
    backgroundColor: 'rgba(217, 119, 6, 0.18)',
    borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
  },
  clientCodeText: { color: colors.primary, fontSize: 10, fontWeight: '800' },
  pointsPillSmall: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
  },
  pointsPillSmallText: { fontSize: 11, fontWeight: '800', color: '#F59E0B' },
  noDataText: { fontSize: 12, color: colors.textSecondary, textAlign: 'center', paddingVertical: 12 },

  // Selected customer banner
  clientCardSelected: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: 'rgba(217, 119, 6, 0.08)',
    borderRadius: 14, padding: 12,
    borderWidth: 1.5, borderColor: colors.primary,
  },
  custAvatarActive: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  clientSelectedName: { fontSize: 14, fontWeight: '800', color: colors.text },
  clientSelectedEmail: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  clientCodeBadgeActive: {
    backgroundColor: colors.primary,
    borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
  },
  clientCodeTextActive: { color: '#fff', fontSize: 10, fontWeight: '800' },
  loyaltyTagRow: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    marginTop: 6, backgroundColor: 'rgba(217, 119, 6, 0.12)',
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  loyaltyTagText: { fontSize: 11, color: colors.primary },
  changeCustBtn: {
    backgroundColor: colors.card,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: colors.border,
  },
  changeCustText: { fontSize: 11, fontWeight: '700', color: colors.primary },

  // Step 2: Billable packages
  countBadge: {
    backgroundColor: 'rgba(217, 119, 6, 0.15)',
    borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2,
  },
  countBadgeText: { fontSize: 11, fontWeight: '800', color: colors.primary },
  selectAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  selectAllText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  emptyPkgBox: {
    backgroundColor: colors.background, borderRadius: 12,
    padding: 16, alignItems: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  pkgCard: {
    backgroundColor: colors.background, borderRadius: 14,
    padding: 12, borderWidth: 1, borderColor: colors.border,
    marginBottom: 8,
  },
  pkgCardSelected: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(217, 119, 6, 0.04)',
  },
  pkgCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkboxBox: {
    width: 20, height: 20, borderRadius: 6,
    borderWidth: 1.5, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxBoxActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  modeMini: { width: 26, height: 26, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  badgeAir: { backgroundColor: '#0EA5E9' },
  badgeSea: { backgroundColor: '#0369A1' },
  pkgTracking: { fontSize: 13, fontWeight: '800', color: colors.text },
  pkgModeText: { fontSize: 11, color: colors.textSecondary },
  pkgDesc: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  rowTotalPill: {
    backgroundColor: 'rgba(217, 119, 6, 0.15)',
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
  },
  rowTotalText: { fontSize: 11, fontWeight: '800', color: colors.primary },
  pkgPricingRow: {
    flexDirection: 'row', gap: 10, marginTop: 10, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  priceCol: { flex: 1, gap: 4 },
  inputMiniLabel: { fontSize: 10, fontWeight: '700', color: colors.textSecondary },
  inputMini: {
    backgroundColor: colors.card, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6,
    color: colors.text, fontSize: 12, fontWeight: '700',
    borderWidth: 1, borderColor: colors.border,
  },

  // Step 3: Discounts cards
  discountCardBox: {
    backgroundColor: colors.background, borderRadius: 14,
    padding: 12, borderWidth: 1, borderColor: colors.border,
    gap: 8,
  },
  discountCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  discountCardTitle: { fontSize: 13, fontWeight: '800', color: colors.text },
  pointsAvailText: { fontSize: 11, fontWeight: '700', color: colors.primary },
  pointsActionRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pointsInputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.card, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: colors.border, width: 90,
  },
  pointsInput: { color: colors.text, fontSize: 13, fontWeight: '800', flex: 1, padding: 0 },
  pointsInputSuffix: { fontSize: 11, color: colors.textSecondary, fontWeight: '700' },
  pointsMaxBtn: {
    flex: 1, backgroundColor: 'rgba(217, 119, 6, 0.15)',
    borderRadius: 8, paddingVertical: 8, paddingHorizontal: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  pointsMaxBtnText: { color: colors.primary, fontSize: 11, fontWeight: '800' },
  discountSuccessBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  discountSuccessText: { color: '#10B981', fontSize: 11, fontWeight: '800' },

  // Promo code
  promoInputRow: { flexDirection: 'row', gap: 8 },
  promoInput: {
    flex: 1, backgroundColor: colors.card, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 8,
    color: colors.text, fontSize: 12, fontWeight: '700',
    borderWidth: 1, borderColor: colors.border,
  },
  promoApplyBtn: {
    backgroundColor: colors.secondary, borderRadius: 8,
    paddingHorizontal: 14, justifyContent: 'center', alignItems: 'center',
  },
  promoApplyText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  appliedPromoBadge: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#10B981',
  },
  appliedPromoCodeText: { fontSize: 13, fontWeight: '900', color: '#10B981' },
  appliedPromoDetail: { fontSize: 11, color: colors.textSecondary, marginTop: 1 },
  removePromoBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 4 },
  removePromoText: { fontSize: 11, color: colors.danger, fontWeight: '700' },

  // Manual discount
  manualDiscountWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.card, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: colors.border,
  },
  manualDiscountInput: { color: colors.danger, fontSize: 13, fontWeight: '800', minWidth: 60, textAlign: 'right', padding: 0 },
  manualDiscountSuffix: { fontSize: 11, color: colors.textSecondary, fontWeight: '700' },

  // Financial summary
  summaryCard: {
    backgroundColor: colors.background, borderRadius: 16,
    padding: 14, borderWidth: 1, borderColor: colors.border,
    gap: 10,
  },
  summaryTitle: { fontSize: 12, fontWeight: '800', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { fontSize: 13, color: colors.textSecondary },
  summaryValue: { fontSize: 13, fontWeight: '800', color: colors.text },
  summaryRowDiscount: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabelDiscount: { fontSize: 12, color: '#10B981', fontWeight: '700' },
  summaryValueDiscount: { fontSize: 12, fontWeight: '800', color: '#10B981' },
  totalDiscountRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.08)', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  totalDiscountLabel: { fontSize: 12, fontWeight: '800', color: '#10B981' },
  totalDiscountValue: { fontSize: 12, fontWeight: '900', color: '#10B981' },
  summaryDivider: { height: 1, backgroundColor: colors.border, marginVertical: 2 },
  grandTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  grandTotalLabel: { fontSize: 15, fontWeight: '900', color: colors.text },
  grandTotalSub: { fontSize: 10, color: colors.textSecondary, marginTop: 1 },
  grandTotalValue: { fontSize: 19, fontWeight: '900', color: colors.primary },

  // CTAs
  primaryCta: {
    backgroundColor: colors.primary, borderRadius: radii.button,
    paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 4,
  },
  primaryCtaDisabled: { opacity: 0.5 },
  primaryCtaText: { color: '#fff', fontWeight: '800', fontSize: 14 },

  // PDF Viewer styles
  pdfContainer: { flex: 1, backgroundColor: colors.background },
  pdfHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
});
