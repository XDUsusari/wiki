import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { onColor } from '@dinsdelparc/shared';
import { publicStorageUrl } from '../lib/supabase';
import { useAppTheme } from '../theme';
import { Text } from './ui/Text';

/**
 * Header banner. Uses a licensed image from the 'content' bucket when one is
 * published; otherwise an illustrated banner in the area's accent colour
 * (no third-party photos are bundled).
 */
export function Hero({ title, subtitle, color, imagePath, imageCredit, children, icon }: {
  title: string;
  subtitle?: string | null;
  color: string;
  imagePath?: string | null;
  imageCredit?: string | null;
  children?: ReactNode;
  icon?: ReactNode;
}) {
  const { radii, spacing } = useAppTheme();
  const url = publicStorageUrl('content', imagePath);
  const fg = url ? '#FFFFFF' : onColor(color);
  return (
    <View style={[styles.hero, { backgroundColor: color, borderRadius: radii.xl }]}>
      {url ? (
        <>
          <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityIgnoresInvertColors />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(6,26,61,0.45)' }]} />
        </>
      ) : (
        <>
          <View style={[styles.circle, { width: 220, height: 220, right: -60, top: -80, backgroundColor: 'rgba(255,255,255,0.12)' }]} />
          <View style={[styles.circle, { width: 140, height: 140, right: 40, bottom: -70, backgroundColor: 'rgba(255,255,255,0.08)' }]} />
          <View style={[styles.wave, { backgroundColor: 'rgba(255,255,255,0.10)' }]} />
        </>
      )}
      <View style={{ padding: spacing.xl, gap: spacing.xs, minHeight: 170, justifyContent: 'flex-end' }}>
        {icon}
        <Text variant="display" style={{ color: fg }}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="body" style={{ color: fg, opacity: 0.92 }}>
            {subtitle}
          </Text>
        ) : null}
        {children}
        {url && imageCredit ? (
          <Text variant="caption" style={{ color: fg, opacity: 0.8, marginTop: 6 }}>
            © {imageCredit}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { overflow: 'hidden' },
  circle: { position: 'absolute', borderRadius: 999 },
  wave: { position: 'absolute', left: -40, right: -40, bottom: 26, height: 34, borderRadius: 40, transform: [{ rotate: '-4deg' }] },
});
