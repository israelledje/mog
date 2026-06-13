import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, FlatList, TouchableOpacity, Image, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Package, Boxes, Bell } from 'lucide-react-native';
import LanguageSelector from '../src/components/LanguageSelector';
import { colors, fonts, radii, shadow, spacing } from '../src/constants/theme';

const { width: W } = Dimensions.get('window');

export default function Onboarding() {
  const { t } = useTranslation();
  const router = useRouter();
  const [idx, setIdx] = useState(0);
  const ref = useRef<FlatList>(null);

  const slides = [
    { key: 's1', title: t('onboarding.slide1_title'), desc: t('onboarding.slide1_desc'), icon: <Package size={80} color={colors.primary} strokeWidth={1.4} /> },
    { key: 's2', title: t('onboarding.slide2_title'), desc: t('onboarding.slide2_desc'), icon: <Boxes size={80} color={colors.accent} strokeWidth={1.4} /> },
    { key: 's3', title: t('onboarding.slide3_title'), desc: t('onboarding.slide3_desc'), icon: <Bell size={80} color={colors.success} strokeWidth={1.4} /> },
  ];

  const finish = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await AsyncStorage.setItem('@onboarded', '1');
    router.replace('/(auth)/login');
  };

  const next = () => {
    Haptics.selectionAsync();
    if (idx < slides.length - 1) {
      ref.current?.scrollToIndex({ index: idx + 1, animated: true });
    } else {
      finish();
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']} testID="onboarding-screen">
      <StatusBar barStyle="dark-content" />
      <View style={styles.topBar}>
        <LanguageSelector />
        <TouchableOpacity onPress={finish} testID="onboarding-skip">
          <Text style={styles.skip}>{t('common.skip')}</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        ref={ref}
        data={slides}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(s) => s.key}
        onMomentumScrollEnd={(e) => setIdx(Math.round(e.nativeEvent.contentOffset.x / W))}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width: W }]}>
            <View style={styles.iconWrap}>{item.icon}</View>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.desc}>{item.desc}</Text>
          </View>
        )}
      />
      <View style={styles.dots}>
        {slides.map((_, i) => (
          <View key={i} style={[styles.dot, i === idx && styles.dotActive]} />
        ))}
      </View>
      <View style={styles.footer}>
        <TouchableOpacity style={styles.btn} onPress={next} testID="onboarding-next">
          <Text style={styles.btnText}>{idx === slides.length - 1 ? t('common.start') : t('common.next')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
  },
  skip: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
  slide: { flex: 1, padding: spacing.xl, alignItems: 'center', justifyContent: 'center' },
  iconWrap: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
    ...shadow.card,
  },
  title: { fontSize: 28, fontWeight: '800', color: colors.text, textAlign: 'center', marginBottom: 12, fontFamily: fonts.heading },
  desc: { fontSize: 16, color: colors.textSecondary, textAlign: 'center', lineHeight: 24, paddingHorizontal: spacing.md },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginVertical: spacing.lg },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#D1D5DB' },
  dotActive: { width: 24, backgroundColor: colors.primary },
  footer: { padding: spacing.lg },
  btn: { backgroundColor: colors.primary, borderRadius: radii.button, paddingVertical: 16, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
