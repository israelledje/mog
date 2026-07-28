import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView,
  Platform, ActivityIndicator, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, Send, Sparkles, Trash2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { assistantApi, type AssistantMessage } from '../src/api/assistant';
import { colors, fonts, spacing } from '../src/constants/theme';

const SUGGESTIONS = [
  'Quels sont vos tarifs aériens ?',
  'Comment déclarer un colis ?',
  'Quels services proposez-vous en Chine ?',
  'Comment fonctionne le remplissage de conteneur ?',
  'Quels sont les délais maritime vers Douala ?',
];

type UiMessage = AssistantMessage & { id: string };

export default function AssistantScreen() {
  const router = useRouter();
  const { i18n } = useTranslation();
  const listRef = useRef<FlatList>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<UiMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Bonjour, je suis **MOG Assistant**. Posez-moi vos questions sur nos tarifs, délais, services (aéroport, hôtel, véhicules, conteneur…) ou le suivi de vos colis. Comment puis-je vous aider ?',
    },
  ]);

  useEffect(() => {
    const t = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(t);
  }, [messages, loading]);

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;

    Haptics.selectionAsync();
    setError(null);
    setInput('');

    const userMsg: UiMessage = { id: `u-${Date.now()}`, role: 'user', content };
    const historyForApi: AssistantMessage[] = [
      ...messages
        .filter((m) => m.id !== 'welcome')
        .map(({ role, content: c }) => ({ role, content: c })),
      { role: 'user', content },
    ];

    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await assistantApi.chat(historyForApi, i18n.language || 'fr');
      setMessages((prev) => [
        ...prev,
        { id: `a-${Date.now()}`, role: 'assistant', content: res.reply },
      ]);
    } catch (e: any) {
      const detail = e?.response?.data?.detail || e?.message || 'Impossible de joindre l’assistant.';
      setError(typeof detail === 'string' ? detail : 'Erreur assistant');
      setMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: 'assistant',
          content:
            'Je rencontre un souci technique pour le moment. Réessayez dans un instant, ou contactez un opérateur M.O.G via WhatsApp.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content:
          'Conversation réinitialisée. Que souhaitez-vous savoir sur M.O.G Group Multiservice ?',
      },
    ]);
    setError(null);
  };

  const renderContent = (text: string, isUser = false) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return (
      <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>
        {parts.map((part, i) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return (
              <Text key={i} style={styles.bold}>
                {part.slice(2, -2)}
              </Text>
            );
          }
          return <Text key={i}>{part}</Text>;
        })}
      </Text>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <LinearGradient colors={['#0F172A', '#1E3A5F']} style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <ChevronLeft size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.headerBadge}>
            <Sparkles size={14} color="#A5B4FC" />
            <Text style={styles.headerBadgeText}>IA M.O.G</Text>
          </View>
          <Text style={styles.headerTitle}>MOG Assistant</Text>
          <Text style={styles.headerSub}>Tarifs · Services · Conseils</Text>
        </View>
        <TouchableOpacity onPress={clearChat} style={styles.clearBtn}>
          <Trash2 size={18} color="rgba(255,255,255,0.8)" />
        </TouchableOpacity>
      </LinearGradient>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          ListHeaderComponent={
            messages.length <= 1 ? (
              <View style={styles.suggestions}>
                {SUGGESTIONS.map((s) => (
                  <Pressable key={s} style={styles.chip} onPress={() => send(s)}>
                    <Text style={styles.chipText}>{s}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <View style={[styles.row, item.role === 'user' ? styles.rowUser : styles.rowBot]}>
              {item.role === 'assistant' ? (
                <View style={styles.avatar}>
                  <Sparkles size={14} color="#fff" />
                </View>
              ) : null}
              <View style={[styles.bubble, item.role === 'user' ? styles.bubbleUser : styles.bubbleBot]}>
                {renderContent(item.content, item.role === 'user')}
              </View>
            </View>
          )}
          ListFooterComponent={
            loading ? (
              <View style={styles.typing}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.typingText}>MOG Assistant réfléchit…</Text>
              </View>
            ) : null
          }
        />

        {error ? <Text style={styles.errorBanner}>{error}</Text> : null}

        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Posez votre question à M.O.G…"
            placeholderTextColor={colors.textSecondary}
            multiline
            maxLength={2000}
            editable={!loading}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || loading) && { opacity: 0.45 }]}
            onPress={() => send()}
            disabled={!input.trim() || loading}
          >
            <Send size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F5F8' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  clearBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(165,180,252,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    marginBottom: 4,
  },
  headerBadgeText: { color: '#C7D2FE', fontSize: 10, fontWeight: '700', letterSpacing: 0.6 },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '800', fontFamily: fonts.heading },
  headerSub: { color: 'rgba(255,255,255,0.65)', fontSize: 11, marginTop: 2 },

  list: { padding: spacing.lg, paddingBottom: 12 },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E0E7FF',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
  },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.primary },

  row: { flexDirection: 'row', marginBottom: 12, maxWidth: '100%' },
  rowUser: { justifyContent: 'flex-end' },
  rowBot: { justifyContent: 'flex-start', gap: 8 },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  bubble: {
    maxWidth: '82%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  bubbleUser: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleBot: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#E8ECF1',
  },
  bubbleText: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.text,
  },
  bubbleTextUser: { color: '#fff' },
  bold: { fontWeight: '800' },

  typing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingLeft: 36,
  },
  typingText: { color: colors.textSecondary, fontSize: 12, fontStyle: 'italic' },

  errorBanner: {
    marginHorizontal: spacing.lg,
    marginBottom: 6,
    color: colors.danger,
    fontSize: 12,
    fontWeight: '600',
  },

  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E8ECF1',
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    backgroundColor: '#F5F7FA',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    color: colors.text,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
