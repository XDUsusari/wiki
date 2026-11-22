import { useMutation, useQuery } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { AchievementsList, BadgesRow } from '../../components/AchievementsList';
import { Screen, Section, SkeletonList } from '../../components/ui';
import { useAuth } from '../../hooks/useAuth';
import { useT } from '../../i18n';
import { supabase } from '../../lib/supabase';
import { fetchUserBadgesAndAchievements } from '../../services/community';

export default function Achievements() {
  const { t } = useT();
  const { userId } = useAuth();
  const q = useQuery({ queryKey: ['achievements', userId], queryFn: () => fetchUserBadgesAndAchievements(userId!), enabled: !!userId });
  const refresh = useMutation({
    mutationFn: async () => {
      await supabase.rpc('refresh_my_achievements');
      await q.refetch();
    },
  });
  return (
    <Screen edges={[]} onRefresh={() => refresh.mutate()} refreshing={refresh.isPending}>
      <Stack.Screen options={{ title: t('profile.achievements') }} />
      <Section title={t('profile.badges')}>{q.data ? <BadgesRow badges={q.data.badges} /> : <SkeletonList rows={1} />}</Section>
      <Section title={t('profile.achievements')}>
        {q.data ? <AchievementsList achievements={q.data.achievements} progress={q.data.progress} /> : <SkeletonList rows={4} />}
      </Section>
    </Screen>
  );
}
