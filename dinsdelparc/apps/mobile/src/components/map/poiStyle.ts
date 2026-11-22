import type { PoiKind } from '@dinsdelparc/shared';
import type { IconName } from '../ui';

export const POI_STYLE: Record<PoiKind, { color: string; icon: IconName }> = {
  attraction: { color: '#1565C0', icon: 'rocket' },
  restaurant: { color: '#EF6C00', icon: 'restaurant' },
  shop: { color: '#6A1B9A', icon: 'bag-handle' },
  show: { color: '#D81B60', icon: 'musical-notes' },
  service: { color: '#00897B', icon: 'information' },
  toilet: { color: '#455A64', icon: 'male-female' },
  first_aid: { color: '#C62828', icon: 'medkit' },
  entrance: { color: '#2E7D32', icon: 'enter' },
  other: { color: '#5B6B82', icon: 'location' },
};
