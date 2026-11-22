import { signInSchema, type TKey } from '@dinsdelparc/shared';
import { authErrorKey } from '../../lib/authErrors';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Logo } from '../../components/Logo';
import { Button, Screen, Text, TextField } from '../../components/ui';
import { useT } from '../../i18n';
import { resendVerification, signIn } from '../../services/account';
import { useAppTheme } from '../../theme';

export default function SignIn() {
  const { t } = useT();
  const { spacing } = useAppTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [unconfirmed, setUnconfirmed] = useState(false);

  const submit = async () => {
    const parsed = signInSchema.safeParse({ email: email.trim(), password });
    if (!parsed.success) {
      const m: Record<string, string> = {};
      for (const i of parsed.error.issues) m[String(i.path[0])] = t(i.message as TKey);
      return setErrors(m);
    }
    setErrors({});
    setBusy(true);
    try {
      await signIn(parsed.data.email, parsed.data.password);
      if (router.canGoBack()) router.back();
      else router.replace('/');
    } catch (e) {
      const key = authErrorKey((e as Error).message);
      setUnconfirmed(key === 'errors.emailNotConfirmed');
      setErrors({ form: t(key) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen edges={[]} keyboard>
      <View style={{ alignItems: 'center', gap: spacing.md, marginTop: spacing.lg }}>
        <Logo size={48} />
        <Text variant="h1" align="center">
          {t('auth.signInTitle')}
        </Text>
      </View>
      <TextField label={t('auth.email')} value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" error={errors.email} />
      <TextField label={t('auth.password')} value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" textContentType="password" error={errors.password} />
      {errors.form ? (
        <Text tone="danger" accessibilityRole="alert">
          {errors.form}
        </Text>
      ) : null}
      {unconfirmed ? <Button label={t('auth.resendVerification')} variant="ghost" size="sm" onPress={() => void resendVerification(email.trim()).then(() => setErrors({ form: t('auth.checkEmail') }))} /> : null}
      <Button label={t('auth.signIn')} fullWidth loading={busy} onPress={submit} />
      <Button label={t('auth.forgot')} variant="ghost" onPress={() => router.push('/auth/forgot')} />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
        <Text variant="small" tone="muted">
          {t('auth.noAccount')}
        </Text>
        <Button label={t('auth.signUp')} variant="ghost" size="sm" onPress={() => router.replace('/auth/sign-up')} />
      </View>
    </Screen>
  );
}
