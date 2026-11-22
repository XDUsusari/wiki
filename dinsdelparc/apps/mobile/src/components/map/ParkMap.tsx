import { Ionicons } from '@expo/vector-icons';
import { Camera, Map as MapLibreMap, Marker, UserLocation, type CameraRef } from '@maplibre/maplibre-react-native';
import * as Location from 'expo-location';
import { useRef } from 'react';
import { Alert, View } from 'react-native';
import { useT } from '../../i18n';
import { env } from '../../lib/env';
import type { MapPoint } from '../../lib/mapPoints';
import { useAppTheme } from '../../theme';
import { IconButton } from '../ui';
import { POI_STYLE } from './poiStyle';

export interface ParkMapProps {
  points: MapPoint[];
  center: { latitude: number; longitude: number; zoom: number };
  selected: string | null;
  onSelect: (key: string) => void;
}

/** Native MapLibre map with custom markers (OpenStreetMap-based tiles). */
export function ParkMap({ points, center, selected, onSelect }: ParkMapProps) {
  const { t } = useT();
  const { colors } = useAppTheme();
  const camera = useRef<CameraRef>(null);

  const locate = async () => {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) return Alert.alert(t('map.myLocation'), t('map.locationDenied'));
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    camera.current?.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 17, duration: 800 });
  };

  return (
    <View style={{ flex: 1 }}>
      <MapLibreMap style={{ flex: 1 }} mapStyle={env.mapStyleUrl} attribution logo={false} compass>
        <Camera ref={camera} initialViewState={{ center: [center.longitude, center.latitude], zoom: center.zoom }} />
        <UserLocation />
        {points.map((p) => {
          const style = POI_STYLE[p.kind];
          const active = selected === p.key;
          return (
            <Marker key={p.key} id={p.key} lngLat={[p.location!.longitude!, p.location!.latitude!]} anchor="bottom" onPress={() => onSelect(p.key)}>
              <View
                accessibilityLabel={p.name}
                style={{
                  width: active ? 40 : 32,
                  height: active ? 40 : 32,
                  borderRadius: 20,
                  backgroundColor: style.color,
                  borderWidth: 3,
                  borderColor: p.location!.coords_verified ? '#FFFFFF' : '#FFC46B',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name={style.icon} size={active ? 20 : 16} color="#fff" />
              </View>
            </Marker>
          );
        })}
      </MapLibreMap>
      <View style={{ position: 'absolute', right: 12, bottom: 12, backgroundColor: colors.surfaceRaised, borderRadius: 24 }}>
        <IconButton icon="locate-outline" label={t('map.myLocation')} onPress={locate} color={colors.interactive} />
      </View>
    </View>
  );
}
