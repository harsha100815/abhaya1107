import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, BackHandler, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { DMSans_400Regular } from '@expo-google-fonts/dm-sans/400Regular';
import { DMSans_600SemiBold } from '@expo-google-fonts/dm-sans/600SemiBold';
import { Manrope_700Bold } from '@expo-google-fonts/manrope/700Bold';
import { Manrope_800ExtraBold } from '@expo-google-fonts/manrope/800ExtraBold';
import { ArrowLeft, ArrowRight, Bell, Camera, Check, ChevronRight, CircleEllipsis, History, House, LifeBuoy, LockKeyhole, MapPin, Phone, PhoneOff, Route, Settings2, ShieldCheck, Siren, Timer, UsersRound, WifiOff, X, type LucideIcon } from 'lucide-react-native';
import * as Location from 'expo-location';
import { ApiError, apiRequest, clearTokens, getAccess, logout, setTokens } from './api';
import Dashboard, { SosCard } from './Dashboard';
import { ContactsScreen, SettingsScreen } from './PeopleScreens';
import { HistoryScreen, JourneyScreen, NearbyScreen, TimerScreen, openLink } from './SafetyScreens';
import type { DashboardData, Emergency, Page, ScreenProps } from './models';
import { Avatar, Badge, Brand, Button, Card, IconButton, Note, PageHeading, T, c, s, statusLabel, timeLabel } from './ui';

const tabs: { page: Page; title: string; icon: LucideIcon }[] = [
  { page: 'Home', title: 'Home', icon: House }, { page: 'Journey', title: 'Journeys', icon: Route },
  { page: 'Timer', title: 'Timer', icon: Timer }, { page: 'Contacts', title: 'Circle', icon: UsersRound }, { page: 'More', title: 'More', icon: CircleEllipsis },
];

export default function SafetyApp() {
  const [fontsLoaded, fontError] = useFonts({ DMSans_400Regular, DMSans_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold });
  return <SafeAreaProvider><StatusBar barStyle="dark-content" backgroundColor={c.paper} />{fontsLoaded || fontError ? <SafetySpace /> : <View style={a.loading}><ActivityIndicator color={c.pine} /></View>}</SafeAreaProvider>;
}

