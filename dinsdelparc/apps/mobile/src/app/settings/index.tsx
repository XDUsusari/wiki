import { showAlert } from '../../lib/dialogs';
import { dbErrorKey, LANGUAGE_NAMES, LOCALES, type Locale, type TKey } from '@dinsdelparc/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system';
import { router, Stack } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useEffect, useState } from 'react';
import { Platform, Share, View } from 'react-native';
import { Divider, ListRow } from '../../components/Rows';
import { Button, Card, Chip, Screen, Section, Segmented, Text, TextField, ToggleRow } from '../../components/ui';
import { usePublicSettings } from '../../hooks/queries';
import { useAuth } from '../../hooks/useAuth';
import { useT } from '../../i18n';
import { disablePush, enablePush } from '../../lib/push';
import { deleteMyAccount, exportMyData, latestConsent, recordConsent, saveUserSettings } from '../../services/account';
import { fetchPreferences, updatePreferences } from '../../services/notifications';
import { usePreferences, type ThemePreference } from '../../stores/preferences';
import { useAppTheme } from '../../theme';

export default function Settings() {
  const { t } = useT();
  const { spacing } = useAppTheme();
  const { userId } = useAuth();
  const qc = useQueryClient();
  const locale = usePreferences((s) => s.locale);
  const theme = usePreferences((s) => s.theme);
  const setLocale = usePreferences((s) => s.setLocale);
  const setTheme = usePreferences((s) => s.setTheme);
  const settings = usePublicSettings();
  const prefs = useQuery({ queryKey: ['notification-prefs', userId], queryFn: () => fetchPreferences(userId!), enabled: !!userId });
  const marketing = useQuery({ queryKey: ['consent', 'marketing', userId], queryFn: () => latestConsent(userId!, 'marketing'), enabled: !!userId });
  const [confirmText, setConfirmText] = useState('');

  useEffect(() => {
    if (userId) void saveUserSettings(userId, { locale, theme }).catch(() => undefined);
  }, [userId, locale, theme]);

  const updatePref = useMutation({
    mutationFn: (patch: Parameters<typeof updatePreferences>[1]) => updatePreferences(userId!, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notification-prefs', userId] }),
    onError: (e) => showAlert(t(dbErrorKey((e as Error).message) as TKey)),
  });

  const togglePush = async (on: boolean) => {
    if (on) {
      const r = await enablePush();
      if (r !== 'granted') return showAlert(t('settings.pushDenied'));
      await recordConsent(userId!, 'push', true, settings.data?.termsVersion ?? '1');
    } else {
      await disablePush();
      await recordConsent(userId!, 'push', false, settings.data?.termsVersion ?? '1');
    }
    updatePref.mutate({ push_enabled: on });
  };

  const exportData = useMutation({
    mutationFn: exportMyData,
    onSuccess: async (data) => {
      const json = JSON.stringify(data, null, 2);
      if (Platform.OS !== 'web' && (await Sharing.isAvailableAsync())) {
        const file = new FileSystem.File(FileSystem.Paths.cache, `dinsdelparc-dades-${Date.now()}.json`);
        file.create({ overwrite: true });
        file.write(json);
        await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: t('settings.exportReady') });
      } else {
        await Share.share({ message: json });
      }
    },
    onError: (e) => showAlert(t(dbErrorKey((e as Error).message) as TKey)),
  });

  const removeAccount = useMutation({
    mutationFn: deleteMyAccount,
    onSuccess: () => {
      qc.clear();
      showAlert(t('settings.deleted'));
      router.replace('/');
    },
    onError: (e) => showAlert(t(dbErrorKey((e as Error).message) as TKey)),
  });

  const p = prefs.data;
  const prefRows: { key: keyof NonNullable<typeof p>; label: TKey }[] = [
    { key: 'social', label: 'settings.prefSocial' },
    { key: 'replies', label: 'settings.prefReplies' },
    { key: 'mentions', label: 'settings.prefMentions' },
    { key: 'news', label: 'settings.prefNews' },
    { key: 'park_info', label: 'settings.prefParkInfo' },
    { key: 'plans', label: 'settings.prefPlans' },
    { key: 'achievements', label: 'settings.prefAchievements' },
  ];

  return (
    <Screen edges={[]} keyboard>
      <Stack.Screen options={{ title: t('settings.title') }} />
      <Section title={t('settings.appearance')}>
        <Text variant="label">{t('settings.theme')}</Text>
        <Segmented<ThemePreference>
          options={[
            { value: 'system', label: t('settings.themeSystem') },
            { value: 'light', label: t('settings.themeLight') },
            { value: 'dark', label: t('settings.themeDark') },
          ]}
          value={theme}
          onChange={setTheme}
        />
        <Text variant="label">{t('settings.language')}</Text>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {LOCALES.map((l: Locale) => (
            <Chip key={l} label={LANGUAGE_NAMES[l]} selected={locale === l} onPress={() => setLocale(l)} />
          ))}
        </View>
      </Section>

      {userId && p ? (
        <Section title={t('settings.notifications')}>
          <Card>
            <ToggleRow label={t('settings.pushEnabled')} value={p.push_enabled} onChange={(v) => void togglePush(v)} />
            {prefRows.map((r) => (
              <View key={r.key}>
                <Divider />
                <ToggleRow label={t(r.label)} value={Boolean(p[r.key])} onChange={(v) => updatePref.mutate({ [r.key]: v })} />
              </View>
            ))}
          </Card>
        </Section>
      ) : null}

      {userId ? (
        <Section title={t('settings.privacy')}>
          <Card>
            <ListRow title={t('profile.editProfile')} subtitle={`${t('settings.showFavorites')} · ${t('settings.showStats')}`} icon="eye-outline" onPress={() => router.push('/profile/edit')} />
            <Divider />
            <ListRow title={t('settings.blocked')} icon="ban-outline" onPress={() => router.push('/settings/blocked')} />
            <Divider />
            <ToggleRow
              label={t('settings.marketing')}
              value={!!marketing.data}
              onChange={(v) =>
                void recordConsent(userId, 'marketing', v, settings.data?.termsVersion ?? '1').then(() => qc.invalidateQueries({ queryKey: ['consent', 'marketing', userId] }))
              }
            />
          </Card>
        </Section>
      ) : null}

      {userId ? (
        <Section title={t('settings.data')}>
          <Button label={t('settings.exportData')} icon="download-outline" variant="secondary" loading={exportData.isPending} onPress={() => exportData.mutate()} />
          <Card>
            <View style={{ gap: spacing.md }}>
              <Text variant="bodyStrong" tone="danger">
                {t('settings.deleteAccount')}
              </Text>
              <Text variant="small" tone="muted">
                {t('settings.deleteAccountBody')}
              </Text>
              <TextField label={t('settings.deleteAccountConfirm')} value={confirmText} onChangeText={setConfirmText} autoCapitalize="characters" />
              <Button
                label={t('settings.deleteAccount')}
                icon="trash-outline"
                variant="danger"
                disabled={confirmText.trim().toUpperCase() !== t('settings.deleteAccountWord')}
                loading={removeAccount.isPending}
                onPress={() => removeAccount.mutate()}
              />
            </View>
          </Card>
        </Section>
      ) : null}

      <Section title={t('settings.legal')}>
        <Card>
          <ListRow title={t('settings.terms')} icon="document-text-outline" onPress={() => router.push('/legal/terms')} />
          <Divider />
          <ListRow title={t('settings.privacyPolicy')} icon="lock-closed-outline" onPress={() => router.push('/legal/privacy')} />
          <Divider />
          <ListRow title={t('settings.cookies')} icon="information-circle-outline" onPress={() => router.push('/legal/cookies')} />
        </Card>
        <Text variant="caption" tone="muted">
          {t('app.disclaimer')}
        </Text>
        {settings.data?.contactEmail ? (
          <Text variant="caption" tone="muted">
            {settings.data.contactEmail}
          </Text>
        ) : null}
        <Text variant="caption" tone="muted">
          {t('settings.version', { version: Constants.expoConfig?.version ?? '0.1.0' })}
        </Text>
      </Section>
    </Screen>
  );
}
