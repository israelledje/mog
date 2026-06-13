import React, { useState } from 'react';
import { View, Image, StyleSheet, Dimensions, Modal, TouchableOpacity, FlatList } from 'react-native';
import { Package as PackageIcon, X } from 'lucide-react-native';
import { BASE } from '../api/client';
import { colors, radii, spacing } from '../constants/theme';

const { width: W } = Dimensions.get('window');

interface Props {
  photos: string[];
  fallbackUrl?: string;
}

export default function PhotoCarousel({ photos, fallbackUrl }: Props) {
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);
  
  const getFullUrl = (url: string) => {
    if (url.startsWith('http')) return url;
    return `${BASE}${url}`;
  };

  const sources = (photos && photos.length > 0) 
    ? photos.map(getFullUrl) 
    : fallbackUrl ? [fallbackUrl] : [];

  if (sources.length === 0) {
    return (
      <View style={[styles.placeholder]} testID="photo-placeholder">
        <PackageIcon size={64} color={colors.textSecondary} strokeWidth={1.2} />
      </View>
    );
  }

  return (
    <View>
      <FlatList
        data={sources}
        keyExtractor={(_, i) => `p-${i}`}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setIdx(Math.round(e.nativeEvent.contentOffset.x / (W - 32)))}
        renderItem={({ item, index }) => (
          <TouchableOpacity activeOpacity={0.95} onPress={() => { setIdx(index); setOpen(true); }}>
            <Image source={{ uri: item }} style={styles.image} />
          </TouchableOpacity>
        )}
      />
      {sources.length > 1 && (
        <View style={styles.dots}>
          {sources.map((_, i) => (
            <View key={i} style={[styles.dot, i === idx && styles.dotActive]} />
          ))}
        </View>
      )}
      <Modal visible={open} transparent animationType="fade">
        <View style={styles.modal}>
          <TouchableOpacity style={styles.closeBtn} onPress={() => setOpen(false)} testID="photo-close">
            <X color="#fff" size={28} />
          </TouchableOpacity>
          <Image source={{ uri: sources[idx] }} style={styles.fullImage} resizeMode="contain" />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    width: W - 32,
    height: 240,
    borderRadius: radii.card,
    backgroundColor: '#000',
    marginRight: 0,
  },
  placeholder: {
    width: '100%',
    height: 200,
    borderRadius: radii.card,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.sm,
    gap: 6,
  },
  dot: {
    width: 6, height: 6, borderRadius: 3, backgroundColor: '#D1D5DB',
  },
  dotActive: {
    backgroundColor: colors.primary, width: 16,
  },
  modal: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', alignItems: 'center', justifyContent: 'center',
  },
  closeBtn: {
    position: 'absolute', top: 60, right: 20, zIndex: 10, padding: 8,
  },
  fullImage: { width: W, height: '80%' },
});