function SafetySpace() {
  const [booting, setBooting] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [data, setData] = useState<DashboardData | null>(null);
  const [page, setPage] = useState<Page>('Home');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [fakeCall, setFakeCall] = useState(false);
  const pendingLoad = useRef<Promise<void> | null>(null);
  const mutationLock = useRef(false);
  const emergencyLock = useRef(false);
  const sosDeadline = useRef<number | null>(null);

  useEffect(() => { void getAccess().then(token => setAuthenticated(Boolean(token))).catch(() => setError('Your saved sign-in could not be opened. Please sign in again.')).finally(() => setBooting(false)); }, []);

  const signOut = useCallback(async () => {
    await clearTokens(); setAuthenticated(false); setData(null); setPage('Home'); sosDeadline.current = null; setCountdown(null); setError('');
  }, []);
  const userSignOut = async () => {
    if (mutationLock.current) return;
    mutationLock.current = true; setBusy(true);
    try { await logout(); } catch { /* Local sign-out remains possible without a connection. */ }
    finally { await signOut(); mutationLock.current = false; setBusy(false); }
  };

  const load = useCallback((): Promise<void> => {
    if (pendingLoad.current) return pendingLoad.current;
    pendingLoad.current = Promise.all([
      apiRequest<{ user: DashboardData['user'] }>('/users/me'), apiRequest<{ contacts: DashboardData['contacts'] }>('/trusted-contacts'),
      apiRequest<{ emergency: Emergency | null }>('/emergency/active'), apiRequest<DashboardData['history']>('/history'),
      apiRequest<{ notifications: DashboardData['notifications'] }>('/notifications'),
    ]).then(([profile, contacts, emergency, history, notifications]) => {
      setData({ ...profile, ...contacts, ...emergency, journeys: history.journeys, timers: history.timers, history, ...notifications }); setError('');
    }).catch(async problem => {
      if (problem instanceof ApiError && problem.status === 401) await signOut();
      else setError(problem instanceof Error ? problem.message : 'Could not load your safety space.');
      throw problem;
    }).finally(() => { pendingLoad.current = null; });
    return pendingLoad.current;
  }, [signOut]);

  useEffect(() => {
    if (!authenticated) return;
    const refresh = () => { void load().catch(() => undefined); };
    refresh();
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    const interval = setInterval(() => { if (AppState.currentState === 'active' && !mutationLock.current) refresh(); }, 120000);
    return () => { subscription.remove(); clearInterval(interval); };
  }, [authenticated, load]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { if (page !== 'Home') { setPage('Home'); return true; } return false; });
    return () => subscription.remove();
  }, [page]);

  const run = useCallback(async (job: () => Promise<unknown>, success?: string) => {
    if (mutationLock.current) return;
    mutationLock.current = true; setBusy(true);
    try {
      await pendingLoad.current?.catch(() => undefined);
      await job();
      await load();
      if (success) Alert.alert('Saved', success);
    } catch (problem) {
      if (problem instanceof ApiError && problem.status === 401) await signOut();
      else Alert.alert('Could not complete', problem instanceof Error ? problem.message : 'Please try again.');
    } finally { mutationLock.current = false; setBusy(false); }
  }, [load, signOut]);

  const activate = useCallback(async () => {
    if (emergencyLock.current) return;
    emergencyLock.current = true; sosDeadline.current = null; setCountdown(null);
    await run(async () => {
      const result = await apiRequest<{ emergency: Emergency }>('/emergency', { method: 'POST', body: JSON.stringify({ source: 'SOS' }) });
      setData(current => current ? { ...current, emergency: result.emergency } : current); setPage('Emergency');
    });
    emergencyLock.current = false;
  }, [run]);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) { void activate(); return; }
    const tick = () => { if (sosDeadline.current !== null) setCountdown(Math.max(0, Math.ceil((sosDeadline.current - Date.now()) / 1000))); };
    const timeout = setInterval(tick, 200);
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') tick(); });
    return () => { clearInterval(timeout); subscription.remove(); };
  }, [countdown, activate]);

  const startSos = () => { if (!busy && countdown === null) { const seconds = data?.user.settings.sosCountdown ?? 5; sosDeadline.current = Date.now() + seconds * 1000; setCountdown(seconds); } };
  const cancelSos = () => { sosDeadline.current = null; setCountdown(null); };
  const pullToRefresh = async () => { setRefreshing(true); try { await load(); } catch { /* The visible error banner carries the failure. */ } finally { setRefreshing(false); } };

  if (booting) return <View style={a.loading}><ActivityIndicator color={c.pine} /><T kind="caption">Opening your safety space…</T></View>;
  if (!authenticated) return <SignIn onSignedIn={() => { setAuthenticated(true); setError(''); }} />;
  if (!data) return <SafeAreaView style={a.root}><View style={[a.loading, { padding: 30 }]}><Brand />{error ? <><Note tone="amber" icon={WifiOff}>{error}</Note><Button title="Try again" busy={refreshing} onPress={() => void pullToRefresh()} /><Button title="Back to sign in" tone="outline" onPress={() => void signOut()} /></> : <><ActivityIndicator color={c.pine} /><T kind="caption">Getting your safety space ready…</T></>}</View></SafeAreaView>;

  const props: ScreenProps = { data, busy, run, navigate: setPage };
  const content = (() => {
    switch (page) {
      case 'Home': return <Dashboard {...props} onSos={startSos} onFakeCall={() => setFakeCall(true)} />;
      case 'Journey': return <JourneyScreen {...props} />;
      case 'Timer': return <TimerScreen {...props} />;
      case 'Contacts': return <ContactsScreen {...props} />;
      case 'Settings': return <SettingsScreen {...props} onSignOut={() => void userSignOut()} onFakeCall={() => setFakeCall(true)} />;
      case 'Nearby': return <NearbyScreen />;
      case 'History': return <HistoryScreen {...props} />;
      case 'Notifications': return <HistoryScreen {...props} notificationsOnly />;
      case 'Emergency': return <EmergencyScreen {...props} onSos={startSos} />;
      case 'Evidence': return <EvidenceInfo />;
      default: return <MoreScreen {...props} onFakeCall={() => setFakeCall(true)} />;
    }
  })();

  return <SafeAreaView style={a.root} edges={['top', 'left', 'right', 'bottom']}>
    <View style={a.header}><View style={s.row}>{!tabs.some(tab => tab.page === page) && <IconButton icon={ArrowLeft} label="Back to more tools" onPress={() => setPage('More')} />}<Brand /></View><View style={[s.row, { gap: 2 }]}><IconButton icon={Bell} label="Notifications" selected={page === 'Notifications'} onPress={() => setPage('Notifications')} /><Pressable accessibilityRole="button" accessibilityLabel="Your profile and settings" onPress={() => setPage('Settings')} style={{ padding: 4 }}><Avatar name={data.user.fullName} size={34} /></Pressable></View></View>
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView key={page} style={s.flex} contentContainerStyle={s.page} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void pullToRefresh()} tintColor={c.pine} />}>
        {error ? <Pressable accessibilityRole="button" accessibilityLabel="Refresh connection" onPress={() => void pullToRefresh()}><Note icon={WifiOff} tone="amber">Connection lost. Showing your last update. Tap to retry.</Note></Pressable> : null}{content}
      </ScrollView>
    </KeyboardAvoidingView>
    <View style={a.dock}>{tabs.map(tab => { const selected = tab.page === page || (tab.page === 'More' && !tabs.some(item => item.page === page)); return <Pressable key={tab.page} accessibilityRole="tab" accessibilityLabel={tab.title} accessibilityState={{ selected }} onPress={() => setPage(tab.page)} style={a.tab}><View style={[a.tabIcon, selected && { backgroundColor: c.mint }]}><tab.icon size={21} color={selected ? c.pine : c.faint} strokeWidth={selected ? 2.1 : 1.6} /></View><T kind="caption" style={{ color: selected ? c.pine : c.soft, fontFamily: selected ? 'DMSans_600SemiBold' : 'DMSans_400Regular', fontSize: 10 }}>{tab.title}</T></Pressable>; })}</View>
    <Modal visible={countdown !== null} transparent animationType="fade" onRequestClose={cancelSos}><ScrollView style={{ backgroundColor: '#071c18dc' }} contentContainerStyle={a.overlay}><View style={a.countdown}><Siren size={34} color={c.coral} /><T kind="eyebrow" style={{ color: c.mintStrong }}>Demo SOS activation</T><T kind="title" style={{ color: c.white, textAlign: 'center' }}>A moment to{`\n`}change your mind.</T><T style={{ color: '#c2d7ce', textAlign: 'center' }}>Cancel if this was accidental. This demo records an alert inside the app.</T><T kind="title" accessibilityLiveRegion="polite" style={{ color: c.mintStrong, fontSize: 76, lineHeight: 88, fontVariant: ['tabular-nums'] }}>{countdown}</T><Button title="Cancel SOS" icon={X} tone="soft" style={{ alignSelf: 'stretch' }} onPress={cancelSos} /><Button title="Activate demo now" icon={Siren} tone="danger" style={{ alignSelf: 'stretch' }} onPress={() => void activate()} /></View></ScrollView></Modal>
    <FakeCall visible={fakeCall} onClose={() => setFakeCall(false)} />
  </SafeAreaView>;
}

