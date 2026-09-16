import type { PropsWithChildren } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type TextProps, type TextStyle, type TextInputProps, type ViewStyle } from 'react-native';
import { ArrowRight, ShieldCheck, Sparkles, type LucideIcon } from 'lucide-react-native';

// The same palette, type families and card geometry as the web dashboard.
export const c = {
  ink: '#142321', soft: '#50615d', faint: '#82908c', line: '#e4ebe8', paper: '#f7faf8', white: '#ffffff',
  pine: '#123a32', pine2: '#1e5b4e', mint: '#dff3e9', mintStrong: '#a7dfc4', coral: '#e75854', coralSoft: '#fff0ed',
  violet: '#7055bd', violetSoft: '#f0edff', blue: '#387bc3', blueSoft: '#eaf4ff', amber: '#a27120', amberSoft: '#fff6df',
};
const textStyles = StyleSheet.create({
  body: { fontFamily: 'DMSans_400Regular', fontSize: 14, lineHeight: 21, color: c.ink },
  title: { fontFamily: 'Manrope_800ExtraBold', fontSize: 29, lineHeight: 37, letterSpacing: -1, color: c.ink },
  heading: { fontFamily: 'Manrope_700Bold', fontSize: 18, lineHeight: 25, letterSpacing: -.4, color: c.ink },
  label: { fontFamily: 'DMSans_600SemiBold', fontSize: 14, lineHeight: 20, color: c.ink },
  caption: { fontFamily: 'DMSans_400Regular', fontSize: 12, lineHeight: 18, color: c.soft },
  eyebrow: { fontFamily: 'DMSans_600SemiBold', fontSize: 10, lineHeight: 15, letterSpacing: 1.6, textTransform: 'uppercase', color: c.soft },
});
export function T({ kind = 'body', style, ...props }: TextProps & { kind?: keyof typeof textStyles }) {
  return <Text {...props} style={[textStyles[kind], style]} />;
}
export function Brand({ light = false }: { light?: boolean }) {
  return <View style={s.row}><View style={[s.brandMark, light && { backgroundColor: '#2b5b4d' }]}><Sparkles size={19} color={c.mint} strokeWidth={1.7} /></View><T kind="heading" style={{ color: light ? c.white : c.pine, fontSize: 15, letterSpacing: 1.2 }}>ABHAYA</T><T kind="eyebrow" style={{ color: light ? c.mintStrong : c.faint }}>1107</T></View>;
}
export function Card({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[s.card, style]}>{children}</View>;
}
export function Button({ title, onPress, icon: Icon, tone = 'primary', busy = false, disabled = false, style }: {
  title: string; onPress: () => void; icon?: LucideIcon; tone?: 'primary' | 'soft' | 'outline' | 'danger'; busy?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const color = tone === 'primary' || tone === 'danger' ? c.white : c.pine;
  return <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled: busy || disabled, busy }} disabled={busy || disabled} onPress={onPress}
    style={({ pressed }) => [s.button, tone === 'primary' ? { backgroundColor: c.pine } : tone === 'danger' ? { backgroundColor: c.coral } : tone === 'soft' ? { backgroundColor: c.mint } : { backgroundColor: c.white, borderWidth: 1, borderColor: c.line }, style, (busy || disabled) && { opacity: .5 }, pressed && { opacity: .75 }]}>
    {busy ? <ActivityIndicator color={color} /> : Icon ? <Icon size={17} color={color} strokeWidth={1.8} /> : null}<T kind="label" style={{ color, textAlign: 'center', flexShrink: 1 }}>{title}</T>
  </Pressable>;
}
export function IconButton({ icon: Icon, label, onPress, selected = false }: { icon: LucideIcon; label: string; onPress: () => void; selected?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [s.iconButton, selected && { backgroundColor: c.mint }, pressed && { opacity: .6 }]}><Icon size={21} color={c.pine} strokeWidth={1.7} /></Pressable>;
}
export function Badge({ label, tone = 'green' }: { label: string; tone?: 'green' | 'violet' | 'amber' | 'red' | 'muted' }) {
  const colors = { green: [c.mint, c.pine2], violet: [c.violetSoft, c.violet], amber: [c.amberSoft, c.amber], red: [c.coralSoft, c.coral], muted: [c.paper, c.soft] }[tone];
  return <View style={[s.badge, { backgroundColor: colors[0] }]}><View style={[s.dot, { backgroundColor: colors[1] }]} /><T kind="caption" style={{ color: colors[1], fontFamily: 'DMSans_600SemiBold', fontSize: 11 }}>{label}</T></View>;
}
export function SectionTitle({ eyebrow, title, action, onPress }: { eyebrow?: string; title: string; action?: string; onPress?: () => void }) {
  return <View style={s.sectionHead}><View style={s.flex}>{eyebrow && <T kind="eyebrow" style={{ marginBottom: 4 }}>{eyebrow}</T>}<T kind="heading">{title}</T></View>{action && onPress && <Pressable accessibilityRole="button" onPress={onPress} style={s.textLink}><T kind="caption" style={{ color: c.pine2, fontFamily: 'DMSans_600SemiBold' }}>{action}</T><ArrowRight size={14} color={c.pine2} /></Pressable>}</View>;
}
export function PageHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <View style={{ gap: 7, marginBottom: 5 }}><T kind="eyebrow">{eyebrow}</T><T kind="title">{title}</T><T style={{ color: c.soft }}>{description}</T></View>;
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return <View style={{ gap: 8 }}><T kind="label">{label}</T><TextInput {...props} accessibilityLabel={label} placeholderTextColor={c.faint} style={[s.input, props.style]} /></View>;
}
export function Empty({ title, description, icon: Icon = ShieldCheck }: { title: string; description: string; icon?: LucideIcon }) {
  return <View style={s.empty}><View style={s.softIcon}><Icon size={23} color={c.pine2} /></View><T kind="heading" style={{ textAlign: 'center' }}>{title}</T><T kind="caption" style={{ textAlign: 'center', maxWidth: 280 }}>{description}</T></View>;
}
export function Note({ children, icon: Icon = ShieldCheck, tone = 'green' }: PropsWithChildren<{ icon?: LucideIcon; tone?: 'green' | 'amber' }>) {
  return <View style={[s.note, tone === 'amber' && { backgroundColor: c.amberSoft }]}><Icon size={18} color={tone === 'amber' ? c.amber : c.pine2} style={{ marginTop: 2 }} /><T kind="caption" style={{ flex: 1, color: tone === 'amber' ? '#78581f' : c.pine2 }}>{children}</T></View>;
}
export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  return <View style={[s.avatar, { width: size, height: size, borderRadius: size / 2 }]}><T kind="label" style={{ color: c.pine2 }}>{name.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join('')}</T></View>;
}
export const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 }, flex: { flex: 1, minWidth: 0 },
  page: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 30, gap: 18, width: '100%', maxWidth: 680, alignSelf: 'center' },
  card: { borderWidth: 1, borderColor: c.line, borderRadius: 18, padding: 20, backgroundColor: c.white, gap: 16 },
  button: { minHeight: 48, paddingHorizontal: 17, paddingVertical: 12, borderRadius: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  brandMark: { width: 33, height: 33, borderRadius: 11, backgroundColor: c.pine, alignItems: 'center', justifyContent: 'center' },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  badge: { flexDirection: 'row', alignSelf: 'flex-start', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 20 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  textLink: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 44 },
  input: { minHeight: 50, borderWidth: 1, borderColor: c.line, borderRadius: 11, backgroundColor: c.white, paddingHorizontal: 14, paddingVertical: 13, color: c.ink, fontFamily: 'DMSans_400Regular', fontSize: 14 },
  empty: { alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16 },
  softIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: c.mint },
  note: { padding: 16, borderRadius: 13, backgroundColor: '#edf7f1', flexDirection: 'row', gap: 10 },
  avatar: { backgroundColor: c.mint, alignItems: 'center', justifyContent: 'center' },
  divider: { height: 1, backgroundColor: c.line },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
});

export const statusLabel = (status: string) => status.toLowerCase().replaceAll('_', ' ').replace(/^./, value => value.toUpperCase());
export const dateLabel = (value: string) => new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
export const timeLabel = (value: string) => new Date(value).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
