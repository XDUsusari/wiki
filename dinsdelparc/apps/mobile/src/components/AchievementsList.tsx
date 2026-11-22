import { Ionicons } from '@expo/vector-icons';
import { pickI18n, type Achievement, type Badge, type UserAchievement } from '@dinsdelparc/shared';
import { View } from 'react-native';
import { useT } from '../i18n';
import { useAppTheme } from '../theme';
import { Card, Pill, Text, type IconName } from './ui';

export function BadgesRow({ badges }: { badges: { awarded_at: string; badge: Badge }[] }) {
  const { t, locale } = useT();
  const { spacing } = useAppTheme();
  if (!badges.length) return <Text variant="small" tone="muted">{t('profile.noBadges')}</Text>;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
      {badges.map(({ badge }) => (
        <View key={badge.id} accessible accessibilityLabel={`${pickI18n(badge.name_i18n, locale)}. ${pickI18n(badge.description_i18n, locale) ?? ''}`} style={{ alignItems: 'center', width: 88, gap: 4 }}>
          <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: badge.color, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={badge.icon as IconName} size={26} color="#fff" />
          </View>
          <Text variant="caption" align="center" numberOfLines={2}>
            {pickI18n(badge.name_i18n, locale)}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function AchievementsList({ achievements, progress }: { achievements: Achievement[]; progress: UserAchievement[] }) {
  const { t, locale } = useT();
  const { colors, spacing, radii } = useAppTheme();
  return (
    <View style={{ gap: spacing.md }}>
      {achievements.map((a) => {
        const p = progress.find((x) => x.achievement_id === a.id);
        const unlocked = !!p?.unlocked_at;
        const value = Math.min(p?.progress ?? 0, a.threshold);
        return (
          <Card key={a.id} style={{ opacity: unlocked ? 1 : 0.85 }}>
            <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
              <View style={{ width: 44, height: 44, borderRadius: radii.md, backgroundColor: unlocked ? colors.successSoft : colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={a.icon as IconName} size={22} color={unlocked ? colors.success : colors.textMuted} />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Text variant="bodyStrong">{pickI18n(a.name_i18n, locale)}</Text>
                  {a.is_challenge ? <Pill label={t('profile.challenge')} fg={colors.community} bg={colors.communitySoft} /> : null}
                </View>
                <Text variant="caption" tone="muted">
                  {pickI18n(a.description_i18n, locale)}
                </Text>
                <View accessible accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: a.threshold, now: value }} style={{ height: 6, borderRadius: 3, backgroundColor: colors.surfaceAlt, overflow: 'hidden' }}>
                  <View style={{ width: `${(value / a.threshold) * 100}%`, height: '100%', backgroundColor: unlocked ? colors.success : colors.interactive }} />
                </View>
              </View>
              <Text variant="caption" tone={unlocked ? 'success' : 'muted'}>
                {unlocked ? t('profile.unlocked') : t('profile.achievementsProgress', { progress: value, threshold: a.threshold })}
              </Text>
            </View>
          </Card>
        );
      })}
    </View>
  );
}
