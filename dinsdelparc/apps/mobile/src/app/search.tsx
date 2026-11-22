import type { SearchResult } from '@dinsdelparc/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Divider, ListRow } from '../components/Rows';
import { Card, Chip, EmptyState, Screen, SkeletonList, Text, TextField, type IconName } from '../components/ui';
import { useIsOnline } from '../hooks/useNetwork';
import { useT } from '../i18n';
import { searchAll, searchCached } from '../services/search';
import { useAppTheme } from '../theme';

const KINDS: SearchResult['kind'][] = ['attraction', 'area', 'park', 'restaurant', 'show', 'shop', 'user', 'post', 'forum_topic'];
const ICONS: Record<SearchResult['kind'], IconName> = {
  park: 'compass-outline',
  area: 'map-outline',
  attraction: 'rocket-outline',
  restaurant: 'restaurant-outline',
  shop: 'bag-handle-outline',
  show: 'musical-notes-outline',
  user: 'person-outline',
  post: 'chatbubble-outline',
  forum_topic: 'chatbubbles-outline',
};

function routeFor(r: SearchResult): string {
  switch (r.kind) {
    case 'park':
      return `/park/${r.slug}`;
    case 'area':
      return `/area/${r.id}`;
    case 'attraction':
      return `/attraction/${r.id}`;
    case 'restaurant':
    case 'shop':
    case 'show':
      return `/venue/${r.kind}/${r.id}`;
    case 'user':
      return `/user/${r.slug}`;
    case 'post':
      return `/post/${r.id}`;
    case 'forum_topic':
      return `/forum/topic/${r.id}`;
  }
}

export default function Search() {
  const { t } = useT();
  const { spacing } = useAppTheme();
  const online = useIsOnline();
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const [debounced, setDebounced] = useState('');
  const [kind, setKind] = useState<SearchResult['kind'] | null>(null);
  useEffect(() => {
    const h = setTimeout(() => setDebounced(text.trim()), 300);
    return () => clearTimeout(h);
  }, [text]);
  const enabled = debounced.length >= 2;
  const q = useQuery({
    queryKey: ['search', debounced, kind, online],
    enabled,
    queryFn: () => (online ? searchAll(debounced, kind ? [kind] : null) : Promise.resolve(searchCached(qc, debounced).filter((r) => !kind || r.kind === kind))),
    staleTime: 30_000,
  });

  return (
    <Screen edges={[]} keyboard>
      <TextField label={t('search.title')} placeholder={t('search.placeholder')} value={text} onChangeText={setText} autoFocus returnKeyType="search" autoCorrect={false} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
        <Chip label={t('search.all')} selected={kind === null} onPress={() => setKind(null)} />
        {KINDS.map((k) => (
          <Chip key={k} label={t(`search.kinds.${k}`)} icon={ICONS[k]} selected={kind === k} onPress={() => setKind(k)} />
        ))}
      </ScrollView>
      {!enabled ? (
        <Text variant="small" tone="muted">
          {t('search.minChars')}
        </Text>
      ) : null}
      {!online && enabled ? (
        <Text variant="caption" tone="warning">
          {t('search.offlineResults')}
        </Text>
      ) : null}
      {q.isLoading && enabled ? <SkeletonList rows={4} height={56} /> : null}
      {q.data && q.data.length === 0 ? <EmptyState icon="search-outline" title={t('search.noResults', { query: debounced })} /> : null}
      {q.data && q.data.length > 0 ? (
        <Card>
          {q.data.map((r, i) => (
            <View key={`${r.kind}-${r.id}`}>
              {i > 0 ? <Divider /> : null}
              <ListRow
                title={r.title}
                subtitle={`${t(`search.kinds.${r.kind}`)}${r.subtitle ? ` · ${r.kind === 'post' ? t(`community.categories.${r.subtitle as 'news'}`) : r.subtitle}` : ''}`}
                icon={ICONS[r.kind]}
                onPress={() => router.push(routeFor(r) as never)}
              />
            </View>
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}
