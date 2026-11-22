import { dbErrorKey, forumTopicSchema, pickI18n, type TKey } from '@dinsdelparc/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Chip, Screen, Text, TextField } from '../../components/ui';
import { useAuth } from '../../hooks/useAuth';
import { useT } from '../../i18n';
import { createTopic, fetchCategories } from '../../services/forum';
import { useAppTheme } from '../../theme';

export default function NewTopic() {
  const params = useLocalSearchParams<{ category?: string }>();
  const { t, locale } = useT();
  const { spacing } = useAppTheme();
  const { canParticipate, can } = useAuth();
  const qc = useQueryClient();
  const cats = useQuery({ queryKey: ['forum-categories'], queryFn: fetchCategories });
  const [categoryId, setCategoryId] = useState<string | null>(params.category ?? null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: () => createTopic(categoryId!, title.trim(), body.trim()),
    onSuccess: (topicId) => {
      void qc.invalidateQueries({ queryKey: ['forum-topics'] });
      void qc.invalidateQueries({ queryKey: ['forum-categories'] });
      router.replace(`/forum/topic/${topicId}`);
    },
    onError: (e) => setError(t(dbErrorKey((e as Error).message) as TKey)),
  });
  if (!canParticipate) {
    return (
      <Screen edges={[]}>
        <Text>{t('profile.verifyEmail')}</Text>
      </Screen>
    );
  }
  const submit = () => {
    const parsed = forumTopicSchema.safeParse({ category_id: categoryId, title, body });
    if (!parsed.success) return setError(t(parsed.error.issues[0]!.message as TKey));
    setError(null);
    create.mutate();
  };
  return (
    <Screen edges={[]} keyboard>
      <Text variant="label">{t('forum.categories')}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {(cats.data ?? [])
          .filter((c) => !c.is_locked || can('forum.manage'))
          .map((c) => (
            <Chip key={c.id} label={pickI18n(c.name_i18n, locale) ?? c.slug} selected={categoryId === c.id} onPress={() => setCategoryId(c.id)} />
          ))}
      </View>
      <TextField label={t('forum.topicTitle')} value={title} onChangeText={setTitle} maxLength={140} />
      <TextField label={t('forum.topicBody')} value={body} onChangeText={setBody} multiline maxLength={10000} error={error} />
      <Button label={t('forum.create')} icon="checkmark" fullWidth loading={create.isPending} onPress={submit} />
    </Screen>
  );
}
