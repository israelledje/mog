import React, { useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, Dimensions, Image, Linking, ImageBackground } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Bell, Package, Plus, Plane, Ship, MoreHorizontal, ArrowRight, MessageCircle, Cpu, ShoppingBag } from 'lucide-react-native';
import { FontAwesome } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import SkeletonCard from '../../src/components/SkeletonCard';
import StatusBadge from '../../src/components/StatusBadge';
import { useAuthStore } from '../../src/store/authStore';
import { useColisStore } from '../../src/store/colisStore';
import { useSettingsStore } from '../../src/store/settingsStore';
import { buildWhatsAppUrl, formatSupportPhoneDisplay, getSupportPhoneDigits } from '../../src/utils/support';
import { getActiveShipments } from '../../src/utils/logistics';
import HomeTopPanels from '../../src/components/home/HomeTopPanels';
import HomeBottomPanels from '../../src/components/home/HomeBottomPanels';
import HomeServicesMenu from '../../src/components/home/HomeServicesMenu';
import { colors, fonts, shadow, spacing, radii } from '../../src/constants/theme';
import { resolveMediaUrl } from '../../src/utils/mediaUrl';
import type { Colis } from '../../src/types';

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { colis, groupages, kpi, fetchAll, loading, unreadCount } = useColisStore();
  const { settings, fetchSettings } = useSettingsStore();
  const [refreshing, setRefreshing] = React.useState(false);

  useEffect(() => { 
    fetchAll(); 
    fetchSettings();
  }, [fetchAll, fetchSettings]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchAll(), fetchSettings()]);
    setRefreshing(false);
  }, [fetchAll, fetchSettings]);

  const activeShipments = getActiveShipments(colis, groupages).slice(0, 5);
  const unread = unreadCount();
  const supportPhoneDigits = getSupportPhoneDigits(settings);
  const supportPhoneDisplay = formatSupportPhoneDisplay(supportPhoneDigits);

  const onShip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/colis/nouveau');
  };

  const onWhatsAppPay = () => {
    const msg = t('home.whatsapp_message');
    Linking.openURL(buildWhatsAppUrl(supportPhoneDigits, msg)).catch(() => {
      alert(t('home.whatsapp_install_required'));
    });
  };

  return (
    <LinearGradient
      colors={['#F0F5FF', '#F8FAFC', '#F1F5F9', '#EFF6FF']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
      testID="home-screen"
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFFFFF" />}
        showsVerticalScrollIndicator={false}
      >
        {/* HERO CURVED HEADER AVEC IMAGE home.jpg ET OVERLAY ELEGANTE */}
        <View style={styles.heroCurveContainer}>
          <ImageBackground
            source={require('../../assets/images/home.jpg')}
            style={styles.heroHeaderBg}
            resizeMode="cover"
          >
            <LinearGradient
              colors={['rgba(15, 23, 42, 0.94)', 'rgba(30, 58, 138, 0.88)', 'rgba(15, 23, 42, 0.96)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0.8, y: 1 }}
              style={styles.heroGradientOverlay}
            >
              <SafeAreaView edges={['top']} style={styles.heroSafeArea}>
                {/* HEADER ROW (AVATAR + BONJOUR + NOTIFICATIONS) */}
                <View style={styles.headerRow}>
                  <TouchableOpacity
                    style={styles.avatarWrap}
                    activeOpacity={0.85}
                    onPress={() => router.push('/(tabs)/profil')}
                    accessibilityRole="button"
                    accessibilityLabel={t('tabs.profile', { defaultValue: 'Profil' })}
                  >
                    {user?.avatar_url ? (
                      <Image
                        source={{ uri: resolveMediaUrl(user.avatar_url) }}
                        style={styles.avatarImage}
                      />
                    ) : (
                      <Text style={styles.avatarText}>{user?.full_name?.charAt(0)?.toUpperCase() || 'C'}</Text>
                    )}
                  </TouchableOpacity>
                  <View style={styles.headerTextWrap}>
                    <Text style={styles.greeting}>{t('home.greeting')} 👋</Text>
                    <Text style={styles.userName} numberOfLines={1}>{user?.full_name || t('home.client_fallback')}</Text>
                  </View>
                  <TouchableOpacity style={styles.bellWrap} onPress={() => router.push('/notifications')}>
                    <Bell size={22} color="#FFFFFF" strokeWidth={2.2} />
                    {unread > 0 && <View style={styles.badge} />}
                  </TouchableOpacity>
                </View>

                {/* INFOS D'EXPEDITION & KPIS INCLUS DANS LE HEADER ARRONDI */}
                <HomeTopPanels
                  user={user}
                  colis={colis}
                  kpi={kpi}
                />
              </SafeAreaView>
            </LinearGradient>
          </ImageBackground>
        </View>

        {/* CONTENU PRINCIPAL DU DASHBOARD */}
        <View style={styles.mainBodyWrap}>
          {/* MAIN HERO CARD (NOUVELLE EXPEDITION) */}
          <TouchableOpacity activeOpacity={0.95} onPress={onShip}>
            <LinearGradient
              colors={['#2563EB', '#1D4ED8']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={[styles.heroCard, { overflow: 'hidden' }]}
            >
              {/* BACKGROUND WATERMARK IMAGE */}
              <Image 
                source={require('../../assets/images/package_card_bg.png')}
                style={{ position: 'absolute', right: -50, bottom: -50, width: 300, height: 300, opacity: 0.25 }}
                resizeMode="cover"
              />

              <TouchableOpacity style={styles.heroMoreBtn}>
                <MoreHorizontal size={20} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>

              <View style={styles.heroContent}>
                <View style={styles.heroLeft}>
                  <Text style={styles.heroTitle}>{t('home.hero_title')}</Text>
                  <TouchableOpacity style={styles.heroBtn} onPress={onShip}>
                    <Text style={styles.heroBtnText}>{t('package.new_package')}</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.heroRight}>
                  {/* Simulated Circular Progress */}
                  <View style={styles.circleOuter}>
                    <View style={styles.circleInner}>
                      <Text style={styles.circleText}>{kpi.warehouse}</Text>
                      <Text style={styles.circleSub}>{t('home.in_stock')}</Text>
                    </View>
                  </View>
                </View>
              </View>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.marketBanner}
            activeOpacity={0.92}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/(tabs)/marketplace');
            }}
          >
            <ImageBackground
              source={require('../../assets/images/stylish-black-woman-car-salon.jpg')}
              style={styles.marketBannerBg}
              imageStyle={styles.marketBannerImg}
            >
              <LinearGradient
                colors={['rgba(15,23,42,0.35)', 'rgba(15,23,42,0.82)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.marketBannerOverlay}
              >
                <View style={styles.marketIcon}>
                  <ShoppingBag size={20} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.marketTitle}>{t('home.marketplace_banner_title')}</Text>
                  <Text style={styles.marketSub}>{t('home.marketplace_banner_sub')}</Text>
                </View>
                <ArrowRight size={18} color="#fff" />
              </LinearGradient>
            </ImageBackground>
          </TouchableOpacity>

          {/* IN PROGRESS SECTION (HORIZONTAL SCROLL) */}
          <View style={styles.sectionWrap}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('home.active_shipments')}</Text>
              <View style={styles.countBadge}><Text style={styles.countBadgeText}>{activeShipments.length}</Text></View>
            </View>
            
            {activeShipments.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
                {activeShipments.map((c, i) => {
                  const isFirst = i % 2 === 0;
                  // Alternate colors for cards like in design (Light Blue & Light Orange/Pink)
                  const bgColor = isFirst ? '#E8F1FC' : '#FCECE8';
                  const primaryC = isFirst ? colors.secondary : colors.accent;
                  
                  return (
                    <TouchableOpacity key={c.id} style={[styles.activeCard, { backgroundColor: bgColor }]} onPress={() => router.push(`/colis/${c.id}`)}>
                      <View style={styles.acHeader}>
                        <Text style={styles.acCategory}>{c.transport_mode === 'air' ? t('home.transport_air') : t('home.transport_sea')}</Text>
                        <View style={[styles.acIconWrap, { backgroundColor: `${primaryC}20` }]}>
                          {c.transport_mode === 'air' ? <Plane size={16} color={primaryC} /> : <Ship size={16} color={primaryC} />}
                        </View>
                      </View>
                      
                      <Text style={styles.acTitle} numberOfLines={2}>{c.description}</Text>
                      
                      {c.total_price && c.total_price > 0 ? (
                        <View style={{ backgroundColor: '#EEF2FF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, alignSelf: 'flex-start', marginBottom: 12 }}>
                          <Text style={{ fontSize: 11, color: colors.primary, fontWeight: '700' }}>{c.total_price.toLocaleString()} FCFA</Text>
                        </View>
                      ) : null}
                      
                      <View style={styles.progressWrap}>
                        <View style={[styles.progressBar, { backgroundColor: primaryC, width: c.status === 'received' ? '30%' : c.status === 'in_transit' ? '70%' : '15%' }]} />
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ) : (
               <Text style={styles.emptyInline}>{t('shipment.no_shipments')}</Text>
            )}
          </View>

          <HomeBottomPanels settings={settings} />

          {/* EXCHANGE RATE CARD (VISA STYLE) */}
          <View style={[styles.sectionWrap, { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl }]}>
            
            {/* The Visa Card */}
            <View style={styles.visaCardContainer}>
              <LinearGradient
                colors={[colors.primary, colors.primaryDark]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={styles.visaCard}
              >
                {/* Top Section */}
                <View style={styles.visaTop}>
                  <View>
                    <Text style={styles.visaLabel}>{t('home.exchange_rate')}</Text>
                    <Text style={styles.visaTitle}>{t('home.rmb_fcfa')}</Text>
                  </View>
                  <Cpu size={32} color="rgba(255,255,255,0.8)" strokeWidth={1.5} style={{ transform: [{ rotate: '90deg' }] }} />
                </View>

                {/* Middle Section (Rates) */}
                <View style={styles.visaMiddle}>
                  <View style={styles.visaCol}>
                    <Text style={styles.visaRate}>1 ¥ = {settings?.exchange_rate_cny_xaf_under_1m || 100}</Text>
                    <Text style={styles.visaSubLabel}>{t('home.rate_under_1m')}</Text>
                  </View>
                  <View style={styles.visaCol}>
                    <Text style={styles.visaRate}>1 ¥ = {settings?.exchange_rate_cny_xaf_over_1m || 85}</Text>
                    <Text style={styles.visaSubLabel}>{t('home.rate_over_1m')}</Text>
                  </View>
                </View>

                {/* Bottom Section (Card Number style & Logos) */}
                <View style={styles.visaBottom}>
                  <Text style={styles.visaDate}>{t('home.updated_today')}</Text>
                  <View style={styles.visaMastercardLogo}>
                    <View style={[styles.mastercardCircle, { backgroundColor: 'rgba(255,255,255,0.4)', right: -10 }]} />
                    <View style={[styles.mastercardCircle, { backgroundColor: 'rgba(255,255,255,0.2)' }]} />
                  </View>
                </View>
              </LinearGradient>
            </View>

            {/* Solid WhatsApp Button Below Card */}
            <TouchableOpacity 
              style={styles.modernWhatsappBtn}
              activeOpacity={0.8}
              onPress={onWhatsAppPay}
            >
              <FontAwesome name="whatsapp" size={24} color="#fff" style={{ marginRight: 10 }} />
              <View style={{ alignItems: 'center' }}>
                <Text style={styles.modernWhatsappBtnText}>{t('home.pay_supplier')}</Text>
                <Text style={styles.modernWhatsappBtnSub}>{supportPhoneDisplay}</Text>
              </View>
            </TouchableOpacity>

            <HomeServicesMenu />
            
          </View>
        </View>
      </ScrollView>

      {/* FAB marketplace discret */}
      <TouchableOpacity
        style={styles.marketFab}
        activeOpacity={0.88}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push('/(tabs)/marketplace');
        }}
        accessibilityRole="button"
        accessibilityLabel={t('home.marketplace_fab_a11y')}
      >
        <ShoppingBag size={20} color={colors.primary} strokeWidth={2.2} />
      </TouchableOpacity>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingBottom: 100 },
  
  /* Hero Curved Header */
  heroCurveContainer: {
    width: '100%',
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
    ...shadow.floating,
    marginBottom: spacing.md,
  },
  heroHeaderBg: {
    width: '100%',
  },
  heroGradientOverlay: {
    width: '100%',
    paddingBottom: spacing.xs,
  },
  heroSafeArea: {
    paddingTop: spacing.xs,
  },
  
  /* Header Top Bar */
  headerRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: spacing.lg, 
    marginTop: spacing.xs, 
    marginBottom: spacing.md 
  },
  avatarWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#3B82F6',
    ...shadow.sm,
  },
  avatarImage: { width: 48, height: 48, borderRadius: 24 },
  avatarText: { color: colors.primary, fontSize: 22, fontWeight: '900', fontFamily: fonts.heading },
  headerTextWrap: { flex: 1, marginLeft: 12 },
  greeting: { fontSize: 13, color: '#93C5FD', fontWeight: '600', marginBottom: 2 },
  userName: { fontSize: 19, fontWeight: '900', color: '#FFFFFF', fontFamily: fonts.heading, letterSpacing: 0.3 },
  bellWrap: { 
    width: 42, 
    height: 42, 
    borderRadius: 21, 
    backgroundColor: 'rgba(255, 255, 255, 0.15)', 
    alignItems: 'center', 
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  badge: { 
    position: 'absolute', 
    top: 9, 
    right: 9, 
    width: 9, 
    height: 9, 
    borderRadius: 4.5, 
    backgroundColor: '#EF4444', 
    borderWidth: 1.5, 
    borderColor: '#0F172A' 
  },
  
  /* Main Body Content */
  mainBodyWrap: {
    paddingTop: spacing.xs,
  },
  heroCard: { 
    marginHorizontal: spacing.lg, 
    borderRadius: 28, 
    padding: 22, 
    marginBottom: spacing.lg, 
    ...shadow.floating 
  },
  marketBanner: {
    marginHorizontal: spacing.lg,
    marginTop: -spacing.md,
    marginBottom: spacing.xl,
    borderRadius: 20,
    overflow: 'hidden',
    ...shadow.card,
  },
  marketBannerBg: { minHeight: 92 },
  marketBannerImg: { resizeMode: 'cover' },
  marketBannerOverlay: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    minHeight: 92,
  },
  marketIcon: {
    width: 42, height: 42, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  marketTitle: { fontWeight: '900', color: '#fff', fontSize: 15 },
  marketSub: { marginTop: 2, fontSize: 12, color: 'rgba(255,255,255,0.82)', lineHeight: 16 },
  heroMoreBtn: { position: 'absolute', top: 20, right: 20, padding: 4 },
  heroContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  heroLeft: { flex: 1 },
  heroTitle: { color: '#fff', fontSize: 20, fontWeight: '700', lineHeight: 28, fontFamily: fonts.heading, marginBottom: 20 },
  heroBtn: { backgroundColor: '#fff', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 16, alignSelf: 'flex-start' },
  heroBtnText: { color: colors.primary, fontWeight: '800', fontSize: 14 },
  heroRight: { marginLeft: 16 },
  circleOuter: { width: 90, height: 90, borderRadius: 45, borderWidth: 6, borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center', borderTopColor: '#fff', transform: [{ rotate: '-45deg' }] },
  circleInner: { transform: [{ rotate: '45deg' }], alignItems: 'center' },
  circleText: { color: '#fff', fontSize: 24, fontWeight: '800' },
  circleSub: { color: 'rgba(255,255,255,0.8)', fontSize: 10, fontWeight: '700', marginTop: -2 },

  sectionWrap: { marginBottom: spacing.xl },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: colors.text, fontFamily: fonts.heading },
  countBadge: { backgroundColor: '#E8E8FF', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, marginLeft: 8 },
  countBadgeText: { color: colors.primary, fontSize: 12, fontWeight: '800' },

  horizontalScroll: { paddingHorizontal: spacing.lg, gap: 16, paddingRight: spacing.lg * 2 },
  activeCard: { width: width * 0.6, borderRadius: 24, padding: 20 },
  acHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  acCategory: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  acIconWrap: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  acTitle: { fontSize: 17, fontWeight: '800', color: colors.text, marginBottom: 24, lineHeight: 22 },
  progressWrap: { height: 8, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 4, overflow: 'hidden' },
  progressBar: { height: '100%', borderRadius: 4 },

  recentItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: spacing.lg, marginBottom: 12, padding: 16, borderRadius: 20, ...shadow.card },
  recentIconWrap: { width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  recentTextWrap: { flex: 1, marginLeft: 16 },
  recentTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 4 },
  recentSub: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
  recentRight: { alignItems: 'flex-end', justifyContent: 'center', maxWidth: 110 },

  empty: { alignItems: 'center', padding: spacing.xl },
  emptyText: { color: colors.textSecondary, marginTop: 12, fontWeight: '500' },
  emptyInline: { color: colors.textSecondary, marginLeft: spacing.lg, fontWeight: '500' },

  visaCardContainer: { marginBottom: 20, ...shadow.floating },
  visaCard: { borderRadius: 24, overflow: 'hidden', paddingBottom: 0 },
  visaTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 24, paddingBottom: 12 },
  visaLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600', letterSpacing: 1, marginBottom: 4 },
  visaTitle: { color: '#fff', fontSize: 24, fontWeight: '800', fontFamily: fonts.heading },
  
  visaMiddle: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 16 },
  visaCol: { flex: 1 },
  visaRate: { color: '#fff', fontSize: 18, fontWeight: '800', fontFamily: fonts.heading, marginBottom: 4 },
  visaSubLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '600', letterSpacing: 0.5 },

  visaBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 24, paddingVertical: 16, marginTop: 8 },
  visaDate: { color: '#fff', fontSize: 13, fontWeight: '600', letterSpacing: 2 },
  visaMastercardLogo: { flexDirection: 'row', alignItems: 'center', position: 'relative', width: 40, height: 24, justifyContent: 'center' },
  mastercardCircle: { position: 'absolute', width: 24, height: 24, borderRadius: 12 },

  modernWhatsappBtn: {
    backgroundColor: '#25D366',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: radii.button,
    marginBottom: spacing.sm,
    ...shadow.card,
  },
  modernWhatsappBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  modernWhatsappBtnSub: { color: 'rgba(255,255,255,0.9)', fontWeight: '600', fontSize: 13, marginTop: 2 },

  marketFab: {
    position: 'absolute',
    right: 16,
    bottom: 12,
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(15, 23, 42, 0.08)',
    ...shadow.floating,
  },
});

