import { Ionicons } from '@expo/vector-icons';
import {
  checkImage,
  dbErrorKey,
  MAX_IMAGES_PER_POST,
  MAX_POST_IMAGE_BYTES,
  POST_CATEGORIES,
  postSchema,
  type PostCategory,
  type TKey,
} from '@dinsdelparc/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { Button, Card, Chip, Screen, Text, TextField } from '../../components/ui';
import { useAuth } from '../../hooks/useAuth';
import { useT } from '../../i18n';
import { successFeedback } from '../../lib/haptics';
import { createPost, type NewImage } from '../../services/community';
import { useAppTheme } from '../../theme';

export default function NewPost() {
  const { t } = useT();
  const { spacing, colors, radii } = useAppTheme();
  const { userId, canParticipate } = useAuth();
  const qc = useQueryClient();
  const params = useLocalSearchParams<{ attraction?: string }>();
  const [category, setCategory] = useState<PostCategory>('experiences');
  const [body, setBody] = useState('');
  const [images, setImages] = useState<NewImage[]>([]);
  const [error, setError] = useState<string | null>(null);

  const publish = useMutation({
    mutationFn: () => createPost(userId!, { category, body: body.trim(), attraction_id: params.attraction ?? null }, images),
    onSuccess: (post) => {
      successFeedback();
      void qc.invalidateQueries({ queryKey: ['feed'] });
      if (post.moderation_status === 'pending_review') Alert.alert(t('community.pendingReview'));
      router.replace(`/post/${post.id}`);
    },
    onError: (e) => setError(t(dbErrorKey((e as Error).message) as TKey)),
  });

  if (!userId || !canParticipate) {
    return (
      <Screen edges={[]}>
        <Text>{userId ? t('profile.verifyEmail') : t('common.signInRequired')}</Text>
        {!userId ? <Button label={t('common.signIn')} onPress={() => router.replace('/auth/sign-in')} /> : null}
      </Screen>
    );
  }

  const pick = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_IMAGES_PER_POST - images.length,
      quality: 0.8,
      exif: false,
    });
    if (res.canceled) return;
    const accepted: NewImage[] = [];
    for (const a of res.assets) {
      const mime = a.mimeType ?? (a.uri.endsWith('.png') ? 'image/png' : 'image/jpeg');
      const err = checkImage({ mimeType: mime, fileSize: a.fileSize ?? null }, MAX_POST_IMAGE_BYTES);
      if (err) {
        Alert.alert(t(err));
        continue;
      }
      accepted.push({ uri: a.uri, mimeType: mime, width: a.width, height: a.height });
    }
    setImages((prev) => [...prev, ...accepted].slice(0, MAX_IMAGES_PER_POST));
  };

  const submit = () => {
    const parsed = postSchema.safeParse({ category, body });
    if (!parsed.success) return setError(t(parsed.error.issues[0]!.message as TKey));
    setError(null);
    publish.mutate();
  };

  return (
    <Screen edges={[]} keyboard>
      <Text variant="label">{t('community.category')}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {POST_CATEGORIES.map((c) => (
          <Chip key={c} label={t(`community.categories.${c}`)} selected={category === c} onPress={() => setCategory(c)} />
        ))}
      </View>
      <TextField label={t('community.composer')} value={body} onChangeText={setBody} multiline maxLength={5000} error={error} hint={`${body.length}/5000`} />
      <View style={{ gap: spacing.sm }}>
        <Text variant="label">{t('community.addPhotos')}</Text>
        <Text variant="caption" tone="muted">
          {t('community.photosLimit', { count: MAX_IMAGES_PER_POST })}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {images.map((img, i) => (
            <View key={img.uri} style={{ width: '48%', gap: 4 }}>
              <View>
                <Image source={{ uri: img.uri }} style={{ width: '100%', aspectRatio: 1, borderRadius: radii.md }} contentFit="cover" />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('common.delete')}
                  onPress={() => setImages((prev) => prev.filter((_, j) => j !== i))}
                  style={{ position: 'absolute', top: 6, right: 6, backgroundColor: colors.overlay, borderRadius: 16, padding: 6 }}
                >
                  <Ionicons name="close" size={16} color="#fff" />
                </Pressable>
              </View>
              <TextField
                label={t('community.altText')}
                value={img.altText ?? ''}
                maxLength={300}
                onChangeText={(v) => setImages((prev) => prev.map((p, j) => (j === i ? { ...p, altText: v } : p)))}
              />
            </View>
          ))}
        </View>
        {images.length < MAX_IMAGES_PER_POST ? <Button label={t('community.addPhotos')} icon="images-outline" variant="secondary" onPress={pick} /> : null}
      </View>
      <Card style={{ backgroundColor: colors.surfaceAlt }}>
        <Text variant="label">{t('community.guidelines')}</Text>
        <Text variant="caption" tone="muted">
          {t('community.guidelinesBody')}
        </Text>
      </Card>
      <Button label={t('community.publish')} icon="paper-plane-outline" fullWidth loading={publish.isPending} onPress={submit} />
    </Screen>
  );
}
