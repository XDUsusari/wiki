import { formatDate } from '@dinsdelparc/shared';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { View } from 'react-native';
import { AchievementsList, BadgesRow } from '../../components/AchievementsList';
import { ProfileHeader } from '../../components/ProfileHeader';
import { Divider, ListRow } from '../../components/Rows';
import { Button, Card, EmptyState, Screen, Section, SkeletonList, Text } from '../../components/ui';
import { Logo } from '../../components/Logo';
import { useAuth } from '../../hooks/useAuth';
import { useT } from '../../i18n';
import { fetchUserBadgesAndAchievements } from '../../services/community';
import { useAppTheme } from '../../theme';

export default function ProfileTab() {
  const { t, locale } = useT();
  const { colors, spacing } = useAppTheme();
  const { userId, profile, roles, emailVerified, suspendedUntil, signOut, refreshProfile } = useAuth();
  const gami = useQuery({ queryKey: ['achievements', userId], queryFn: () => fetchUserBadgesAndAchievements(userId!), enabled: !!userId });

  if (!userId) {
    return (
      <Screen>
        <Logo />
        <EmptyState icon="person-circle-outline" title={t('profile.guestTitle')} body={t('profile.guestBody')} />
        <Button label={t('auth.signIn')} fullWidth onPress={() => router.push('/auth/sign-in')} />
        <Button label={t('auth.signUp')} fullWidth variant="secondary" onPress={() => router.push('/auth/sign-up')} />
        <Card>
          <ListRow title={t('settings.title')} icon="settings-outline" onPress={() => router.push('/settings')} />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen onRefresh={() => { void refreshProfile(); void gami.refetch(); }}>
      {profile ? <ProfileHeader profile={profile} roles={roles} /> : <SkeletonList rows={2} height={90} />}
      {!emailVerified ? (
        <Card style={{ backgroundColor: colors.warningSoft, borderColor: colors.warningSoft }}>
          <Text variant="small" tone="warning">
            {t('profile.verifyEmail')}
          </Text>
        </Card>
      ) : null}
      {suspendedUntil ? (
        <Card style={{ backgroundColor: colors.dangerSoft, borderColor: colors.dangerSoft }}>
          <Text variant="small" tone="danger">
            {t('profile.suspended', { date: formatDate(suspendedUntil, locale) })}
          </Text>
        </Card>
      ) : null}
      <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
        <Button label={t('profile.editProfile')} icon="create-outline" variant="secondary" size="sm" onPress={() => router.push('/profile/edit')} />
        {profile ? <Button label={t('common.share')} icon="person-outline" variant="ghost" size="sm" onPress={() => router.push(`/user/${profile.username}`)} /> : null}
      </View>
      <Card>
        <ListRow title={t('profile.plans')} icon="calendar-outline" onPress={() => router.push('/planner')} />
        <Divider />
        <ListRow title={t('profile.favorites')} icon="heart-outline" onPress={() => router.push('/profile/favorites')} />
        <Divider />
        <ListRow title={t('notifications.title')} icon="notifications-outline" onPress={() => router.push('/notifications')} />
        <Divider />
        <ListRow title={t('forum.bookmarks')} icon="bookmark-outline" onPress={() => router.push('/forum/bookmarks')} />
        <Divider />
        <ListRow title={t('settings.title')} icon="settings-outline" onPress={() => router.push('/settings')} />
      </Card>
      <Section title={t('profile.badges')}>
        <BadgesRow badges={gami.data?.badges ?? []} />
      </Section>
      <Section title={t('profile.achievements')} action={t('common.seeAll')} onAction={() => router.push('/profile/achievements')}>
        {gami.data ? <AchievementsList achievements={gami.data.achievements.slice(0, 3)} progress={gami.data.progress} /> : <SkeletonList rows={2} />}
      </Section>
      <Button label={t('profile.signOut')} icon="log-out-outline" variant="ghost" onPress={() => void signOut()} />
    </Screen>
  );
}
