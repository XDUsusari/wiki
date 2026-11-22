import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, View, type ScrollViewProps } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { useAppTheme } from '../../theme';
import { OfflineBanner } from '../OfflineBanner';

/** Standard screen container: safe area, theme background, optional scroll + pull to refresh. */
export function Screen({
  children,
  scroll = true,
  edges = ['top'],
  refreshing,
  onRefresh,
  contentPadding = true,
  keyboard = false,
  scrollProps,
}: {
  children: ReactNode;
  scroll?: boolean;
  edges?: Edge[];
  refreshing?: boolean;
  onRefresh?: () => void;
  contentPadding?: boolean;
  keyboard?: boolean;
  scrollProps?: ScrollViewProps;
}) {
  const { colors, spacing } = useAppTheme();
  const padding = contentPadding ? { padding: spacing.lg, paddingBottom: spacing.xxxl } : undefined;
  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[padding, { gap: spacing.xl }]}
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.interactive} /> : undefined}
      {...scrollProps}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, padding]}>{children}</View>
  );
  return (
    <SafeAreaView edges={edges} style={[styles.flex, { backgroundColor: colors.background }]}>
      <OfflineBanner />
      {keyboard ? (
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {body}
        </KeyboardAvoidingView>
      ) : (
        body
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
