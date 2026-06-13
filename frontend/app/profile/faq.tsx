import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, LayoutAnimation, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronDown, ChevronUp, HelpCircle, MessageCircle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { colors, fonts, radii, shadow, spacing } from '../../src/constants/theme';

const FAQ_ITEMS_BY_LANG: Record<string, { q: string; a: string }[]> = {
  fr: [
    { q: 'Comment fonctionne le groupage Chine → Cameroun ?', a: 'Vos colis sont reçus dans notre entrepôt en Chine, puis regroupés avec ceux d\'autres clients dans un conteneur ou une palette aérienne pour réduire les coûts. Vous payez au kilo ou au m³ selon le mode choisi.' },
    { q: 'Quels sont les délais ?', a: 'Maritime : 30-45 jours du départ port chinois jusqu\'à Douala. Aérien : 7-12 jours. Les délais incluent le dédouanement et la livraison à votre adresse au Cameroun.' },
    { q: 'Comment expédier un colis ?', a: 'Achetez sur Alibaba/1688/Taobao et faites livrer au nom et à l\'adresse de notre entrepôt en Chine (visible dans l\'app après création d\'un colis). Nous nous occupons du reste.' },
    { q: 'Quels articles sont interdits ?', a: 'Produits inflammables, batteries lithium non emballées, produits illégaux, médicaments sans ordonnance, armes, animaux vivants. Contactez-nous en cas de doute.' },
    { q: 'Comment payer ?', a: 'Paiement Mobile Money (MTN, Orange) ou virement bancaire à la livraison. Le devis est généré automatiquement après réception et pesée du colis à notre entrepôt.' },
    { q: 'Que faire si mon colis est endommagé ?', a: 'Contactez le support immédiatement avec photos. Si l\'assurance était activée (2% de la valeur déclarée), nous traitons l\'indemnisation sous 7 jours.' },
    { q: 'Comment fonctionne le suivi ?', a: 'Chaque colis a un numéro de suivi unique (ex: SEA-CM00124-00347-25). Vous recevez une notification à chaque étape : reçu, devis, groupé, parti, en transit, arrivé, livré.' },
    { q: 'Puis-je changer l\'adresse de livraison ?', a: 'Oui, dans Profil → Adresse de livraison par défaut. Vous pouvez aussi spécifier une adresse différente lors de la création du colis.' },
  ],
  en: [
    { q: 'How does China → Cameroon groupage work?', a: 'Your packages are received at our warehouse in China, then consolidated with others into a container or air pallet to reduce costs. You pay per kg or m³ depending on the mode.' },
    { q: 'What are the delivery times?', a: 'Sea: 30-45 days from Chinese port to Douala. Air: 7-12 days. These include customs clearance and delivery to your address in Cameroon.' },
    { q: 'How do I ship a package?', a: 'Buy on Alibaba/1688/Taobao and have it delivered to our China warehouse (address shown in-app after creating a package). We handle the rest.' },
    { q: 'What items are prohibited?', a: 'Flammable goods, unpacked lithium batteries, illegal products, prescription drugs without script, weapons, live animals. Contact us if unsure.' },
    { q: 'How do I pay?', a: 'Mobile Money (MTN, Orange) or bank transfer on delivery. Quote is auto-generated after package is received and weighed at our warehouse.' },
    { q: 'What if my package is damaged?', a: 'Contact support immediately with photos. If insurance was enabled (2% of declared value), we process compensation within 7 days.' },
    { q: 'How does tracking work?', a: 'Each package has a unique tracking number (e.g. SEA-CM00124-00347-25). You receive notifications at each stage: received, quoted, grouped, departed, in transit, arrived, delivered.' },
    { q: 'Can I change my delivery address?', a: 'Yes, in Profile → Default delivery address. You can also specify a different address when creating a package.' },
  ],
  zh: [
    { q: '中国到喀麦隆拼货如何运作？', a: '您的包裹送至我们中国仓库，然后与其他客户的货物合并装入集装箱或空运托盘以降低成本。按公斤或立方米计费。' },
    { q: '运输时间是多久？', a: '海运：从中国港口到杜阿拉 30-45 天。空运：7-12 天。包含清关和送货到喀麦隆地址。' },
    { q: '如何发送包裹？', a: '在阿里巴巴/1688/淘宝购物，发货到我们中国仓库（创建包裹后在应用中显示地址）。其余我们处理。' },
    { q: '哪些物品被禁止？', a: '易燃品、未包装锂电池、非法产品、无处方药、武器、活体动物。如有疑问请联系我们。' },
    { q: '如何付款？', a: '货到付款（MTN、Orange 移动支付）或银行转账。包裹到仓后自动生成报价。' },
    { q: '包裹损坏怎么办？', a: '请立即附照片联系客服。如启用了保险（申报价值的 2%），我们将在 7 天内处理赔偿。' },
    { q: '追踪如何工作？', a: '每个包裹有唯一追踪号（例如 SEA-CM00124-00347-25）。每个阶段都会收到通知：到仓、报价、拼货、发出、运输、到达、送达。' },
    { q: '可以更改送货地址吗？', a: '可以，在"我的"→"默认送货地址"中修改。也可在创建包裹时指定不同地址。' },
  ],
};

export default function FaqScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const items = FAQ_ITEMS_BY_LANG[i18n.language] || FAQ_ITEMS_BY_LANG.fr;
  const [open, setOpen] = useState<number | null>(0);

  const toggle = (idx: number) => {
    Haptics.selectionAsync();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen(open === idx ? null : idx);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']} testID="faq-screen">
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} testID="faq-back">
          <ChevronLeft size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('profile.faq')}</Text>
        <View style={{ width: 26 }} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.heroIcon}>
          <HelpCircle size={48} color={colors.primary} strokeWidth={1.5} />
        </View>
        {items.map((item, idx) => (
          <TouchableOpacity key={idx} style={styles.item} onPress={() => toggle(idx)} testID={`faq-item-${idx}`} activeOpacity={0.85}>
            <View style={styles.itemHead}>
              <Text style={styles.q} numberOfLines={2}>{item.q}</Text>
              {open === idx ? <ChevronUp size={18} color={colors.primary} /> : <ChevronDown size={18} color={colors.textSecondary} />}
            </View>
            {open === idx && <Text style={styles.a}>{item.a}</Text>}
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={styles.contact} onPress={() => Haptics.selectionAsync()} testID="faq-contact">
          <MessageCircle size={20} color="#fff" />
          <Text style={styles.contactText}>WhatsApp +237 6XX XXX XXX</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  scroll: { padding: spacing.lg, paddingTop: 0, paddingBottom: 40 },
  heroIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: spacing.lg, ...shadow.card },
  item: { backgroundColor: '#fff', borderRadius: radii.card, padding: spacing.md, marginBottom: spacing.sm, ...shadow.card },
  itemHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  q: { color: colors.text, fontSize: 14, fontWeight: '700', flex: 1 },
  a: { color: colors.textSecondary, fontSize: 13, lineHeight: 20, marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.borderLight },
  contact: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.success, paddingVertical: 14, borderRadius: radii.button, marginTop: spacing.lg },
  contactText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
