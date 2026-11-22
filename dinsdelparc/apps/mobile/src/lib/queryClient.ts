import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient } from '@tanstack/react-query';

/**
 * Query cache persisted to the device so reference content, favourites and
 * plans remain available offline. Live data (waiting times) is stored too, but
 * the UI re-validates its expiry (`valid_until`) before showing it.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 1000 * 60 * 60 * 24 * 7,
      retry: (count, error) => count < 2 && !String((error as Error)?.message).includes('permission'),
      networkMode: 'offlineFirst',
    },
    mutations: { networkMode: 'online' },
  },
});

export const queryPersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'dinsdelparc-query-cache-v1',
  throttleTime: 2000,
});

/** Only these query roots are persisted (no notifications, no other users' data). */
export const PERSISTED_ROOTS = new Set(['parks', 'park', 'area', 'attraction', 'venues', 'live', 'favorites', 'plans', 'plan', 'featured', 'announcements', 'settings', 'map', 'forum-categories', 'achievements']);
