import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { Platform } from 'react-native';
import { removePushToken, savePushToken } from '../services/notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: true,
  }),
});

/** Asks for permission (only after an explicit user action) and stores the Expo push token. */
export async function enablePush(): Promise<'granted' | 'denied' | 'unsupported'> {
  if (Platform.OS === 'web' || !Device.isDevice) return 'unsupported';
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', { name: 'DinsDelParc', importance: Notifications.AndroidImportance.DEFAULT });
  }
  const current = await Notifications.getPermissionsAsync();
  const status = current.granted ? current : await Notifications.requestPermissionsAsync();
  if (!status.granted) return 'denied';
  const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
  const token = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
  await savePushToken(token.data, Platform.OS === 'ios' ? 'ios' : 'android');
  return 'granted';
}

export async function disablePush(): Promise<void> {
  if (Platform.OS === 'web' || !Device.isDevice) return;
  try {
    const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
    const token = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    await removePushToken(token.data);
  } catch {
    // no token registered on this device
  }
}

/** Opens the screen a notification refers to. */
export function routeForNotification(data: Record<string, unknown> | undefined): string | null {
  const type = data?.entity_type as string | undefined;
  const id = data?.entity_id as string | undefined;
  if (!type || !id) return '/notifications';
  switch (type) {
    case 'post':
      return `/post/${id}`;
    case 'forum_topic':
      return `/forum/topic/${id}`;
    case 'attraction':
      return `/attraction/${id}`;
    case 'itinerary':
      return `/planner/${id}`;
    case 'achievement':
    case 'badge':
      return '/profile/achievements';
    default:
      return '/notifications';
  }
}

export function listenToNotificationTaps(): () => void {
  if (Platform.OS === 'web') return () => undefined;
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const route = routeForNotification(response.notification.request.content.data as Record<string, unknown>);
    if (route) router.push(route as never);
  });
  return () => sub.remove();
}
