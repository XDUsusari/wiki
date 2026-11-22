import { signUpSchema, type TKey } from '@dinsdelparc/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Checkbox, EmptyState, Screen, Text, TextField } from '../../components/ui';
import { usePublicSettings } from '../../hooks/queries';
import { useT } from '../../i18n';
import { signUp } from '../../services/account';
import { useAppTheme } from '../../theme';
import { authErrorKey } from '../../lib/authErrors';

export default function SignUp() {
  const { t, locale } = useT();
  const { spacing } = useAppTheme();
  const settings = usePublicSettings();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    const parsed = signUpSchema.safeParse({ email: email.trim(), username, password, acceptTerms, marketingConsent: marketing });
    if (!parsed.success) {
      const m: Record<string, string> = {};
      for (const i of parsed.error.issues) m[String(i.path[0])] ??= t(i.message as TKey);
      return setErrors(m);
    }
    setErrors({});
    setBusy(true);
    try {
      await signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        username: parsed.data.username,
        marketingConsent: parsed.data.marketingConsent,
        locale,
        termsVersion: settings.data?.termsVersion ?? '2026-11',
      });
      setDone(true);
    } catch (e) {
      setErrors({ form: t(authErrorKey((e as Error).message)) });
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <Screen edges={[]}>
        <EmptyState icon="mail-unread-outline" title={t('auth.checkEmail')} action={t('auth.signIn')} onAction={() => router.replace('/auth/sign-in')} />
      </Screen>
    );
  }

  return (
    <Screen edges={[]} keyboard>
      <Text variant="h1">{t('auth.signUpTitle')}</Text>
      <TextField label={t('auth.email')} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" error={errors.email} />
      <TextField label={t('auth.username')} value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} maxLength={24} error={errors.username} hint={t('validation.username')} />
      <TextField label={t('auth.password')} value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" textContentType="newPassword" error={errors.password} hint={t('auth.passwordHint')} />
      <Checkbox label={t('auth.acceptTerms')} value={acceptTerms} onChange={setAcceptTerms} error={errors.acceptTerms} />
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Button label={t('settings.terms')} variant="ghost" size="sm" onPress={() => router.push('/legal/terms')} />
        <Button label={t('settings.privacyPolicy')} variant="ghost" size="sm" onPress={() => router.push('/legal/privacy')} />
      </View>
      <Checkbox label={t('auth.marketing')} value={marketing} onChange={setMarketing} />
      {errors.form ? <Text tone="danger" accessibilityRole="alert">{errors.form}</Text> : null}
      <Button label={t('auth.signUp')} fullWidth loading={busy} onPress={submit} />
      <Text variant="caption" tone="muted" align="center">
        {t('app.disclaimer')}
      </Text>
    </Screen>
  );
}
