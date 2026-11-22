import { showAlert } from '../../lib/dialogs';
import { checkImage, dbErrorKey, MAX_AVATAR_BYTES, profileSchema, type TKey } from '@dinsdelparc/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Avatar } from '../../components/Avatar';
import { Button, Chip, Screen, Text, TextField, ToggleRow } from '../../components/ui';
import { useAuth } from '../../hooks/useAuth';
import { useT } from '../../i18n';
import { successFeedback } from '../../lib/haptics';
import { updateProfile, uploadAvatar } from '../../services/account';
import { fetchParks } from '../../services/content';
import { useAppTheme } from '../../theme';

export default function EditProfile() {
  const { t } = useT();
  const { spacing } = useAppTheme();
  const { userId, profile, refreshProfile } = useAuth();
  const qc = useQueryClient();
  const parks = useQuery({ queryKey: ['parks'], queryFn: fetchParks });
  const [username, setUsername] = useState(profile?.username ?? '');
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [park, setPark] = useState<string | null>(profile?.favourite_park_slug ?? null);
  const [showFavorites, setShowFavorites] = useState(profile?.show_favorites ?? true);
  const [showStats, setShowStats] = useState(profile?.show_stats ?? true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  if (!userId || !profile) return null;

  const pickAvatar = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (res.canceled || !res.assets[0]) return;
    const a = res.assets[0];
    const mime = a.mimeType ?? 'image/jpeg';
    const err = checkImage({ mimeType: mime, fileSize: a.fileSize ?? null }, MAX_AVATAR_BYTES);
    if (err) return showAlert(t(err));
    setUploading(true);
    try {
      await uploadAvatar(userId, a.uri, mime);
      await refreshProfile();
    } catch (e) {
      showAlert(t(dbErrorKey((e as Error).message) as TKey));
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    const parsed = profileSchema.safeParse({
      username,
      display_name: displayName.trim() || null,
      bio: bio.trim() || null,
      favourite_park_slug: park,
      show_favorites: showFavorites,
      show_stats: showStats,
    });
    if (!parsed.success) {
      const m: Record<string, string> = {};
      for (const i of parsed.error.issues) m[String(i.path[0])] = t(i.message as TKey);
      return setErrors(m);
    }
    setErrors({});
    setSaving(true);
    try {
      await updateProfile(userId, parsed.data);
      await refreshProfile();
      void qc.invalidateQueries({ queryKey: ['profile'] });
      successFeedback();
      showAlert(t('profile.saved'));
      router.back();
    } catch (e) {
      const key = dbErrorKey((e as Error).message);
      setErrors(key === 'errors.duplicate' ? { username: t('errors.duplicate') } : { form: t(key as TKey) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen edges={[]} keyboard>
      <View style={{ alignItems: 'center', gap: spacing.sm }}>
        <Avatar path={profile.avatar_path} name={profile.display_name || profile.username} size={96} />
        <Button label={t('profile.changeAvatar')} icon="camera-outline" variant="secondary" size="sm" loading={uploading} onPress={pickAvatar} />
      </View>
      <TextField label={t('profile.username')} value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} maxLength={24} error={errors.username} hint={t('validation.username')} />
      <TextField label={t('profile.displayName')} value={displayName} onChangeText={setDisplayName} maxLength={60} error={errors.display_name} />
      <TextField label={t('profile.bio')} value={bio} onChangeText={setBio} multiline maxLength={400} error={errors.bio} hint={`${bio.length}/400`} />
      <View style={{ gap: spacing.sm }}>
        <Text variant="label">{t('profile.favouritePark')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {(parks.data ?? []).map((p) => (
            <Chip key={p.id} label={p.name} color={p.accent_color} selected={park === p.slug} onPress={() => setPark(park === p.slug ? null : p.slug)} />
          ))}
        </View>
      </View>
      <ToggleRow label={t('settings.showFavorites')} value={showFavorites} onChange={setShowFavorites} />
      <ToggleRow label={t('settings.showStats')} value={showStats} onChange={setShowStats} />
      {errors.form ? <Text tone="danger">{errors.form}</Text> : null}
      <Button label={t('common.save')} icon="checkmark" fullWidth loading={saving} onPress={save} />
    </Screen>
  );
}