function SignIn({ onSignedIn }: { onSignedIn: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const signIn = async () => {
    if (busy) return; setBusy(true); setError('');
    try {
      const result = await apiRequest<{ accessToken: string; refreshToken: string }>('/auth/login', { method: 'POST', body: JSON.stringify({ email: 'demo@abhaya.app', password: 'Password123!' }) });
      await setTokens(result.accessToken, result.refreshToken); onSignedIn();
    } catch (problem) { setError(problem instanceof Error ? problem.message : 'Could not sign in. Please try again.'); }
    finally { setBusy(false); }
  };
  return <SafeAreaView style={{ flex: 1, backgroundColor: c.pine }}><StatusBar barStyle="light-content" /><ScrollView contentContainerStyle={a.auth}><Brand light /><View style={a.authMiddle}><View style={a.authEmblem}><ShieldCheck size={54} color={c.mintStrong} strokeWidth={1.2} /></View><T kind="eyebrow" style={{ color: c.mintStrong }}>Your everyday safety companion</T><T kind="title" style={a.authTitle}>Feel safer.{`\n`}Move freely.</T><T style={{ color: '#b6d0c4', fontSize: 16, lineHeight: 25 }}>A calm place for your journeys, your check-ins, and the people you trust.</T><View style={a.authFeatures}>{[{ icon: Route, text: 'Thoughtful journeys' }, { icon: UsersRound, text: 'Your trusted circle' }, { icon: LockKeyhole, text: 'Privacy by default' }].map(feature => <View key={feature.text} style={s.row}><feature.icon size={16} color={c.mintStrong} /><T kind="caption" style={{ color: '#c5ddd2' }}>{feature.text}</T></View>)}</View></View><View style={{ gap: 13 }}>{error && <Note tone="amber" icon={WifiOff}>{error}</Note>}<Button title="Enter demo safety space" icon={ArrowRight} tone="soft" busy={busy} onPress={() => void signIn()} /><T kind="caption" style={{ color: '#9abdae', textAlign: 'center', fontSize: 11 }}>Explore with a demo account. No real alerts are sent.</T></View></ScrollView></SafeAreaView>;
}

function EmergencyScreen({ data, busy, run, navigate, onSos }: ScreenProps & { onSos: () => void }) {
  const emergency = data.emergency;
  const shareLocation = () => void run(async () => {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) throw new Error('Location permission is off. You can allow it in your phone settings.');
    const point = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    await apiRequest(`/emergency/${emergency!.id}/location`, { method: 'POST', body: JSON.stringify({ latitude: point.coords.latitude, longitude: point.coords.longitude, accuracy: point.coords.accuracy ?? undefined, timestamp: new Date(point.timestamp).toISOString() }) });
  }, 'Your current location was attached to this demo emergency. Continuous tracking is off.');
  return <><PageHeading eyebrow="Emergency support" title={emergency ? 'You are not alone.' : 'Ready when you need it'} description="Stay in control at every step. Your emergency status is always visible here." /><SosCard emergency={emergency} busy={busy} onSos={onSos} onResolve={() => void run(() => apiRequest(`/emergency/${emergency!.id}/resolve`, { method: 'POST', body: '{}' }), 'Emergency ended.')} onEmergency={() => navigate('Contacts')} detailsTitle="View trusted circle" />{emergency && <Card><T kind="heading">Session details</T><View style={s.between}><T kind="caption">Status</T><Badge label={statusLabel(emergency.status)} tone="red" /></View><View style={s.between}><T kind="caption">Started</T><T kind="label">{timeLabel(emergency.createdAt)}</T></View><View style={s.divider} /><View style={s.row}><MapPin size={18} color={c.pine2} /><T kind="label">Last captured location</T></View><T kind="caption">{emergency.location ? `${emergency.location.latitude.toFixed(4)}, ${emergency.location.longitude.toFixed(4)} · ${timeLabel(emergency.location.timestamp)}` : 'No location attached to this session.'}</T><Button title={emergency.location ? 'Update current location' : 'Share current location once'} icon={MapPin} tone="soft" busy={busy} onPress={shareLocation} /><Note icon={LockKeyhole}>Location is captured only when you tap above. There is no continuous or background tracking in this demo.</Note></Card>}<Card><T kind="heading">Keep support close</T><Button title="Open dialer · 112" icon={Phone} tone="danger" onPress={() => void openLink('tel:112')} /><Button title="View trusted circle" icon={UsersRound} tone="outline" onPress={() => navigate('Contacts')} /></Card></>;
}

