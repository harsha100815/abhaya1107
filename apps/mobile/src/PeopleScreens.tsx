import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import {
  Bell,
  Lock,
  LogOut,
  Mail,
  MessageCircle,
  Minus,
  Phone,
  Plus,
  ShieldCheck,
  UserPlus,
  UsersRound,
  Vibrate,
  type LucideIcon,
} from 'lucide-react-native';
import { apiRequest } from './api';
import type { Contact, ScreenProps } from './models';
import { Avatar, Badge, Button, Card, Empty, Field, Note, PageHeading, SectionTitle, T, c, s } from './ui';

const contactEvents = ['EMERGENCY', 'JOURNEY', 'TIMER', 'CHECK_IN'] as const;
const eventLabels: Record<(typeof contactEvents)[number], string> = {
  EMERGENCY: 'Emergency',
  JOURNEY: 'Journeys',
  TIMER: 'Timers',
  CHECK_IN: 'Check-ins',
};
const relationships = ['Family', 'Friend', 'Partner', 'Colleague', 'Neighbour'] as const;
const emptyContact = { name: '', phone: '', email: '', relationship: 'Friend' };

export function ContactsScreen({ data, busy, run }: ScreenProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyContact);
  const verified = data.contacts.filter(contact => contact.verified);
  const canSubmit = form.name.trim().length >= 2 && form.phone.trim().length >= 7 && form.relationship.trim().length >= 2;

  const addContact = async () => {
    const email = form.email.trim();
    await run(async () => {
      await apiRequest('/trusted-contacts', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name.trim(),
          phone: form.phone.trim(),
          relationship: form.relationship.trim(),
          receives: contactEvents,
          ...(email ? { email } : {}),
        }),
      });
      setForm(emptyContact);
      setShowAdd(false);
    }, 'Contact added as pending. This demo records the invitation locally; it does not send a real message.');
  };

  return <View style={styles.stack}>
    <PageHeading
      eyebrow="Your people"
      title="Trusted circle"
      description="The people you choose to hear from your safety sessions. They never receive your location outside an active session."
    />

    <View style={styles.circleSummary}>
      <View style={styles.avatarPile}>
        {data.contacts.slice(0, 4).map((contact, index) => <View key={contact.id} style={index > 0 ? styles.overlapAvatar : undefined}><Avatar name={contact.name} size={37} /></View>)}
        {!data.contacts.length && <View style={styles.summaryIcon}><UsersRound size={20} color={c.pine2} /></View>}
      </View>
      <View style={s.flex}>
        <T kind="label" style={styles.summaryTitle}>{verified.length} verified contact{verified.length === 1 ? '' : 's'}</T>
        <T kind="caption">{data.contacts.length ? 'Ready for the safety events you choose.' : 'Add someone you trust for extra support.'}</T>
      </View>
      <Lock size={17} color={c.pine2} />
    </View>

    <Button title={showAdd ? 'Close contact form' : 'Add trusted contact'} icon={showAdd ? undefined : UserPlus} tone={showAdd ? 'outline' : 'primary'} onPress={() => setShowAdd(value => !value)} />

    {showAdd && <Card>
      <SectionTitle eyebrow="New connection" title="Add a trusted contact" />
      <T kind="caption">Choose someone who can respond calmly if a journey, timer, or emergency needs attention.</T>
      <Field label="Name" placeholder="e.g. Maya Iyer" value={form.name} onChangeText={name => setForm(current => ({ ...current, name }))} autoCapitalize="words" />
      <Field label="Phone number" placeholder="+91 90000 11007" value={form.phone} onChangeText={phone => setForm(current => ({ ...current, phone }))} keyboardType="phone-pad" />
      <Field label="Email (optional)" placeholder="maya@example.com" value={form.email} onChangeText={email => setForm(current => ({ ...current, email }))} keyboardType="email-address" autoCapitalize="none" />
      <View style={styles.fieldGroup}>
        <T kind="label">Relationship</T>
        <View style={styles.chips}>
          {relationships.map(relationship => {
            const selected = form.relationship === relationship;
            return <Pressable
              key={relationship}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => setForm(current => ({ ...current, relationship }))}
              style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.pressed]}
            >
              <T kind="caption" style={[styles.chipText, selected && styles.chipTextSelected]}>{relationship}</T>
            </Pressable>;
          })}
        </View>
      </View>
      <Note icon={ShieldCheck}>New contacts stay pending until they accept an invitation. Pending contacts do not receive safety alerts.</Note>
      <Button title="Add contact" icon={Plus} busy={busy} disabled={!canSubmit} onPress={() => { void addContact(); }} />
    </Card>}

    <SectionTitle eyebrow="Your circle" title={data.contacts.length ? 'People you trust' : 'No contacts yet'} />
    {!data.contacts.length
      ? <Card><Empty icon={UsersRound} title="Your circle is empty" description="Add a friend, family member, or colleague who can be there when you need them." /></Card>
      : data.contacts.map(contact => <ContactCard key={contact.id} contact={contact} busy={busy} run={run} />)}

    <Note icon={Lock}>Only verified contacts are eligible for the event types shown on their card. Demo tests are recorded locally and do not send real messages.</Note>
  </View>;
}

