import { formatDate, levelProgress, type AppRole, type Profile } from '@dinsdelparc/shared';
import { highestRole } from '@dinsdelparc/shared';
import { View } from 'react-native';
import { useT } from '../i18n';
import { useAppTheme } from '../theme';
import { Avatar } from './Avatar';
import { Pill, Text } from './ui';

export function ProfileHeader({ profile, roles }: { profile: Profile; roles: AppRole[] }) {
  const { t, locale } = useT();
  const { colors, spacing, radii } = useAppTheme();
  const lp = levelProgress(profile.xp);
  const top = highestRole(roles);
  const isTeam = !['user', 'verified_user'].includes(top);
  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', gap: spacing.lg, alignItems: 'center' }}>
        <Avatar path={profile.avatar_path} name={profile.display_name || profile.username} size={76} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text variant="h2">{profile.display_name || profile.username}</Text>
          <Text variant="small" tone="muted">
            @{profile.username}
          </Text>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            <Pill label={t('profile.level', { level: profile.level })} fg={colors.interactive} bg={colors.interactiveSoft} icon="star" />
            {isTeam || top === 'verified_user' ? (
              <Pill label={t(`admin.users.roleNames.${top}`)} fg={colors.community} bg={colors.communitySoft} icon="shield-checkmark" />
            ) : null}
          </View>
        </View>
      </View>
      {profile.bio ? <Text>{profile.bio}</Text> : null}
      <Text variant="caption" tone="muted">
        {t('profile.memberSince', { date: formatDate(profile.created_at, locale, { month: 'long', year: 'numeric' }) })}
      </Text>
      <View accessible accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(lp.ratio * 100) }} style={{ gap: 4 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text variant="label">{t('profile.xp', { xp: profile.xp })}</Text>
          <Text variant="caption" tone="muted">
            {t('profile.xpToNext', { remaining: lp.remaining, level: lp.level + 1 })}
          </Text>
        </View>
        <View style={{ height: 8, borderRadius: radii.pill, backgroundColor: colors.surfaceAlt, overflow: 'hidden' }}>
          <View style={{ width: `${Math.round(lp.ratio * 100)}%`, height: '100%', backgroundColor: colors.interactive }} />
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        {[
          { label: t('profile.posts'), value: profile.posts_count },
          { label: t('profile.followers'), value: profile.followers_count },
          { label: t('profile.following'), value: profile.following_count },
        ].map((s) => (
          <View key={s.label} style={{ flex: 1, alignItems: 'center', padding: spacing.md, backgroundColor: colors.surfaceAlt, borderRadius: radii.md }} accessible accessibilityLabel={`${s.label}: ${s.value}`}>
            <Text variant="h3">{s.value}</Text>
            <Text variant="caption" tone="muted">
              {s.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
