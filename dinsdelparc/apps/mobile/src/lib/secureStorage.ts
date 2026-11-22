import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Session storage for Supabase Auth.
 * iOS/Android: Keychain / Keystore via expo-secure-store. SecureStore values
 * are limited to ~2 KB, so long sessions are split into chunks.
 * Web: AsyncStorage (localStorage), the only option available in browsers.
 */
const CHUNK = 1800;
const keyFor = (key: string) => key.replace(/[^A-Za-z0-9._-]/g, '_');

async function secureGet(key: string): Promise<string | null> {
  const k = keyFor(key);
  const count = await SecureStore.getItemAsync(`${k}.n`);
  if (count == null) return SecureStore.getItemAsync(k);
  const parts: string[] = [];
  for (let i = 0; i < Number(count); i++) {
    const part = await SecureStore.getItemAsync(`${k}.${i}`);
    if (part == null) return null;
    parts.push(part);
  }
  return parts.join('');
}

async function secureRemove(key: string): Promise<void> {
  const k = keyFor(key);
  const count = await SecureStore.getItemAsync(`${k}.n`);
  if (count != null) {
    for (let i = 0; i < Number(count); i++) await SecureStore.deleteItemAsync(`${k}.${i}`);
    await SecureStore.deleteItemAsync(`${k}.n`);
  }
  await SecureStore.deleteItemAsync(k);
}

async function secureSet(key: string, value: string): Promise<void> {
  await secureRemove(key);
  const k = keyFor(key);
  if (value.length <= CHUNK) {
    await SecureStore.setItemAsync(k, value);
    return;
  }
  const n = Math.ceil(value.length / CHUNK);
  for (let i = 0; i < n; i++) await SecureStore.setItemAsync(`${k}.${i}`, value.slice(i * CHUNK, (i + 1) * CHUNK));
  await SecureStore.setItemAsync(`${k}.n`, String(n));
}

export const authStorage =
  Platform.OS === 'web'
    ? {
        getItem: (key: string) => AsyncStorage.getItem(key),
        setItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
        removeItem: (key: string) => AsyncStorage.removeItem(key),
      }
    : { getItem: secureGet, setItem: secureSet, removeItem: secureRemove };
