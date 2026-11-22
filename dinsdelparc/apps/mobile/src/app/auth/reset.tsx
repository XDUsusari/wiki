import { passwordSchema, type TKey } from '@dinsdelparc/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Button, Loading, Screen, Text, TextField } from '../../components/ui';
import { useT } from '../../i18n';
import { exchangeCode, updatePassword } from '../../services/account';

/** Opened from the recovery e-mail: dinsdelparc://auth/reset?code=… (PKCE). */
export default function Reset() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const { t } = useT();
  const [ready, setReady] = useState(!code);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!code) return;
    exchangeCode(code)
      .then(() => setReady(true))
      .catch(() => {
        setError(t('errors.generic'));
        setReady(true);
      });
  }, [code, t]);
  if (!ready) return <Loading />;
  const submit = async () => {
    const parsed = passwordSchema.safeParse(password);
    if (!parsed.success) return setError(t(parsed.error.issues[0]!.message as TKey));
    setBusy(true);
    try {
      await updatePassword(parsed.data);
      router.replace('/');
    } catch {
      setError(t('errors.generic'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen edges={[]} keyboard>
      <TextField label={t('auth.newPassword')} value={password} onChangeText={setPassword} secureTextEntry textContentType="newPassword" error={error} hint={t('auth.passwordHint')} />
      <Button label={t('common.save')} fullWidth loading={busy} onPress={submit} />
      <Text variant="caption" tone="muted">
        {t('auth.resetTitle')}
      </Text>
    </Screen>
  );
}