function ContactCard({ contact, busy, run }: { contact: Contact; busy: boolean; run: ScreenProps['run'] }) {
  const recordTest = () => run(
    () => apiRequest(`/trusted-contacts/${contact.id}/test`, { method: 'POST', body: '{}' }),
    'Demo test recorded locally. No emergency was created and no real message was sent.',
  );

  return <Card>
    <View style={s.between}>
      <View style={[s.row, s.flex]}>
        <Avatar name={contact.name} size={46} />
        <View style={s.flex}>
          <T kind="heading" style={styles.contactName} numberOfLines={1}>{contact.name}</T>
          <T kind="caption">{contact.relationship} · Priority {contact.priority}</T>
        </View>
      </View>
      <Badge label={contact.verified ? 'Verified' : 'Pending'} tone={contact.verified ? 'green' : 'amber'} />
    </View>

    <View style={styles.contactDetails}>
      <View style={s.row}><Phone size={16} color={c.faint} /><T kind="caption" style={s.flex}>{contact.phone}</T></View>
      {contact.email && <View style={s.row}><Mail size={16} color={c.faint} /><T kind="caption" style={s.flex}>{contact.email}</T></View>}
    </View>

    <View style={s.divider} />
    <View style={styles.fieldGroup}>
      <T kind="eyebrow">Receives</T>
      <View style={styles.chips}>
        {contact.receives.map(event => <Badge key={event} label={eventLabels[event]} tone="muted" />)}
      </View>
    </View>

    {contact.verified
      ? <Button title="Record a demo test" icon={Vibrate} tone="soft" busy={busy} onPress={() => { void recordTest(); }} />
      : <View style={styles.pendingRow}><MessageCircle size={17} color={c.amber} /><T kind="caption" style={styles.pendingText}>Waiting for invitation acceptance. No alert can be sent yet.</T></View>}
  </Card>;
}

type NotificationKey = 'push' | 'sms' | 'email';
const notificationRows: { key: NotificationKey; title: string; description: string; icon: LucideIcon }[] = [
  { key: 'push', title: 'Push notifications', description: 'Fast alerts on trusted devices', icon: Bell },
  { key: 'sms', title: 'SMS fallback', description: 'Saved for a configured provider', icon: MessageCircle },
  { key: 'email', title: 'Email updates', description: 'Invitations and security events', icon: Mail },
];

