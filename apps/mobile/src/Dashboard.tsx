import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { ArrowRight, Bell, Camera, Check, Clock3, LifeBuoy, LockKeyhole, MapPin, Phone, Route, ShieldCheck, Siren, Timer, UsersRound, type LucideIcon } from 'lucide-react-native';
import { apiRequest } from './api';
import type { Emergency, SafetyTimer, ScreenProps } from './models';
import { Badge, Button, Card, Empty, Note, SectionTitle, T, c, s, timeLabel } from './ui';

export function TimerClock({ timer, large = false }: { timer: SafetyTimer; large?: boolean }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const interval = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(interval); }, []);
  const remaining = Math.max(0, Math.ceil((Date.parse(timer.status === 'GRACE' && timer.graceUntil ? timer.graceUntil : timer.expiresAt) - now) / 1000));
  return <View style={[d.clock, large && { width: 156, height: 156, borderRadius: 78 }]}><T kind="title" style={{ fontSize: large ? 38 : 25, color: c.violet, fontVariant: ['tabular-nums'], letterSpacing: -1 }}>{Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}</T><T kind="caption" style={{ color: c.violet }}>{timer.status === 'GRACE' ? 'grace period' : remaining ? 'remaining' : 'Check in now'}</T></View>;
}

export function SosCard({ emergency, busy, onSos, onResolve, onEmergency, detailsTitle = 'View emergency details' }: {
  emergency: Emergency | null; busy: boolean; onSos: () => void; onResolve: () => void; onEmergency: () => void; detailsTitle?: string;
}) {
  const { width } = useWindowDimensions();
  if (emergency) return <Card style={{ backgroundColor: c.pine, borderColor: c.pine }}><View style={s.row}><Siren size={22} color={c.mintStrong} /><T kind="eyebrow" style={{ color: c.mintStrong }}>Active demo session</T></View><T kind="title" style={{ color: c.white }}>You are not alone.</T><T style={{ color: '#bdd8ce' }}>Your emergency is recorded in the demo. No real message has been sent to your contacts.</T><Button title="I’m safe · End emergency" tone="soft" icon={Check} busy={busy} onPress={onResolve} /><Button title={detailsTitle} tone="outline" onPress={onEmergency} /></Card>;
  return <View style={d.sosCard}>
    <T kind="eyebrow" style={{ color: '#a7c7bc' }}>Need help now?</T>
    <T kind="title" style={d.heroTitle}>One tap.{`\n`}<T kind="title" style={[d.heroTitle, { color: c.mintStrong }]}>Trusted support.</T></T>
    <View style={[d.sosRow, width < 350 && { flexDirection: 'column-reverse', alignItems: 'stretch' }]}><View style={s.flex}><T style={{ color: '#c1d8ce', fontSize: 13, lineHeight: 20 }}>Hold steady. You’ll have a moment to cancel before your demo alert begins.</T><View style={[s.row, { marginTop: 17, gap: 6, alignItems: 'flex-start' }]}><ShieldCheck size={15} color={c.mintStrong} /><T kind="caption" style={{ color: '#a7c7bc', flex: 1, fontSize: 11 }}>Location is requested only when you choose to share it.</T></View></View>
      <View style={[d.sosOuter, { alignSelf: 'center' }]}><View style={d.sosRing}><Pressable accessibilityRole="button" accessibilityLabel="Activate demo SOS with cancellation countdown" disabled={busy} onPress={onSos} style={({ pressed }) => [d.sosButton, pressed && { opacity: .8, transform: [{ scale: .97 }] }]}><Siren size={27} color={c.white} strokeWidth={1.6} /><T kind="heading" style={{ fontSize: 25, lineHeight: 31, color: c.white }}>SOS</T><T kind="caption" style={{ color: '#ffe4df', fontSize: 10 }}>Tap for help</T></Pressable></View></View>
    </View>
    <View style={d.sosFoot}><View style={s.row}><Clock3 size={13} color="#a7c7bc" /><T kind="caption" style={d.footText}>Time to cancel</T></View><View style={s.row}><LockKeyhole size={13} color="#a7c7bc" /><T kind="caption" style={d.footText}>Private by default</T></View></View>
  </View>;
}

