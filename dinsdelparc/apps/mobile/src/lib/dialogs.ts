import { Alert, Platform, type AlertButton } from 'react-native';

/**
 * Drop-in replacement for Alert.alert that also works on the web build
 * (React Native Web's Alert is a no-op).
 */
export function showAlert(title: string, message?: string, buttons?: AlertButton[]): void {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, buttons);
    return;
  }
  const text = message ? `${title}\n\n${message}` : title;
  const actions = (buttons ?? []).filter((b) => b.style !== 'cancel');
  if (actions.length === 0) {
    window.alert(text);
    buttons?.[0]?.onPress?.();
    return;
  }
  if (window.confirm(text)) actions[0]?.onPress?.();
  else buttons?.find((b) => b.style === 'cancel')?.onPress?.();
}
