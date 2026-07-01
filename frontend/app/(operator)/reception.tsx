import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Alert, Image, ActivityIndicator, FlatList } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Scan, Camera, CheckCircle2, Box, Scale, Maximize, Save, Trash2, Search, PlusCircle, User } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Toast from 'react-native-toast-message';
import { colisApi } from '../../src/api/colis';
import { useAuthStore } from '../../src/store/authStore';
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
  const [permission, requestPermission] = useCameraPermissions();

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
          "Non trouvé", 
          "Aucun colis pré-alerté avec ce numéro.",
          [
            { text: "Réessayer", style: "cancel" },
            { text: "Créer une réception d'office", onPress: () => setStep('create') }
          ]
        );
      }
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Erreur", "Recherche impossible");
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

  const onScan = async ({ data }: { data: string }) => {
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
        Alert.alert("Colis inconnu", `Le tracking ${data} n'est pas pré-alerté.`, [
          { text: "Retour", style: "cancel", onPress: () => { setStep('search'); resetScan(); } },
          { text: "Créer maintenant", onPress: () => {
            setTracking(data);
            setStep('create');
            resetScan();
          }}
        ]);
      }
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Erreur', 'Scan échoué', [{ text: 'Réessayer', onPress: resetScan }]);
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
      Alert.alert("Manquant", "Sélectionnez un client et décrivez le colis.");
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
      Toast.show({ type: 'success', text1: 'Colis créé' });
    } catch (e) {
      Alert.alert("Erreur", "Création impossible");
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

  const onSubmit = async (statusVal: 'received' | 'damaged') => {
    if (!colisId) return;
    if (!weight || !dims.l || !dims.w || !dims.h) {
      Alert.alert('Champs requis', 'Poids et dimensions obligatoires.');
      return;
    }
    
    setLoading(true);
    try {
      for (const uri of photos) {
        await colisApi.uploadPhoto(colisId, uri);
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
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Erreur', 'Enregistrement échoué');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('operator.reception_title')}</Text>
        <TouchableOpacity onPress={() => setStep('scan')} style={styles.scanBtn}>
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
                placeholder="N° Tracking ou Shipping Mark"
                placeholderTextColor={colors.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={onSearch}
              />
            </View>
            <TouchableOpacity style={styles.searchBtn} onPress={onSearch}>
              <Text style={styles.searchBtnText}>OK</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Attendus aujourd'hui</Text>
            <TouchableOpacity onPress={fetchPending} disabled={loading}>
              <Text style={{ color: colors.primary, fontWeight: '700' }}>Actualiser</Text>
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
                <Text style={styles.emptyText}>Aucun colis en attente trouvé.</Text>
                <TouchableOpacity style={styles.createGhostBtn} onPress={() => setStep('create')}>
                  <PlusCircle size={20} color={colors.primary} />
                  <Text style={styles.createGhostText}>Création d'office</Text>
                </TouchableOpacity>
              </View>
            }
          />
        </View>
      )}

      {step === 'scan' && (
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <CameraView 
            style={StyleSheet.absoluteFillObject} 
            facing="back"
            onBarcodeScanned={scanned ? undefined : onScan} 
          />
          <View style={[styles.overlay, { zIndex: 10 }]}>
             <TouchableOpacity style={styles.closeOverlay} onPress={() => { setStep('search'); resetScan(); }}>
               <X size={30} color="#fff" />
             </TouchableOpacity>
            <View style={[styles.scanBox, { backgroundColor: 'transparent' }]} />
            <Text style={styles.scanHint}>Alignez le code-barres ou QR code</Text>
          </View>
        </View>
      )}

      {step === 'create' && (
        <ScrollView style={styles.scroll}>
          <Text style={styles.label}>N° Tracking (optionnel)</Text>
          <TextInput style={styles.input} value={tracking} onChangeText={setTracking} placeholder="Shipping Mark fournisseur" placeholderTextColor={colors.textSecondary} />

          <Text style={styles.label}>Client Destinataire</Text>
          <View style={styles.searchField}>
            <Search size={18} color={colors.textSecondary} />
            <TextInput 
              style={styles.searchInput} 
              placeholder="Rechercher un client (Nom ou Email)"
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
               <Text style={styles.selectedUserText}>Client : {selectedUser.full_name}</Text>
               <TouchableOpacity onPress={() => setSelectedUser(null)}><Trash2 size={16} color={colors.danger} /></TouchableOpacity>
             </View>
          )}

          <Text style={styles.label}>Nature des articles</Text>
          <TextInput style={styles.input} value={nature} onChangeText={setNature} placeholder="Vêtements, Pièces auto..." placeholderTextColor={colors.textSecondary} />

          <TouchableOpacity style={styles.primaryBtn} onPress={handleCreate} disabled={loading}>
            <Text style={styles.primaryBtnText}>Créer et Continuer</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {step === 'form' && (
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Colis Identifié</Text>
            <Text style={styles.infoValue}>{tracking}</Text>
          </View>

          <Text style={styles.label}>Audit Nature Marchandise</Text>
          <TextInput style={styles.input} value={nature} onChangeText={setNature} placeholderTextColor={colors.textSecondary} />

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Poids Réel (kg)</Text>
              <View style={styles.inputIcon}>
                <Scale size={18} color={colors.textSecondary} />
                <TextInput style={styles.flexInput} value={weight} onChangeText={setWeight} keyboardType="numeric" placeholder="0.0" placeholderTextColor={colors.textSecondary} />
              </View>
            </View>
          </View>

          <Text style={styles.label}>Dimensions (L x l x H cm)</Text>
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
              <Text style={styles.cbmLabel}>Volume Total (CBM)</Text>
              <Text style={styles.cbmValue}>{cbm.toFixed(3)} m³</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.primaryBtn} onPress={() => setStep('photos')}>
            <Text style={styles.primaryBtnText}>Passer à l'audit Photo</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {step === 'photos' && (
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.sectionTitle}>Audit Visuel (Min. 3)</Text>
          <View style={styles.photoGrid}>
            {photos.map((p, i) => (
              <View key={i} style={styles.photoWrap}>
                <Image source={{ uri: p }} style={styles.photo} />
                <TouchableOpacity style={styles.removePhoto} onPress={() => setPhotos(photos.filter((_, idx) => idx !== i))}>
                  <Trash2 size={16} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
            {photos.length < 5 && (
              <TouchableOpacity style={styles.addPhoto} onPress={takePhoto}>
                <Camera size={32} color={colors.primary} />
                <Text style={styles.addPhotoText}>{photos.length}/3</Text>
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity style={[styles.primaryBtn, photos.length < 3 && styles.disabled]} onPress={() => {
            if (photos.length < 3) return Alert.alert('Audit', '3 photos min');
            onSubmit('received');
          }} disabled={loading || photos.length < 3}>
             {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Terminer la Réception</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.danger, marginTop: spacing.md }, photos.length < 3 && styles.disabled]} onPress={() => {
            if (photos.length < 3) return Alert.alert('Audit', '3 photos min');
            Alert.alert("Anomalie", "Déclarer ce colis comme endommagé ?", [
              { text: "Annuler" },
              { text: "Oui", style: "destructive", onPress: () => onSubmit('damaged') }
            ]);
          }} disabled={loading || photos.length < 3}>
             {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Signaler Colis Endommagé</Text>}
          </TouchableOpacity>
        </ScrollView>
      )}

      {step === 'success' && (
        <View style={styles.center}>
          <CheckCircle2 size={100} color={colors.success} />
          <Text style={styles.successTitle}>Réception OK !</Text>
          <Text style={styles.successDesc}>Le colis est enregistré et prêt pour le groupage.</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace('/(operator)')}>
            <Text style={styles.primaryBtnText}>Terminer</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const X = ({ size, color }: { size: number, color: string }) => <PlusCircle size={size} color={color} style={{ transform: [{ rotate: '45deg' }] }} />;

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
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  closeOverlay: { position: 'absolute', top: 60, right: 30 },
  scanBox: { width: 250, height: 250, borderWidth: 2, borderColor: colors.accent, borderRadius: 20 },
  scanHint: { color: '#fff', marginTop: 20, fontWeight: '700', textAlign: 'center' },
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
