import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';
import { useT } from '../i18n';

export function StarRating({ value, onChange, size = 22 }: { value: number; onChange?: (v: number) => void; size?: number }) {
  const { t } = useT();
  return (
    <View
      style={{ flexDirection: 'row', gap: onChange ? 6 : 2 }}
      accessible={!onChange}
      accessibilityRole={onChange ? 'adjustable' : 'text'}
      accessibilityLabel={`${t('attraction.rating')}: ${value.toFixed(1)} / 5`}
    >
      {[1, 2, 3, 4, 5].map((n) => {
        const icon = value >= n ? 'star' : value >= n - 0.5 ? 'star-half' : 'star-outline';
        const star = <Ionicons name={icon} size={size} color="#F5A623" />;
        if (!onChange) return <View key={n}>{star}</View>;
        return (
          <Pressable key={n} accessibilityRole="button" accessibilityLabel={`${n} / 5`} accessibilityState={{ selected: value === n }} onPress={() => onChange(n)} hitSlop={6} style={{ padding: 4 }}>
            {star}
          </Pressable>
        );
      })}
    </View>
  );
}
