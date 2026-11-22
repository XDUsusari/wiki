import { Image } from 'expo-image';
import { View } from 'react-native';
import { onColor } from '@dinsdelparc/shared';
import { publicStorageUrl } from '../lib/supabase';
import { useAppTheme } from '../theme';
import { Text } from './ui/Text';

const COLORS = ['#1565C0', '#2E7D32', '#C62828', '#6A1B9A', '#EF6C00', '#00897B', '#6D4C41'];

export function Avatar({ path, name, size = 40 }: { path: string | null | undefined; name: string; size?: number }) {
  const { colors } = useAppTheme();
  const url = publicStorageUrl('avatars', path);
  const initial = (name.trim()[0] ?? '?').toUpperCase();
  const bg = COLORS[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length] ?? COLORS[0]!;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: url ? colors.surfaceAlt : bg, alignItems: 'center', justifyContent: 'center' }}
    >
      {url ? (
        <Image source={{ uri: url }} style={{ width: size, height: size }} contentFit="cover" transition={150} />
      ) : (
        <Text style={{ color: onColor(bg), fontSize: size * 0.42, lineHeight: size * 0.5 }} variant="bodyStrong">
          {initial}
        </Text>
      )}
    </View>
  );
}
