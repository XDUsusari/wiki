import { emailSchema } from '@dinsdelparc/shared';
import { useState } from 'react';
import { Button, Screen, Text, TextField } from '../../components/ui';
import { useT } from '../../i18n';
import { sendPasswordReset } from '../../services/account';

export default function Forgot() {
  const { t } = useT();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    const parsed = emailSchema.safeParse(email.trim());
    if (!parsed.success) return setError(t('validation.email'));
    setError(null);
    setBusy(true);
    try {
      await sendPasswordReset(parsed.data);
    } catch {
      // Same message either way: never reveal whether an account exists.
    } finally {
      setBusy(false);
      setSent(true);
    }
  };
  return (
    <Screen edges={[]} keyboard>
      <Text>{t('auth.forgotBody')}</Text>
      <TextField label={t('auth.email')} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" error={error} />
      {sent ? (
        <Text tone="success" accessibilityRole="alert">
          {t('auth.linkSent')}
        </Text>
      ) : null}
      <Button label={t('auth.sendLink')} fullWidth loading={busy} onPress={submit} />
    </Screen>
  );
}