export function SettingsScreen({ data, busy, run, onSignOut, onFakeCall }: ScreenProps & { onSignOut: () => void; onFakeCall: () => void }) {
  const { user } = data;
  const settings = user.settings;
  const [profile, setProfile] = useState({ fullName: user.fullName, phone: user.phone, city: user.city ?? '' });

  useEffect(() => {
    setProfile({ fullName: user.fullName, phone: user.phone, city: user.city ?? '' });
  }, [user.fullName, user.phone, user.city]);

  const saveProfile = () => run(
    () => apiRequest('/users/me', {
      method: 'PATCH',
      body: JSON.stringify({ fullName: profile.fullName.trim(), phone: profile.phone.trim(), city: profile.city.trim() }),
    }),
    'Profile updated.',
  );

  const changeCountdown = (step: number) => {
    const sosCountdown = Math.max(0, Math.min(30, settings.sosCountdown + step));
    if (sosCountdown === settings.sosCountdown) return;
    void run(
      () => apiRequest('/users/me/settings', { method: 'PATCH', body: JSON.stringify({ sosCountdown }) }),
      `SOS countdown set to ${sosCountdown} seconds.`,
    );
  };

  const setNotification = (key: NotificationKey, value: boolean) => run(
    () => apiRequest('/users/me/settings', {
      method: 'PATCH',
      body: JSON.stringify({ notificationPreferences: { ...settings.notificationPreferences, [key]: value } }),
    }),
    'Notification preference saved for this account.',
  );

  return <View style={styles.stack}>
    <PageHeading eyebrow="Control center" title="Settings" description="Tune your safety experience without losing the calm simplicity of your home screen." />

    <Card>
      <SectionTitle eyebrow="Your profile" title="Personal details" />
      <View style={styles.profileIntro}>
        <Avatar name={user.fullName} size={62} />
        <View style={s.flex}>
          <T kind="heading">{user.fullName}</T>
          <T kind="caption">Personal account · {user.city || 'City not set'}</T>
        </View>
      </View>
      <Field label="Full name" value={profile.fullName} onChangeText={fullName => setProfile(current => ({ ...current, fullName }))} autoCapitalize="words" />
      <Field label="Phone number" value={profile.phone} onChangeText={phone => setProfile(current => ({ ...current, phone }))} keyboardType="phone-pad" />
      <Field label="City" value={profile.city} onChangeText={city => setProfile(current => ({ ...current, city }))} autoCapitalize="words" />
      <View style={styles.emailRow}>
        <Mail size={17} color={c.faint} />
        <View style={s.flex}><T kind="caption">Email address</T><T kind="label" style={styles.emailText} numberOfLines={1}>{user.email}</T></View>
      </View>
      <Button title="Save profile" icon={ShieldCheck} busy={busy} disabled={profile.fullName.trim().length < 2 || profile.phone.trim().length < 7} onPress={() => { void saveProfile(); }} />
    </Card>

    <Card>
      <SectionTitle eyebrow="Safety defaults" title="How ABHAYA responds" />
      <View style={styles.settingRow}>
        <View style={s.flex}>
          <T kind="label">SOS cancellation countdown</T>
          <T kind="caption">Time to cancel before the demo alert is created</T>
        </View>
        <View style={styles.stepper}>
          <Pressable accessibilityRole="button" accessibilityLabel="Reduce SOS countdown" disabled={busy || settings.sosCountdown <= 0} onPress={() => changeCountdown(-1)} style={({ pressed }) => [styles.stepButton, pressed && styles.pressed, (busy || settings.sosCountdown <= 0) && styles.disabled]}><Minus size={17} color={c.soft} /></Pressable>
          <T kind="label" style={styles.stepValue}>{settings.sosCountdown}s</T>
          <Pressable accessibilityRole="button" accessibilityLabel="Increase SOS countdown" disabled={busy || settings.sosCountdown >= 30} onPress={() => changeCountdown(1)} style={({ pressed }) => [styles.stepButton, pressed && styles.pressed, (busy || settings.sosCountdown >= 30) && styles.disabled]}><Plus size={17} color={c.soft} /></Pressable>
        </View>
      </View>
      <Note icon={Lock}>This Expo demo requests location only for supported safety actions. The saved privacy preference is not an operating-system permission switch.</Note>
    </Card>

    <Card>
      <SectionTitle eyebrow="Notifications" title="Choose your channels" />
      {notificationRows.map(({ key, title, description, icon: Icon }, index) => <View key={key} style={[styles.toggleRow, index > 0 && styles.withDivider]}>
        <View style={styles.settingIcon}><Icon size={18} color={c.pine2} /></View>
        <View style={s.flex}><T kind="label">{title}</T><T kind="caption">{description}</T></View>
        <Switch
          accessibilityLabel={title}
          disabled={busy}
          value={settings.notificationPreferences[key]}
          onValueChange={value => { void setNotification(key, value); }}
          trackColor={{ false: '#dbe3df', true: c.mintStrong }}
          thumbColor={settings.notificationPreferences[key] ? c.pine2 : c.white}
          ios_backgroundColor="#dbe3df"
        />
      </View>)}
      <Note icon={Bell} tone="amber">These preferences are saved, but this local demo does not deliver real push, SMS, or email messages.</Note>
    </Card>

    <Card style={styles.fakeCallCard}>
      <View style={s.between}>
        <View><T kind="eyebrow" style={styles.lightEyebrow}>A little breathing room</T><T kind="heading" style={styles.lightTitle}>Fake call</T></View>
        <Badge label="Clearly simulated" tone="violet" />
      </View>
      <View style={styles.callPreview}>
        <Avatar name="Mom" size={45} />
        <View style={s.flex}><T kind="label" style={styles.lightTitle}>Mom</T><T kind="caption" style={styles.lightCaption}>Incoming call simulation</T></View>
        <Phone size={20} color={c.mintStrong} />
      </View>
      <T kind="caption" style={styles.lightCaption}>Create a clearly simulated incoming call when you need an easy exit. It never contacts a real person.</T>
      <Button title="Preview fake call" icon={Phone} tone="soft" onPress={onFakeCall} />
    </Card>

    <Card style={styles.signOutCard}>
      <View style={s.row}>
        <View style={styles.signOutIcon}><LogOut size={19} color={c.coral} /></View>
        <View style={s.flex}><T kind="label">Sign out</T><T kind="caption">Remove this account from this device.</T></View>
      </View>
      <Button title="Sign out of this device" icon={LogOut} tone="danger" busy={busy} onPress={onSignOut} />
    </Card>
  </View>;
}

