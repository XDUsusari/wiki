import { useQuery } from '@tanstack/react-query';
import { router, Stack } from 'expo-router';
import { View } from 'react-native';
import { Divider, ListRow } from '../../components/Rows';
import { Card, EmptyState, Screen, SkeletonList } from '../../components/ui';
import { useFavorites } from '../../hooks/queries';
import { useT } from '../../i18n';
import { fetchPlannerCatalog } from '../../services/content';

export default function Favorites() {
  const { t } = useT();
  const favs = useFavorites();
  const catalog = useQuery({ queryKey: ['plan', 'catalog'], queryFn: fetchPlannerCatalog, staleTime: 3_600_000 });
  const rows = (favs.data ?? []).map((f) => {
    const c = catalog.data;
    if (f.attraction_id) return { id: f.id, name: c?.attractions.find((a) => a.id === f.attraction_id)?.name, route: `/attraction/${f.attraction_id}`, icon: 'rocket-outline' as const };
    if (f.show_id) return { id: f.id, name: c?.shows.find((a) => a.id === f.show_id)?.name, route: `/venue/show/${f.show_id}`, icon: 'musical-notes-outline' as const };
    if (f.restaurant_id) return { id: f.id, name: c?.restaurants.find((a) => a.id === f.restaurant_id)?.name, route: `/venue/restaurant/${f.restaurant_id}`, icon: 'restaurant-outline' as const };
    return { id: f.id, name: c?.shops.find((a) => a.id === f.shop_id)?.name, route: `/venue/shop/${f.shop_id}`, icon: 'bag-handle-outline' as const };
  });
  return (
    <Screen edges={[]}>
      <Stack.Screen options={{ title: t('profile.favorites') }} />
      {favs.isLoading ? <SkeletonList rows={3} height={56} /> : null}
      {favs.data?.length === 0 ? <EmptyState icon="heart-outline" title={t('profile.noFavorites')} /> : null}
      {rows.length ? (
        <Card>
          {rows.map((r, i) => (
            <View key={r.id}>
              {i > 0 ? <Divider /> : null}
              <ListRow title={r.name ?? '…'} icon={r.icon} onPress={() => router.push(r.route as never)} />
            </View>
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}