function AreaIllustration() {
  return <View style={d.map} accessibilityLabel="Decorative area illustration, not a live map">
    <Svg width="100%" height="156" viewBox="0 0 340 156" preserveAspectRatio="xMidYMid slice">
      <Rect width="340" height="156" fill="#edf2ec" /><Path d="M0 18L120 0L156 50L120 102L24 94Z M232 0L340 15L340 70L252 62Z M218 115L332 96L340 156L205 156Z" fill="#dce9db" />
      <Path d="M-10 78L60 60L152 78L231 42L354 62 M82 -10L98 52L132 92L115 170 M246 -10L232 42L259 114L245 167" stroke="#fff" strokeWidth="14" fill="none" />
      <Path d="M-10 130L108 108L177 127L248 113L350 127 M175 -10L166 48L190 103L180 170" stroke="#fff" strokeWidth="7" fill="none" />
      <Path d="M55 60L99 60L133 81L187 63L229 44" stroke="#6aa88b" strokeWidth="3" strokeDasharray="5 5" fill="none" />
      <Circle cx="55" cy="60" r="8" fill={c.pine} stroke="#fff" strokeWidth="3" /><Circle cx="229" cy="44" r="8" fill={c.pine} stroke="#fff" strokeWidth="3" />
    </Svg><View style={d.mapCaption}><T kind="caption" style={{ fontSize: 10 }}>Area illustration · not live location</T></View>
  </View>;
}

function QuickAction({ icon: Icon, title, description, accent, tint, onPress }: { icon: LucideIcon; title: string; description: string; accent: string; tint: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`${title}. ${description}`} onPress={onPress} style={({ pressed }) => [d.quick, pressed && { backgroundColor: c.paper }]}><View style={[s.between, { marginBottom: 15 }]}><View style={[d.quickIcon, { backgroundColor: tint }]}><Icon size={20} color={accent} strokeWidth={1.8} /></View><ArrowRight size={14} color={c.faint} /></View><T kind="label" style={{ fontSize: 13 }}>{title}</T><T kind="caption" style={{ marginTop: 4, fontSize: 11 }}>{description}</T></Pressable>;
}

export default function Dashboard({ data, busy, run, navigate, onSos, onFakeCall }: ScreenProps & { onSos: () => void; onFakeCall: () => void }) {
  const activeJourney = data.journeys.find(j => j.status === 'ACTIVE' || j.status === 'OVERDUE');
  const timer = data.timers.find(t => t.status === 'RUNNING' || t.status === 'GRACE');
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  return <>
    <View style={{ gap: 8 }}><T kind="eyebrow">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</T><T kind="title">{greeting},{`\n`}{data.user.firstName || data.user.fullName.split(' ')[0]} <T kind="title" style={{ color: '#6b9c80' }}>✦</T></T><T style={{ color: c.soft }}>Your safety space, ready when you need it.</T><Badge label="Your demo safety space" /></View>
    <SosCard emergency={data.emergency} busy={busy} onSos={onSos} onEmergency={() => navigate('Emergency')} onResolve={() => void run(() => apiRequest(`/emergency/${data.emergency!.id}/resolve`, { method: 'POST', body: '{}' }), 'Emergency ended.')} />
    <View style={{ gap: 12 }}><SectionTitle eyebrow="Keep support close" title="Your safety tools" /><View style={d.quickGrid}>
      <QuickAction icon={Route} title="Start journey" description="Plan your next safe arrival" accent={c.pine2} tint={c.mint} onPress={() => navigate('Journey')} />
      <QuickAction icon={Timer} title="Safety timer" description="A quiet check-in, on your time" accent={c.violet} tint={c.violetSoft} onPress={() => navigate('Timer')} />
      <QuickAction icon={UsersRound} title="Trusted circle" description={`${data.contacts.filter(contact => contact.verified).length} verified contacts`} accent={c.blue} tint={c.blueSoft} onPress={() => navigate('Contacts')} />
      <QuickAction icon={LifeBuoy} title="Nearby help" description="Hospitals, police & more" accent={c.amber} tint={c.amberSoft} onPress={() => navigate('Nearby')} />
      <QuickAction icon={Phone} title="Fake call" description="A little breathing room" accent={c.coral} tint={c.coralSoft} onPress={onFakeCall} />
      <QuickAction icon={Camera} title="Evidence mode" description="Your privacy comes first" accent={c.soft} tint="#edf1ef" onPress={() => navigate('Evidence')} />
    </View></View>
    <Card style={{ padding: 0, overflow: 'hidden', gap: 0 }}><View style={{ padding: 20 }}><SectionTitle eyebrow={activeJourney ? 'Your journey' : 'Your area'} title={activeJourney ? activeJourney.title : 'Ready when you are'} /></View><AreaIllustration /><View style={{ padding: 20, gap: 13 }}>{activeJourney ? <><Badge label={activeJourney.status === 'OVERDUE' ? 'Arrival check-in due' : 'Journey started'} tone={activeJourney.status === 'OVERDUE' ? 'amber' : 'green'} /><T kind="label">{activeJourney.origin} → {activeJourney.destination}</T><T kind="caption">Expected by {timeLabel(activeJourney.expectedArrival)} · Manage your check-ins below.</T><Button title="Open journey" icon={Route} tone="soft" onPress={() => navigate('Journey')} /></> : <><View style={s.row}><MapPin size={16} color={c.pine2} /><T kind="caption">Location sharing is off</T></View><Button title="Plan a journey" icon={ArrowRight} tone="soft" onPress={() => navigate('Journey')} /></>}</View></Card>
    <Card><SectionTitle eyebrow="Safety timer" title={timer ? timer.label : 'Set a quiet check-in'} action={timer ? 'Manage' : 'Set timer'} onPress={() => navigate('Timer')} />{timer ? <><View style={s.row}><TimerClock timer={timer} /><View style={s.flex}><Badge label={Date.parse(timer.expiresAt) <= Date.now() ? 'Check in now' : 'Running quietly'} tone={timer.status === 'GRACE' ? 'amber' : 'violet'} /><T kind="caption" style={{ marginTop: 9 }}>A little extra accountability for walks, rides, or everyday moments.</T></View></View><Button title="I’m safe" icon={Check} busy={busy} onPress={() => void run(() => apiRequest(`/timers/${timer.id}/confirm`, { method: 'POST', body: '{}' }), 'Your check-in is saved.')} /></> : <View style={s.row}><View style={[s.softIcon, { backgroundColor: c.violetSoft }]}><Clock3 size={23} color={c.violet} /></View><T kind="caption" style={s.flex}>“Check on me in 15 minutes.”{`\n`}No location sharing needed.</T></View>}</Card>
    <Card><SectionTitle eyebrow="Recent activity" title="Your safety pulse" action="View all" onPress={() => navigate('History')} />{data.notifications.length ? data.notifications.slice(0, 3).map((notification, index) => <View key={notification.id} style={[d.activity, index > 0 && { borderTopWidth: 1, borderTopColor: c.line }]}><View style={[d.quickIcon, { backgroundColor: c.violetSoft, width: 34, height: 34 }]}><Bell size={16} color={c.violet} /></View><View style={s.flex}><T kind="label" style={{ fontSize: 12 }}>{notification.title}</T><T kind="caption" numberOfLines={2} style={{ marginTop: 3, fontSize: 11 }}>{notification.body}</T><T kind="caption" style={{ marginTop: 5, fontSize: 10, color: c.faint }}>{timeLabel(notification.createdAt)} · Demo record</T></View></View>) : <Empty title="Nothing new" description="Your latest safety updates will appear here." icon={Bell} />}</Card>
    <Pressable accessibilityRole="button" accessibilityLabel="Review privacy settings" onPress={() => navigate('Settings')}><Note icon={LockKeyhole}>Your privacy is the default. You choose when to share. Review your privacy settings →</Note></Pressable>
    <T kind="caption" style={{ textAlign: 'center', fontSize: 11 }}>Demo experience · alerts stay inside this app</T>
  </>;
}

