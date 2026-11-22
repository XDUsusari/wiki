import { View } from 'react-native';
import { palette } from '@dinsdelparc/shared';
import { useAppTheme } from '../theme';
import { Text } from './ui/Text';

/**
 * DinsDelParc logo: an arch ("entering the park") over a wave line, drawn with
 * plain views so it needs no image assets and adapts to dark mode.
 */
export function LogoMark({ size = 36 }: { size?: number }) {
  const arch = size * 0.56;
  return (
    <View
      accessible
      accessibilityLabel="DinsDelParc"
      style={{ width: size, height: size, borderRadius: size * 0.28, backgroundColor: palette.navy900, alignItems: 'center', justifyContent: 'center' }}
    >
      <View
        style={{
          width: arch,
          height: arch * 0.78,
          borderTopLeftRadius: arch / 2,
          borderTopRightRadius: arch / 2,
          borderWidth: size * 0.08,
          borderBottomWidth: 0,
          borderColor: palette.sun,
          marginTop: size * 0.08,
        }}
      />
      <View style={{ width: arch * 1.1, height: size * 0.07, borderRadius: 4, backgroundColor: palette.blue300, marginTop: -size * 0.02 }} />
    </View>
  );
}

export function Logo({ size = 36 }: { size?: number }) {
  const { colors } = useAppTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <LogoMark size={size} />
      <Text variant="h3" style={{ color: colors.brand, letterSpacing: -0.3 }} accessibilityElementsHidden>
        Dins<Text variant="h3" style={{ color: colors.interactive }}>Del</Text>Parc
      </Text>
    </View>
  );
}
