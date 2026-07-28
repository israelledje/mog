import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Alert, Image, ActivityIndicator, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Scan, Camera, CheckCircle2, Box, Scale, Maximize, Save, Trash2, Search, PlusCircle, User } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import NetInfo from '@react-native-community/netinfo';
import Toast from 'react-native-toast-message';
import { colisApi } from '../../src/api/colis';
import { useAuthStore } from '../../src/store/authStore';
import { useSyncStore } from '../../src/store/syncStore';
import QRScanner from '../../src/components/QRScanner';
import { darkColors as colors, radii, spacing, shadow, fonts } from '../../src/constants/theme';

type Step = 'search' | 'scan' | 'form' | 'photos' | 'create' | 'success';

export default function ReceptionScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuthStore();
  const [step, setStep] = useState<Step>('search');
  const [loading, setLoading] = useState(false);
  const [scanned, setScanned] = useState(false);
  const isScanningRef = useRef(false);

  // Search & List
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingColis, setPendingColis] = useState<any[]>([]);
  
  // Create flow
  const [userQuery, setUserQuery] = useState('');
  const [userResults, setUserResults] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);

  // Data for reception
  const [colisId, setColisId] = useState<string | null>(null);
  const [tracking, setTracking] = useState<string>('');
  const [nature, setNature] = useState('');
  const [weight, setWeight] = useState('');
  const [dims, setDims] = useState({ l: '', w: '', h: '' });
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);

  const addToQueue = useSyncStore((s) => s.addToQueue);

  const cbm = (Number(dims.l) * Number(dims.w) * Number(dims.h)) / 1000000 || 0;

  useEffect(() => {
    fetchPending();
  }, []);

  const fetchPending = async () => {
    setLoading(true);
    try {
      const res = await colisApi.list({ status: 'pending_reception' });
      setPendingColis(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const onSearch = async () => {
    if (!searchQuery) return;
    setLoading(true);
    try {
      const res = await colisApi.list({ tracking_number: searchQuery });
      if (res.length > 0) {
        selectColis(res[0]);
      } else {
        Alert.alert(
          t('operator.not_found'),
          t('operator.not_found_msg'),
          [
            { text: t('common.retry'), style: "cancel" },
            { text: t('operator.create_office_reception'), onPress: () => setStep('create') }
          ]
        );
      }
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(t('errors.server'), t('operator.search_impossible'));
    } finally {
      setLoading(false);
    }
  };

  const selectColis = (item: any) => {
    setColisId(item.id);
    setTracking(item.tracking_number);
    setNature(item.description || '');
    setStep('form');
  };

  const resetScan = () => {
    setScanned(false);
    isScanningRef.current = false;
  };

  const onScan = async (data: string) => {
    if (isScanningRef.current || scanned || loading) return;
    isScanningRef.current = true;
    setScanned(true);
    setLoading(true);
    try {
      const results = await colisApi.list({ tracking_number: data });
      if (results.length > 0) {
        selectColis(results[0]);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        // On ne reset pas "scanned" ici car on passe à l'étape "form"
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert(t('operator.unknown_colis'), t('operator.unknown_colis_msg', { tracking: data }), [
          { text: t('common.back'), style: "cancel", onPress: () => { setStep('search'); resetScan(); } },
          { text: t('operator.create_now'), onPress: () => {
            setTracking(data);
            setStep('create');
            resetScan();
          }}
        ]);
      }
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(t('errors.server'), t('operator.scan_failed'), [{ text: t('common.retry'), onPress: resetScan }]);
    } finally {
      setLoading(false);
    }
  };

  const searchClients = async (q: string) => {
    setUserQuery(q);
    if (q.length < 2) return;
    try {
      const res = await colisApi.searchUsers(q);
      setUserResults(res);
    } catch (e) {}
  };

  const handleCreate = async () => {
    if (!selectedUser || !nature) {
      Alert.alert(t('operator.missing'), t('operator.missing_desc'));
      return;
    }
    setLoading(true);
    try {
      const newColis = await colisApi.create({
        owner_id: selectedUser.email,
        description: nature,
        tracking_number: tracking // Optionnel, le back en génère un si vide
      });
      setColisId(newColis.id);
      setTracking(newColis.tracking_number);
      setStep('form');
      Toast.show({ type: 'success', text1: t('operator.colis_created') });
    } catch (e) {
      Alert.alert(t('errors.server'), t('operator.create_impossible'));
    } finally {
      setLoading(false);
    }
  };

  const takePhoto = async () => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.6,
    });

    if (!result.canceled) {
      setPhotos([...photos, result.assets[0].uri]);
    }
  };

  /** Upload des photos en parallèle avec suivi de progression. Renvoie les URIs en échec. */
  const uploadPhotosParallel = async (id: string, uris: string[]): Promise<string[]> => {
    if (uris.length === 0) return [];
    let done = 0;
    setUploadProgress({ done: 0, total: uris.length });
    const results = await Promise.allSettled(
      uris.map(async (uri) => {
        await colisApi.uploadPhoto(id, uri);
        done += 1;
        setUploadProgress({ done, total: uris.length });
      }),
    );
    return uris.filter((_, i) => results[i].status === 'rejected');
  };

  const queueOffline = async (id: string, statusVal: 'received' | 'damaged') => {
    for (const uri of photos) {
      await addToQueue({ type: 'photo', colisId: id, data: { uri } });
    }
    await addToQueue({
      type: 'reception',
      colisId: id,
      data: {
        weight_real: Number(weight),
        dimensions: { l: Number(dims.l), w: Number(dims.w), h: Number(dims.h) },
        nature,
        status: statusVal,
        entrepot_id: user?.active_entrepot_id || undefined,
      },
    });
  };

  const onSubmit = async (statusVal: 'received' | 'damaged') => {
    if (!colisId) return;
    if (!weight || !dims.l || !dims.w || !dims.h) {
      Alert.alert(t('operator.required_fields'), t('operator.weight_dims_required'));
      return;
    }

    setLoading(true);

    // Mode hors-ligne : on met en file d'attente, synchronisé au retour du réseau.
    const net = await NetInfo.fetch();
    if (!net.isConnected) {
      try {
        await queueOffline(colisId, statusVal);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setStep('success');
        Toast.show({ type: 'info', text1: t('operator.saved_offline'), text2: t('operator.saved_offline_desc') });
      } catch {
        Alert.alert(t('errors.server'), t('operator.offline_save_error'));
      } finally {
        setLoading(false);
        setUploadProgress(null);
      }
      return;
    }

    try {
      const failed = await uploadPhotosParallel(colisId, photos);
      // Réessai unique des photos en échec.
      const stillFailed = failed.length > 0 ? await uploadPhotosParallel(colisId, failed) : [];
      // Les photos définitivement en échec sont mises en file pour synchro ultérieure.
      for (const uri of stillFailed) {
        await addToQueue({ type: 'photo', colisId, data: { uri } });
      }

      await colisApi.receive(colisId, {
        weight_real: Number(weight),
        dimensions: { l: Number(dims.l), w: Number(dims.w), h: Number(dims.h) },
        nature,
        status: statusVal,
        entrepot_id: user?.active_entrepot_id || undefined,
      });
      setStep('success');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (stillFailed.length > 0) {
        Toast.show({ type: 'info', text1: t('operator.photos_pending_sync', { count: stillFailed.length }) });
      }
    } catch (e) {
      // Échec réseau pendant l'enregistrement : repli sur la file hors-ligne.
      try {
        await addToQueue({
          type: 'reception',
          colisId,
          data: {
            weight_real: Number(weight),
            dimensions: { l: Number(dims.l), w: Number(dims.w), h: Number(dims.h) },
            nature,
            status: statusVal,
            entrepot_id: user?.active_entrepot_id || undefined,
          },
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        setStep('success');
        Toast.show({ type: 'info', text1: t('operator.queued'), text2: t('operator.queued_desc') });
      } catch {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert(t('errors.server'), t('operator.save_failed'));
      }
    } finally {
      setLoading(false);
      setUploadProgress(null);
    }
  };

  if (step === 'scan') {
    return (
      <QRScanner
        active={!scanned && !loading}
        onScan={onScan}
        onClose={() => { setStep('search'); resetScan(); }}
        hint={t('operator.scan_hint')}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back} accessibilityRole="button" accessibilityLabel={t('common.back')}>
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('operator.reception_title')}</Text>
        <TouchableOpacity onPress={() => setStep('scan')} style={styles.scanBtn} accessibilityRole="button" accessibilityLabel={t('operator.new_reception_desc')}>
          <Scan size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {step === 'search' && (
        <View style={{ flex: 1 }}>
          <View style={styles.searchBarWrap}>
            <View style={styles.searchField}>
              <Search size={18} color={colors.textSecondary} />
              <TextInput 
                style={styles.searchInput} 
                placeholder={t('operator.tracking_or_mark')}
                placeholderTextColor={colors.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={onSearch}
              />
            </View>
            <TouchableOpacity style={styles.searchBtn} onPress={onSearch} accessibilityRole="button" accessibilityLabel="OK">
              <Text style={styles.searchBtnText}>OK</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('operator.expected_today')}</Text>
            <TouchableOpacity onPress={fetchPending} disabled={loading}>
              <Text style={{ color: colors.primary, fontWeight: '700' }}>{t('operator.refresh')}</Text>
            </TouchableOpacity>
          </View>

          {loading && <ActivityIndicator style={{ marginTop: 20 }} color={colors.primary} />}

          <FlatList
            data={pendingColis}
            keyExtractor={item => item.id}
            contentContainerStyle={{ padding: spacing.lg }}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.packageItem} onPress={() => selectColis(item)}>
                <View style={styles.packageIcon}>
                  <Box size={24} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.packageTracking}>{item.tracking_number}</Text>
                  {item.description ? (
                    <Text style={styles.packageDescription} numberOfLines={1}>{item.description}</Text>
                  ) : null}
                  <Text style={styles.packageOwner} numberOfLines={1}>{item.owner_id}</Text>
                </View>
                <ChevronLeft size={20} color={colors.textSecondary} style={{ transform: [{ rotate: '180deg' }] }} />
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyText}>{t('operator.no_pending_found')}</Text>
                <TouchableOpacity style={styles.createGhostBtn} onPress={() => setStep('create')} accessibilityRole="button" accessibilityLabel={t('operator.create_office')}>
                  <PlusCircle size={20} color={colors.primary} />
                  <Text style={styles.createGhostText}>{t('operator.create_office')}</Text>
                </TouchableOpacity>
              </View>
            }
          />
        </View>
      )}

      {step === 'create' && (
        <ScrollView style={styles.scroll}>
          <Text style={styles.label}>{t('operator.tracking_optional')}</Text>
          <TextInput style={styles.input} value={tracking} onChangeText={setTracking} placeholder={t('operator.shipping_mark_supplier')} placeholderTextColor={colors.textSecondary} />

          <Text style={styles.label}>{t('operator.recipient_client')}</Text>
          <View style={styles.searchField}>
            <Search size={18} color={colors.textSecondary} />
            <TextInput 
              style={styles.searchInput} 
              placeholder={t('operator.search_client')}
              placeholderTextColor={colors.textSecondary}
              value={userQuery}
              onChangeText={searchClients}
            />
          </View>

          {userResults.length > 0 && !selectedUser && (
            <View style={styles.resultsList}>
              {userResults.map(u => (
                <TouchableOpacity key={u.id} style={styles.resultItem} onPress={() => { setSelectedUser(u); setUserQuery(u.full_name); setUserResults([]); }}>
                  <User size={16} color={colors.textSecondary} />
                  <Text style={styles.resultText}>{u.full_name} ({u.email})</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {selectedUser && (
             <View style={styles.selectedUser}>
               <Text style={styles.selectedUserText}>{t('operator.client_label')} : {selectedUser.full_name}</Text>
               <TouchableOpacity onPress={() => setSelectedUser(null)} accessibilityRole="button" accessibilityLabel={t('common.cancel')}><Trash2 size={16} color={colors.danger} /></TouchableOpacity>
             </View>
          )}

          <Text style={styles.label}>{t('operator.articles_nature')}</Text>
          <TextInput style={styles.input} value={nature} onChangeText={setNature} placeholder={t('operator.articles_nature_ph')} placeholderTextColor={colors.textSecondary} />

          <TouchableOpacity style={styles.primaryBtn} onPress={handleCreate} disabled={loading}>
            <Text style={styles.primaryBtnText}>{t('operator.create_continue')}</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {step === 'form' && (
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>{t('operator.colis_identified')}</Text>
            <Text style={styles.infoValue}>{tracking}</Text>
          </View>

          <Text style={styles.label}>{t('operator.audit_nature')}</Text>
          <TextInput style={styles.input} value={nature} onChangeText={setNature} placeholderTextColor={colors.textSecondary} />

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>{t('operator.real_weight')}</Text>
              <View style={styles.inputIcon}>
                <Scale size={18} color={colors.textSecondary} />
                <TextInput style={styles.flexInput} value={weight} onChangeText={setWeight} keyboardType="numeric" placeholder="0.0" placeholderTextColor={colors.textSecondary} />
              </View>
            </View>
          </View>

          <Text style={styles.label}>{t('operator.dimensions_lwh')}</Text>
          <View style={styles.row}>
            <TextInput style={styles.dimInput} value={dims.l} onChangeText={l => setDims({...dims, l})} placeholder="L" placeholderTextColor={colors.textSecondary} keyboardType="numeric" />
            <Text style={styles.x}>×</Text>
            <TextInput style={styles.dimInput} value={dims.w} onChangeText={w => setDims({...dims, w})} placeholder="l" placeholderTextColor={colors.textSecondary} keyboardType="numeric" />
            <Text style={styles.x}>×</Text>
            <TextInput style={styles.dimInput} value={dims.h} onChangeText={h => setDims({...dims, h})} placeholder="H" placeholderTextColor={colors.textSecondary} keyboardType="numeric" />
          </View>

          <View style={styles.cbmCard}>
            <Maximize size={20} color={colors.primary} />
            <View>
              <Text style={styles.cbmLabel}>{t('operator.total_volume_cbm')}</Text>
              <Text style={styles.cbmValue}>{cbm.toFixed(3)} m³</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.primaryBtn} onPress={() => setStep('photos')}>
            <Text style={styles.primaryBtnText}>{t('operator.goto_photo_audit')}</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {step === 'photos' && (
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.sectionTitle}>{t('operator.visual_audit')}</Text>
          <View style={styles.photoGrid}>
            {photos.map((p, i) => (
              <View key={i} style={styles.photoWrap}>
                <Image source={{ uri: p }} style={styles.photo} />
                <TouchableOpacity style={styles.removePhoto} onPress={() => setPhotos(photos.filter((_, idx) => idx !== i))} accessibilityRole="button" accessibilityLabel={t('common.cancel')}>
                  <Trash2 size={16} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
            {photos.length < 5 && (
              <TouchableOpacity style={styles.addPhoto} onPress={takePhoto} accessibilityRole="button" accessibilityLabel={t('operator.visual_audit')}>
                <Camera size={32} color={colors.primary} />
                <Text style={styles.addPhotoText}>{photos.length}/3</Text>
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity style={[styles.primaryBtn, photos.length < 3 && styles.disabled]} onPress={() => {
            if (photos.length < 3) return Alert.alert(t('operator.audit'), t('operator.photos_min3'));
            onSubmit('received');
          }} disabled={loading || photos.length < 3}>
             {loading ? (
               <>
                 <ActivityIndicator color="#fff" />
                 {uploadProgress && (
                   <Text style={styles.primaryBtnText}>{t('operator.sending_photos', { done: uploadProgress.done, total: uploadProgress.total })}</Text>
                 )}
               </>
             ) : (
               <Text style={styles.primaryBtnText}>{t('operator.finish_reception')}</Text>
             )}
          </TouchableOpacity>

          <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.danger, marginTop: spacing.md }, photos.length < 3 && styles.disabled]} onPress={() => {
            if (photos.length < 3) return Alert.alert(t('operator.audit'), t('operator.photos_min3'));
            Alert.alert(t('operator.anomaly'), t('operator.declare_damaged'), [
              { text: t('common.cancel') },
              { text: t('common.yes'), style: "destructive", onPress: () => onSubmit('damaged') }
            ]);
          }} disabled={loading || photos.length < 3}>
             {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>{t('operator.report_damaged')}</Text>}
          </TouchableOpacity>
        </ScrollView>
      )}

      {step === 'success' && (
        <View style={styles.center}>
          <CheckCircle2 size={100} color={colors.success} />
          <Text style={styles.successTitle}>{t('operator.reception_ok')}</Text>
          <Text style={styles.successDesc}>{t('operator.reception_ok_desc')}</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace('/(operator)')}>
            <Text style={styles.primaryBtnText}>{t('operator.finish')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border, ...shadow.card },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  back: { padding: 4 },
  scanBtn: { padding: 4 },
  searchBarWrap: { flexDirection: 'row', padding: spacing.lg, gap: 10, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  searchField: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.background, borderRadius: radii.input, paddingHorizontal: 12, height: 48, borderWidth: 1, borderColor: colors.border },
  searchInput: { flex: 1, fontSize: 14, color: colors.text },
  searchBtn: { backgroundColor: colors.primary, paddingHorizontal: 20, borderRadius: radii.button, justifyContent: 'center' },
  searchBtnText: { color: '#fff', fontWeight: '800' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.lg, marginTop: spacing.md, marginBottom: spacing.sm },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  packageItem: { flexDirection: 'row', alignItems: 'center', gap: 15, backgroundColor: colors.card, padding: 15, borderRadius: radii.card, marginBottom: 10, borderWidth: 1, borderColor: colors.border, ...shadow.card },
  packageIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: `${colors.primary}25`, alignItems: 'center', justifyContent: 'center' },
  packageTracking: { fontSize: 15, fontWeight: '800', color: colors.text, fontFamily: fonts.mono },
  packageDescription: { fontSize: 13, fontWeight: '600', color: colors.text, marginTop: 2 },
  packageOwner: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  empty: { alignItems: 'center', marginTop: 100 },
  emptyText: { color: colors.textSecondary, marginBottom: 20 },
  createGhostBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: `${colors.primary}25`, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 20 },
  createGhostText: { color: colors.primary, fontWeight: '700' },
  scroll: { padding: spacing.lg },
  label: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 8, marginTop: spacing.lg },
  input: { backgroundColor: colors.card, borderRadius: radii.input, padding: 14, fontSize: 16, color: colors.text, borderWidth: 1, borderColor: colors.border, ...shadow.card },
  resultsList: { backgroundColor: colors.card, borderRadius: radii.card, marginTop: 4, borderWidth: 1, borderColor: colors.border, ...shadow.card, padding: 8 },
  resultItem: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  resultText: { fontSize: 13, color: colors.text },
  selectedUser: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: `${colors.success}20`, padding: 12, borderRadius: radii.card, marginTop: 10, borderWidth: 1, borderColor: colors.success },
  selectedUserText: { color: colors.success, fontWeight: '700' },
  infoCard: { backgroundColor: colors.card, padding: spacing.lg, borderRadius: radii.card, borderWidth: 1, borderColor: colors.border, ...shadow.card, marginBottom: spacing.md },
  infoLabel: { fontSize: 11, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase' },
  infoValue: { fontSize: 18, fontWeight: '800', color: colors.primary, marginTop: 4, fontFamily: fonts.mono },
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  inputIcon: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.card, borderRadius: radii.input, paddingHorizontal: 14, height: 52, borderWidth: 1, borderColor: colors.border, ...shadow.card },
  flexInput: { flex: 1, fontSize: 16, color: colors.text },
  dimInput: { flex: 1, backgroundColor: colors.card, borderRadius: radii.input, height: 52, textAlign: 'center', fontSize: 16, fontWeight: '700', color: colors.text, borderWidth: 1, borderColor: colors.border, ...shadow.card },
  x: { fontSize: 20, fontWeight: '300', color: colors.textSecondary },
  cbmCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: `${colors.primary}20`, padding: spacing.lg, borderRadius: radii.card, marginTop: spacing.xl, borderWidth: 1, borderColor: `${colors.primary}40` },
  cbmLabel: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  cbmValue: { fontSize: 24, fontWeight: '900', color: colors.primary },
  primaryBtn: { backgroundColor: colors.primary, borderRadius: radii.button, paddingVertical: 16, alignItems: 'center', marginTop: 30, flexDirection: 'row', justifyContent: 'center', gap: 10 },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  disabled: { backgroundColor: colors.border },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  addPhoto: { width: '47%', height: 140, borderRadius: radii.card, backgroundColor: colors.card, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  addPhotoText: { color: colors.primary, fontWeight: '700', marginTop: 8 },
  photoWrap: { width: '47%', height: 140, position: 'relative' },
  photo: { width: '100%', height: '100%', borderRadius: radii.card },
  removePhoto: { position: 'absolute', top: -5, right: -5, backgroundColor: colors.danger, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  successTitle: { fontSize: 26, fontWeight: '900', color: colors.text, marginTop: 20 },
  successDesc: { fontSize: 16, color: colors.textSecondary, textAlign: 'center', marginTop: 10 },
});
