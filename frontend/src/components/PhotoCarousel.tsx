import React, { useState } from 'react';
import { View, StyleSheet, Dimensions, Modal, TouchableOpacity, FlatList, Text } from 'react-native';
import { Image } from 'expo-image';
import { Package as PackageIcon, X } from 'lucide-react-native';
import { resolveMediaUrl, packagePhotoUrl } from '../utils/mediaUrl';
import { colors, radii, spacing } from '../constants/theme';

const { width: W } = Dimensions.get('window');

interface Props {
  photos: string[];
  packageId?: string;
  fallbackUrl?: string;
}

function CarouselImage({
  uri,
  fallbackUrl,
  onPress,
}: {
  uri: string;
  fallbackUrl?: string;
  onPress: () => void;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <TouchableOpacity activeOpacity={0.95} onPress={onPress} style={styles.imageWrap}>
        {fallbackUrl ? (
          <Image source={{ uri: fallbackUrl }} style={styles.image} contentFit="cover" />
        ) : (
          <View style={[styles.image, styles.imageFallback]}>
            <PackageIcon size={48} color={colors.textSecondary} strokeWidth={1.2} />
            <Text style={styles.fallbackText}>Photo indisponible</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity activeOpacity={0.95} onPress={onPress}>
      <Image
        source={{ uri }}
        style={styles.image}
        contentFit="cover"
        transition={200}
        onError={() => setFailed(true)}
      />
    </TouchableOpacity>
  );
}

export default function PhotoCarousel({ photos, packageId, fallbackUrl }: Props) {
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);

  const getFullUrl = (url: string) => {
    if (packageId) return packagePhotoUrl(packageId, url);
    return resolveMediaUrl(url);
  };

  const sources =
    photos && photos.length > 0 ? photos.map(getFullUrl) : fallbackUrl ? [fallbackUrl] : [];

  if (sources.length === 0) {
    return (
      <View style={styles.placeholder} testID="photo-placeholder">
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
        onMomentumScrollEnd={e => setIdx(Math.round(e.nativeEvent.contentOffset.x / (W - 32)))}
        renderItem={({ item, index }) => (
          <CarouselImage
            uri={item}
            fallbackUrl={fallbackUrl}
            onPress={() => {
              setIdx(index);
              setOpen(true);
            }}
          />
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
          <Image source={{ uri: sources[idx] }} style={styles.fullImage} contentFit="contain" />
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
    backgroundColor: colors.background,
    marginRight: 0,
  },
  imageWrap: { width: W - 32 },
  imageFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  fallbackText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
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
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D1D5DB',
  },
  dotActive: {
    backgroundColor: colors.primary,
    width: 16,
  },
  modal: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  fullImage: { width: W, height: '80%' },
});