const d = StyleSheet.create({
  sosCard: { padding: 22, borderRadius: 20, backgroundColor: c.pine, overflow: 'hidden' },
  heroTitle: { color: c.white, fontSize: 31, lineHeight: 37, marginTop: 12 },
  sosRow: { flexDirection: 'row', alignItems: 'center', gap: 13, marginTop: 20 },
  sosOuter: { padding: 7, borderRadius: 80, borderWidth: 1, borderColor: '#ffffff12' },
  sosRing: { padding: 6, borderRadius: 80, borderWidth: 1, borderColor: '#ffffff24' },
  sosButton: { width: 102, minHeight: 102, borderRadius: 60, backgroundColor: c.coral, alignItems: 'center', justifyContent: 'center', paddingVertical: 9 },
  sosFoot: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, borderTopWidth: 1, borderTopColor: '#ffffff1c', marginTop: 23, paddingTop: 15, flexWrap: 'wrap' },
  footText: { color: '#a7c7bc', fontSize: 10 },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  quick: { flexBasis: '47%', flexGrow: 1, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: c.line, backgroundColor: c.white },
  quickIcon: { width: 37, height: 37, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  map: { height: 156, overflow: 'hidden', backgroundColor: '#edf2ec' },
  mapCaption: { position: 'absolute', bottom: 8, right: 10, paddingVertical: 3, paddingHorizontal: 7, borderRadius: 5, backgroundColor: '#ffffffec' },
  clock: { width: 108, height: 108, borderRadius: 54, borderWidth: 5, borderColor: '#dfd8f5', alignItems: 'center', justifyContent: 'center', gap: 2, backgroundColor: '#faf9fe' },
  activity: { flexDirection: 'row', gap: 12, paddingTop: 12, paddingBottom: 3 },
});