function MoreScreen({ navigate, onFakeCall }: ScreenProps & { onFakeCall: () => void }) {
  const items: { title: string; description: string; icon: LucideIcon; action: () => void }[] = [
    { title: 'Emergency', description: 'SOS and your session status', icon: Siren, action: () => navigate('Emergency') },
    { title: 'Nearby help', description: 'Find local places that can help', icon: LifeBuoy, action: () => navigate('Nearby') },
    { title: 'Safety history', description: 'Your journeys and check-ins', icon: History, action: () => navigate('History') },
    { title: 'Fake call', description: 'A clearly simulated incoming call', icon: Phone, action: onFakeCall },
    { title: 'Evidence mode', description: 'Recording and privacy information', icon: Camera, action: () => navigate('Evidence') },
    { title: 'Settings', description: 'Your profile and safety preferences', icon: Settings2, action: () => navigate('Settings') },
  ];
  return <><PageHeading eyebrow="A little extra support" title="Your safety space" description="Everything you need, thoughtfully kept together." /><Card>{items.map((item, index) => <Pressable key={item.title} accessibilityRole="button" onPress={item.action} style={[s.row, { minHeight: 72, paddingVertical: 12 }, index > 0 && { borderTopWidth: 1, borderTopColor: c.line }]}><View style={s.softIcon}><item.icon size={21} color={c.pine2} /></View><View style={s.flex}><T kind="label">{item.title}</T><T kind="caption">{item.description}</T></View><ChevronRight size={17} color={c.faint} /></Pressable>)}</Card><Note icon={ShieldCheck}>You’re exploring a demo. Safety events and notification records stay inside the app.</Note></>;
}

