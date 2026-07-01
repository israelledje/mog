import React, { useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, Dimensions, Image, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Bell, Package, Plus, Plane, Ship, MoreHorizontal, ArrowRight, MessageCircle, Cpu } from 'lucide-react-native';
import { FontAwesome } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import SkeletonCard from '../../src/components/SkeletonCard';
import { useAuthStore } from '../../src/store/authStore';
import { useColisStore } from '../../src/store/colisStore';
import { useSettingsStore } from '../../src/store/settingsStore';
import { colors, fonts, shadow, spacing, radii } from '../../src/constants/theme';
import type { Colis } from '../../src/types';

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { colis, kpi, fetchAll, loading, unreadCount } = useColisStore();
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

  const activeShipments = colis.filter(c => ['in_transit', 'loading', 'loaded', 'closed', 'departed', 'pending_reception', 'received'].includes(c.status)).slice(0, 5);
  const recent = colis.slice(0, 5);
  const unread = unreadCount();

  const onShip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/colis/nouveau');
  };

  return (
    <View style={styles.container} testID="home-screen">
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          showsVerticalScrollIndicator={false}
        >
          {/* HEADER (LIKE IN DESIGN) */}
          <View style={styles.headerRow}>
            <View style={styles.avatarWrap}>
              <Text style={styles.avatarText}>{user?.full_name?.charAt(0) || 'C'}</Text>
            </View>
            <View style={styles.headerTextWrap}>
              <Text style={styles.greeting}>{t('home.greeting')}!</Text>
              <Text style={styles.userName}>{user?.full_name || t('home.client_fallback')}</Text>
            </View>
            <TouchableOpacity style={styles.bellWrap} onPress={() => router.push('/notifications')}>
              <Bell size={24} color={colors.text} strokeWidth={2.5} />
              {unread > 0 && <View style={styles.badge} />}
            </TouchableOpacity>
          </View>

          {/* MAIN HERO CARD (LIKE PURPLE CARD IN DESIGN) */}
          <TouchableOpacity activeOpacity={0.95} onPress={onShip}>
            <LinearGradient
              colors={[colors.primary, '#4B6CB7']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={[styles.heroCard, { overflow: 'hidden' }]}
            >
              {/* BACKGROUND WATERMARK IMAGE - Fixed absolute size to prevent layout issues */}
              <Image 
                source={require('../../assets/images/package_card_bg.png')}
                style={{ position: 'absolute', right: -50, bottom: -50, width: 300, height: 300, opacity: 0.3 }}
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
                  {/* Simulated Circular Progress from design */}
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

          {/* TASK GROUPS -> RECENT ACTIVITY (VERTICAL LIST) */}
          <View style={[styles.sectionWrap, { marginTop: spacing.md }]}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('home.recent_activity')}</Text>
              <View style={styles.countBadge}><Text style={styles.countBadgeText}>{recent.length}</Text></View>
            </View>

            {loading && colis.length === 0 ? (
              <><SkeletonCard /><SkeletonCard /></>
            ) : recent.length === 0 ? (
              <View style={styles.empty}>
                <Package size={36} color={colors.textSecondary} />
                <Text style={styles.emptyText}>{t('home.nothing_to_report')}</Text>
              </View>
            ) : (
              recent.map((c) => <RecentItem key={c.id} item={c} onPress={() => router.push(`/colis/${c.id}`)} />)
            )}
          </View>

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
              onPress={() => {
                const msg = encodeURIComponent(t('home.whatsapp_message'));
                Linking.openURL(`whatsapp://send?phone=+237600000000&text=${msg}`).catch(() => {
                  alert(t('home.whatsapp_install_required'));
                });
              }}
            >
              <FontAwesome name="whatsapp" size={24} color="#fff" style={{ marginRight: 10 }} />
              <Text style={styles.modernWhatsappBtnText}>{t('home.pay_supplier')}</Text>
            </TouchableOpacity>
            
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function RecentItem({ item, onPress }: { item: Colis; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.recentItem} onPress={onPress}>
      <View style={[styles.recentIconWrap, { backgroundColor: item.transport_mode === 'air' ? '#FCECE8' : '#E8F1FC' }]}>
        <Package size={22} color={item.transport_mode === 'air' ? colors.accent : colors.secondary} strokeWidth={2} />
      </View>
      <View style={styles.recentTextWrap}>
        <Text style={styles.recentTitle} numberOfLines={1}>{item.description}</Text>
        <Text style={styles.recentSub}>{item.tracking_number}</Text>
        {item.total_price && item.total_price > 0 ? (
          <View style={{ backgroundColor: '#EEF2FF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, alignSelf: 'flex-start', marginTop: 4 }}>
            <Text style={{ fontSize: 10, color: colors.primary, fontWeight: '700' }}>{item.total_price.toLocaleString()} FCFA</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.recentRight}>
        <Text style={[styles.recentStatus, { color: item.status === 'delivered' ? colors.success : colors.primary }]}>
          {item.status === 'pending_reception' ? '70%' : '100%'}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FB' }, // Light off-white like design
  scroll: { paddingBottom: 100 },
  
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, marginTop: spacing.sm, marginBottom: spacing.lg },
  avatarWrap: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 24, fontWeight: '800', fontFamily: fonts.heading },
  headerTextWrap: { flex: 1, marginLeft: 14 },
  greeting: { fontSize: 15, color: colors.textSecondary, fontWeight: '500', marginBottom: 2 },
  userName: { fontSize: 20, fontWeight: '800', color: colors.text, fontFamily: fonts.heading },
  bellWrap: { padding: 8 },
  badge: { position: 'absolute', top: 6, right: 8, width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent, borderWidth: 2, borderColor: '#F8F9FB' },
  
  heroCard: { marginHorizontal: spacing.lg, borderRadius: 28, padding: 24, marginBottom: spacing.xl, ...shadow.floating },
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
  recentRight: { width: 50, height: 50, borderRadius: 25, borderWidth: 3, borderColor: '#F0F0F0', alignItems: 'center', justifyContent: 'center', borderTopColor: '#E0E0E0' },
  recentStatus: { fontSize: 12, fontWeight: '800' },

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

  modernWhatsappBtn: { backgroundColor: '#25D366', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: radii.button, ...shadow.card },
  modernWhatsappBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});

