import { useState } from 'react';
import type { ReactNode } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
  useColorScheme,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import type { TextInputProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { tokens } from '@abhaya/ui';
import { useQuery } from '@tanstack/react-query';
import { dashboardSchema } from '@abhaya/validation';
import { api } from './session';
import { queryClient } from './state';
export function usePalette() {
  const system = useColorScheme();
  const profile = queryClient.getQueryData<import('@abhaya/types').Dashboard>(['dashboard'])?.user;
  return tokens[
    (profile?.theme === 'system' || !profile?.theme ? system : profile.theme) === 'dark'
      ? 'dark'
      : 'light'
  ];
}
export const useDashboard = () =>
  useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.call('GET', '/dashboard', dashboardSchema),
    refetchInterval: 10000,
  });
export function Txt({
  children,
  kind = 'body',
  color,
  style,
}: {
  children: ReactNode;
  kind?: 'body' | 'small' | 'title' | 'display' | 'eyebrow';
  color?: string;
  style?: import('react-native').StyleProp<import('react-native').TextStyle>;
}) {
  const c = usePalette();
  return (
    <Text
      style={[
        {
          color: color ?? (kind === 'small' || kind === 'eyebrow' ? c.muted : c.ink),
          fontSize:
            kind === 'display'
              ? 34
              : kind === 'title'
                ? 23
                : kind === 'small'
                  ? 12
                  : kind === 'eyebrow'
                    ? 10
                    : 16,
          lineHeight:
            kind === 'display'
              ? 42
              : kind === 'title'
                ? 30
                : kind === 'small'
                  ? 20
                  : kind === 'eyebrow'
                    ? 17
                    : 25,
          fontWeight: kind === 'eyebrow' ? '700' : kind === 'title' ? '600' : '400',
          letterSpacing: kind === 'eyebrow' ? 1.7 : kind === 'display' ? -0.8 : 0,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
export function Screen({
  children,
  refreshing,
  onRefresh,
}: {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  const c = usePalette();
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: c.background }}
      edges={['top', 'left', 'right']}
    >
      <ScrollView
        contentContainerStyle={{ padding: 22, paddingBottom: 45, gap: 20 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={c.accent} />
          ) : undefined
        }
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}
export function Card({ children, danger = false }: { children: ReactNode; danger?: boolean }) {
  const c = usePalette();
  return (
    <View
      style={{
        backgroundColor: danger ? c.dangerSoft : c.surface,
        borderWidth: 1,
        borderColor: c.border,
        borderRadius: 22,
        padding: 22,
        gap: 16,
      }}
    >
      {children}
    </View>
  );
}
export function Row({ children }: { children: ReactNode }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        flexWrap: 'wrap',
      }}
    >
      {children}
    </View>
  );
}
export function Button({
  label,
  onPress,
  busy = false,
  secondary = false,
  danger = false,
  disabled = false,
  testID,
}: {
  label: string;
  onPress: () => void;
  busy?: boolean;
  secondary?: boolean;
  danger?: boolean;
  disabled?: boolean;
  testID?: string;
}) {
  const c = usePalette();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 50,
        padding: 14,
        borderRadius: 13,
        backgroundColor: secondary ? 'transparent' : danger ? c.danger : c.accent,
        borderWidth: 1,
        borderColor: secondary ? c.border : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 8,
        opacity: disabled || busy ? 0.5 : pressed ? 0.8 : 1,
      })}
    >
      {busy && <ActivityIndicator color={secondary ? c.accent : c.surface} />}
      <Text style={{ fontSize: 14, fontWeight: '600', color: secondary ? c.ink : c.surface }}>
        {label}
      </Text>
    </Pressable>
  );
}
export function Input({ label, ...props }: TextInputProps & { label: string }) {
  const c = usePalette();
  return (
    <View style={{ gap: 8 }}>
      <Txt kind="small">{label}</Txt>
      <TextInput
        {...props}
        accessibilityLabel={label}
        placeholderTextColor={c.muted}
        style={[
          {
            backgroundColor: c.surface,
            color: c.ink,
            borderWidth: 1,
            borderColor: c.border,
            borderRadius: 12,
            padding: 14,
            fontSize: 16,
            minHeight: 50,
          },
          props.style,
        ]}
      />
    </View>
  );
}
export function Check({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const c = usePalette();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      onPress={() => onChange(!value)}
      style={{
        flexDirection: 'row',
        gap: 10,
        alignItems: 'flex-start',
        minHeight: 44,
        paddingVertical: 8,
      }}
    >
      <View
        style={{
          marginTop: 3,
          width: 21,
          height: 21,
          borderWidth: 1,
          borderColor: c.accent,
          borderRadius: 5,
          backgroundColor: value ? c.accent : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: c.surface, fontWeight: '700' }}>{value ? '✓' : ''}</Text>
      </View>
      <Txt kind="small" style={{ flex: 1 }}>
        {label}
      </Txt>
    </Pressable>
  );
}
export function Banner({ children, error = false }: { children: ReactNode; error?: boolean }) {
  const c = usePalette();
  return (
    <View
      accessibilityRole="alert"
      style={{
        padding: 14,
        borderRadius: 12,
        backgroundColor: error ? c.dangerSoft : c.elevated,
        borderWidth: 1,
        borderColor: c.border,
      }}
    >
      <Txt kind="small" color={error ? c.danger : c.ink}>
        {children}
      </Txt>
    </View>
  );
}
export function Loading() {
  return (
    <Screen>
      <ActivityIndicator />
      <Txt>Opening your safety space…</Txt>
    </Screen>
  );
}
export function Heading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <View style={{ gap: 9 }}>
      <Txt kind="eyebrow">{eyebrow}</Txt>
      <Txt kind="display">{title}</Txt>
      {description && <Txt kind="small">{description}</Txt>}
    </View>
  );
}
export function useAction() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState('');
  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed. Please try again.');
    } finally {
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      await queryClient.invalidateQueries({ queryKey: ['history'] });
      setBusy(false);
    }
  };
  return { run, busy, error, message, setMessage };
}
export function Feedback({ action }: { action: ReturnType<typeof useAction> }) {
  return (
    <>
      {action.error && <Banner error>{action.error}</Banner>}
      {action.message && <Banner>{action.message}</Banner>}
    </>
  );
}
export const styles = StyleSheet.create({ gap: { gap: 16 } });
