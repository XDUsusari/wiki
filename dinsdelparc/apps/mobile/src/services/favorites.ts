import type { Favorite } from '@dinsdelparc/shared';
import { supabase, unwrap } from '../lib/supabase';

export type FavoriteKind = 'attraction' | 'show' | 'restaurant' | 'shop';
export type FavoriteTarget = { kind: FavoriteKind; id: string };

export async function fetchMyFavorites(userId: string): Promise<Favorite[]> {
  return unwrap(await supabase.from('favorites').select('*').eq('user_id', userId).order('created_at', { ascending: false })) as Favorite[];
}

export async function addFavorite(target: FavoriteTarget) {
  const row: Record<'attraction_id' | 'show_id' | 'restaurant_id' | 'shop_id', string | null> = {
    attraction_id: null,
    show_id: null,
    restaurant_id: null,
    shop_id: null,
  };
  row[`${target.kind}_id`] = target.id;
  unwrap(await supabase.from('favorites').insert(row));
}

export async function removeFavorite(favoriteId: string) {
  unwrap(await supabase.from('favorites').delete().eq('id', favoriteId));
}
