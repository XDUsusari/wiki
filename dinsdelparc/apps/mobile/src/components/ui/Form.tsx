import { MIN_TOUCH_TARGET } from '@dinsdelparc/shared';
import { useState } from 'react';
import { Pressable, StyleSheet, Switch, TextInput, View, type TextInputProps } from 'react-native';
import { useAppTheme } from '../../theme';
import { Text } from './Text';

export function TextField({
  label,
  error,
  hint,
  multiline,
  style,
  ...rest
}: TextInputProps & { label: string; error?: string | null; hint?: string }) {
  const { colors, radii, typography, spacing } = useAppTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: spacing.xs }}>
      <Text variant="label">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={hint}
        placeholderTextColor={colors.textMuted}
        onFocus={(e) => {
          setFocused(true);
          rest.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          rest.onBlur?.(e);
        }}
        multiline={multiline}
        style={[
          typography.body,
          {
            color: colors.text,
            backgroundColor: colors.surfaceAlt,
            borderColor: error ? colors.danger : focused ? colors.interactive : colors.border,
            borderWidth: focused || error ? 2 : 1,
            borderRadius: radii.md,
            paddingHorizontal: spacing.md,
            paddingVertical: multiline ? spacing.md : 0,
            minHeight: multiline ? 110 : MIN_TOUCH_TARGET + 4,
            textAlignVertical: multiline ? 'top' : 'center',
          },
          style,
        ]}
        {...rest}
      />
      {error ? (
        <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" tone="muted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

export function ToggleRow({ label, value, onChange, description, disabled }: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  description?: string;
  disabled?: boolean;
}) {
  const { colors, spacing } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled: !!disabled }}
      accessibilityLabel={label}
      onPress={() => !disabled && onChange(!value)}
      style={[styles.row, { gap: spacing.md, opacity: disabled ? 0.5 : 1 }]}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="body">{label}</Text>
        {description ? (
          <Text variant="caption" tone="muted">
            {description}
          </Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ true: colors.interactive, false: colors.border }}
        importantForAccessibility="no"
        accessibilityElementsHidden
      />
    </Pressable>
  );
}

export function Checkbox({ label, value, onChange, error }: { label: string; value: boolean; onChange: (v: boolean) => void; error?: string | null }) {
  const { colors, radii, spacing } = useAppTheme();
  return (
    <View style={{ gap: 4 }}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: value }}
        accessibilityLabel={label}
        onPress={() => onChange(!value)}
        style={[styles.row, { gap: spacing.md }]}
      >
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: radii.sm - 2,
            borderWidth: 2,
            borderColor: error ? colors.danger : value ? colors.interactive : colors.textMuted,
            backgroundColor: value ? colors.interactive : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {value ? <Text style={{ color: colors.interactiveOn, fontSize: 14, lineHeight: 16 }}>✓</Text> : null}
        </View>
        <Text variant="small" style={{ flex: 1 }}>
          {label}
        </Text>
      </Pressable>
      {error ? (
        <Text variant="caption" tone="danger">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  const { colors, radii } = useAppTheme();
  return (
    <View accessibilityRole="tablist" style={[styles.segment, { backgroundColor: colors.surfaceAlt, borderRadius: radii.md, borderColor: colors.border }]}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(o.value)}
            style={[styles.segmentItem, { backgroundColor: active ? colors.surfaceRaised : 'transparent', borderRadius: radii.md - 2 }]}
          >
            <Text variant="label" style={{ color: active ? colors.text : colors.textMuted }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: MIN_TOUCH_TARGET },
  segment: { flexDirection: 'row', padding: 3, borderWidth: 1 },
  segmentItem: { flex: 1, minHeight: 38, alignItems: 'center', justifyContent: 'center' },
});
