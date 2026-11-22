import { Stack, useLocalSearchParams } from 'expo-router';
import { Card, Screen, Text } from '../../components/ui';
import { useT } from '../../i18n';
import { useAppTheme } from '../../theme';

const DOCS = {
  terms: { title: 'legal.termsTitle', body: 'legal.terms' },
  privacy: { title: 'legal.privacyTitle', body: 'legal.privacy' },
  cookies: { title: 'legal.cookiesTitle', body: 'legal.cookies' },
} as const;

export default function LegalDoc() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const { t } = useT();
  const { colors } = useAppTheme();
  const d = DOCS[(doc as keyof typeof DOCS) in DOCS ? (doc as keyof typeof DOCS) : 'terms'];
  return (
    <Screen edges={[]}>
      <Stack.Screen options={{ title: t(d.title) }} />
      <Text variant="h1">{t(d.title)}</Text>
      <Card style={{ backgroundColor: colors.warningSoft, borderColor: colors.warningSoft }}>
        <Text variant="caption" tone="warning">
          {t('legal.draftNotice')}
        </Text>
      </Card>
      {t(d.body)
        .split('\n\n')
        .map((p, i) => (
          <Text key={i}>{p}</Text>
        ))}
      <Text variant="caption" tone="muted">
        {t('app.disclaimer')}
      </Text>
    </Screen>
  );
}
