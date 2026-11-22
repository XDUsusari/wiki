import { Ionicons } from '@expo/vector-icons';
import type { TKey } from '@dinsdelparc/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Logo } from '../components/Logo';
import { Button, Text, type IconName } from '../components/ui';
import { LANGUAGE_NAMES, LOCALES } from '@dinsdelparc/shared';
import { Chip } from '../components/ui/Chip';
import { useT } from '../i18n';
import { usePreferences } from '../stores/preferences';
import { useAppTheme } from '../theme';

const SLIDES: { icon: IconName; title: TKey; body: TKey; color: string }[] = [
  { icon: 'compass', title: 'onboarding.slide1Title', body: 'onboarding.slide1Body', color: '#1565C0' },
  { icon: 'calendar', title: 'onboarding.slide2Title', body: 'onboarding.slide2Body', color: '#00897B' },
  { icon: 'people', title: 'onboarding.slide3Title', body: 'onboarding.slide3Body', color: '#6A1B9A' },
];

export default function Onboarding() {
  const { t } = useT();
  const { colors, spacing, radii } = useAppTheme();
  const [index, setIndex] = useState(0);
  const complete = usePreferences((s) => s.completeOnboarding);
  const locale = usePreferences((s) => s.locale);
  const setLocale = usePreferences((s) => s.setLocale);
  const slide = SLIDES[index]!;
  const last = index === SLIDES.length - 1;

  const finish = () => {
    complete();
    router.replace('/');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, padding: spacing.xl, gap: spacing.xl }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Logo />
        <Button label={t('onboarding.skip')} variant="ghost" size="sm" onPress={finish} />
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.sm }} accessibilityRole="radiogroup">
        {LOCALES.map((l) => (
          <Chip key={l} label={LANGUAGE_NAMES[l]} selected={locale === l} onPress={() => setLocale(l)} />
        ))}
      </View>
      <View style={{ flex: 1, justifyContent: 'center', gap: spacing.lg }} accessibilityLiveRegion="polite">
        <View style={{ width: 96, height: 96, borderRadius: radii.xl, backgroundColor: slide.color, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={slide.icon} size={48} color="#fff" />
        </View>
        <Text variant="display">{t(slide.title)}</Text>
        <Text variant="body" tone="muted">
          {t(slide.body)}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 6, justifyContent: 'center' }} accessibilityElementsHidden>
        {SLIDES.map((_, i) => (
          <View key={i} style={{ width: i === index ? 22 : 8, height: 8, borderRadius: 4, backgroundColor: i === index ? colors.interactive : colors.border }} />
        ))}
      </View>
      <Text variant="caption" tone="muted" align="center">
        {t('onboarding.independent')} {t('app.disclaimer')}
      </Text>
      <Button label={last ? t('onboarding.start') : t('common.next')} fullWidth onPress={() => (last ? finish() : setIndex(index + 1))} />
    </SafeAreaView>
  );
}
