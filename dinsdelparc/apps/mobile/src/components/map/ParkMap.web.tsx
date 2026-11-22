import { View } from 'react-native';
import { useT } from '../../i18n';
import { EmptyState } from '../ui';
import type { ParkMapProps } from './ParkMap';

/** MapLibre React Native has no web renderer; the web build lists the points instead. */
export function ParkMap(_props: ParkMapProps) {
  const { t } = useT();
  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 16 }}>
      <EmptyState icon="map-outline" title={t('map.nativeOnly')} />
    </View>
  );
}
export type { ParkMapProps };