const styles = StyleSheet.create({
  stack: { gap: 18 },
  circleSummary: { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 16, borderWidth: 1, borderColor: '#dcece3', borderRadius: 13, backgroundColor: '#f3faf5' },
  avatarPile: { flexDirection: 'row', alignItems: 'center', paddingLeft: 3 },
  overlapAvatar: { marginLeft: -10, borderWidth: 2, borderColor: c.white, borderRadius: 22 },
  summaryIcon: { width: 39, height: 39, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: c.mint },
  summaryTitle: { color: c.pine2 },
  fieldGroup: { gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 40, paddingHorizontal: 13, alignItems: 'center', justifyContent: 'center', borderRadius: 20, borderWidth: 1, borderColor: c.line, backgroundColor: c.white },
  chipSelected: { borderColor: c.mintStrong, backgroundColor: c.mint },
  chipText: { color: c.soft, fontFamily: 'DMSans_600SemiBold' },
  chipTextSelected: { color: c.pine2 },
  pressed: { opacity: .65 },
  disabled: { opacity: .4 },
  contactName: { fontSize: 16 },
  contactDetails: { gap: 9 },
  pendingRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, padding: 13, borderRadius: 11, backgroundColor: c.amberSoft },
  pendingText: { flex: 1, color: '#78581f' },
  profileIntro: { flexDirection: 'row', alignItems: 'center', gap: 12, minWidth: 0 },
  emailRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13, borderRadius: 11, backgroundColor: c.paper },
  emailText: { fontSize: 13 },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  stepButton: { width: 44, height: 44, borderWidth: 1, borderColor: c.line, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: c.white },
  stepValue: { minWidth: 35, color: c.pine2, textAlign: 'center' },
  toggleRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 11 },
  withDivider: { borderTopWidth: 1, borderTopColor: c.line, paddingTop: 12 },
  settingIcon: { width: 35, height: 35, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: c.mint },
  fakeCallCard: { borderWidth: 0, backgroundColor: c.pine },
  lightEyebrow: { color: '#8fbeaa', marginBottom: 5 },
  lightTitle: { color: c.white },
  lightCaption: { color: '#aec9bc' },
  callPreview: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 14, borderRadius: 13, backgroundColor: '#1b493e' },
  signOutCard: { borderColor: '#f4d9d5', backgroundColor: '#fff7f5' },
  signOutIcon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: c.coralSoft },
});