function EvidenceInfo() {
  return <><PageHeading eyebrow="Private by choice" title="Evidence mode" description="Recording should always be a deliberate choice, with a clear place to save your files." /><Card><View style={s.softIcon}><Camera size={24} color={c.pine2} /></View><T kind="heading">Recording is not connected yet</T><T style={{ color: c.soft }}>This demo does not record or upload audio and video. Your camera and microphone stay off.</T><Badge label="Camera & microphone off" /><Note icon={LockKeyhole}>Evidence storage needs to be configured before recordings can be saved safely in ABHAYA.</Note></Card></>;
}

function FakeCall({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [answered, setAnswered] = useState(false);
  useEffect(() => { if (visible) setAnswered(false); }, [visible]);
  return <Modal visible={visible} animationType="slide" onRequestClose={onClose}><SafeAreaView style={a.call}><Badge label="App-generated simulation" /><View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 18 }}><Avatar name="Mom" size={94} /><T kind="title" style={{ color: c.white, fontSize: 38 }}>Mom</T><T style={{ color: '#bad1c7' }}>{answered ? 'Simulated call in progress' : 'Incoming simulated call'}</T><T kind="caption" style={{ color: '#9ab9ab', textAlign: 'center' }}>No real person is being contacted.</T></View><View style={{ flexDirection: 'row', justifyContent: 'space-evenly', paddingBottom: 30 }}><View style={{ alignItems: 'center', gap: 12 }}><Pressable accessibilityRole="button" accessibilityLabel={answered ? 'End simulated call' : 'Decline simulated call'} onPress={onClose} style={[a.callButton, { backgroundColor: c.coral }]}><PhoneOff size={27} color={c.white} /></Pressable><T kind="caption" style={{ color: c.white }}>{answered ? 'End call' : 'Decline'}</T></View>{!answered && <View style={{ alignItems: 'center', gap: 12 }}><Pressable accessibilityRole="button" accessibilityLabel="Answer simulated call" onPress={() => setAnswered(true)} style={[a.callButton, { backgroundColor: '#419b6f' }]}><Phone size={27} color={c.white} /></Pressable><T kind="caption" style={{ color: c.white }}>Answer</T></View>}</View></SafeAreaView></Modal>;
}

const a = StyleSheet.create({
  root: { flex: 1, backgroundColor: c.paper }, loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.paper, gap: 24 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: c.line, backgroundColor: c.white },
  dock: { flexDirection: 'row', justifyContent: 'space-around', borderTopWidth: 1, borderTopColor: c.line, backgroundColor: c.white, paddingTop: 8, paddingBottom: 5 },
  tab: { flex: 1, alignItems: 'center', gap: 3, minHeight: 54 }, tabIcon: { width: 48, height: 30, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  overlay: { flexGrow: 1, backgroundColor: '#071c18dc', justifyContent: 'center', padding: 22 },
  countdown: { backgroundColor: c.pine, borderRadius: 26, padding: 27, gap: 17, alignItems: 'center', borderWidth: 1, borderColor: '#ffffff20' },
  auth: { flexGrow: 1, padding: 28, paddingTop: 22, paddingBottom: 28, justifyContent: 'space-between', gap: 35, width: '100%', maxWidth: 580, alignSelf: 'center' },
  authMiddle: { gap: 18, paddingVertical: 15 }, authEmblem: { width: 98, height: 98, borderRadius: 32, borderWidth: 1, borderColor: '#7fbd9d3b', backgroundColor: '#20493c', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  authTitle: { color: c.white, fontSize: 46, lineHeight: 53, letterSpacing: -1.8 }, authFeatures: { gap: 13, marginTop: 12 },
  call: { flex: 1, backgroundColor: '#143b32', padding: 25, alignItems: 'center' }, callButton: { width: 70, height: 70, borderRadius: 35, alignItems: 'center', justifyContent: 'center' },
});
