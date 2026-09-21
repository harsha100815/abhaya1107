import { useEffect, useState } from 'react';
import { Alert, Linking } from 'react-native';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { userViewSchema, messageViewSchema } from '@abhaya/validation';
import { api, logout, useSession } from '../../src/session';
import { stopTracking, disableBackground, enableBackground } from '../../src/location';
import { registerPush, unregisterPush } from '../../src/notifications';
import { chooseImage } from '../../src/images';
import {
  Screen,
  Heading,
  Card,
  Txt,
  Input,
  Button,
  Check,
  Banner,
  Loading,
  useDashboard,
  useAction,
  Feedback,
} from '../../src/ui';
export default function Settings() {
  const query = useDashboard(),
    action = useAction(),
    { save } = useSession(),
    [name, setName] = useState(''),
    [phone, setPhone] = useState(''),
    [theme, setTheme] = useState('system'),
    [push, setPush] = useState(true),
    [security, setSecurity] = useState(true),
    [permissions, setPermissions] = useState('Checking permissions…'),
    [deleting, setDeleting] = useState(false),
    [password, setPassword] = useState(''),
    [confirmation, setConfirmation] = useState('');
  const user = query.data?.user;
  useEffect(() => {
    if (user) {
      setName(user.name);
      setPhone(user.phone ?? '');
      setTheme(user.theme);
      setPush(user.pushEnabled);
      setSecurity(user.securityEmails);
    }
  }, [user?.id]);
  const check = async () => {
    const [f, b, n] = await Promise.all([
      Location.getForegroundPermissionsAsync(),
      Location.getBackgroundPermissionsAsync(),
      Notifications.getPermissionsAsync(),
    ]);
    setPermissions(`Location: ${f.status}\nBackground: ${b.status}\nNotifications: ${n.status}`);
  };
  useEffect(() => {
    void check();
  }, []);
  if (!user)
    return query.error ? (
      <Screen>
        <Banner error>{query.error.message}</Banner>
        <Button label="Retry" onPress={() => void query.refetch()} />
      </Screen>
    ) : (
      <Loading />
    );
  return (
    <Screen>
      <Heading eyebrow="ON YOUR TERMS" title="Your space. Your settings." />
      <Feedback action={action} />
      <Card>
        <Txt kind="title">Profile & preferences</Txt>
        <Input label="Your name" value={name} onChangeText={setName} />
        <Input
          label="Phone · optional"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          placeholder="+919876543210"
        />
        <Txt kind="small">
          {user.email} · {user.emailVerifiedAt ? 'Verified' : 'Not verified'}
        </Txt>
        {!user.emailVerifiedAt && (
          <Button
            label="Send verification email"
            secondary
            onPress={() =>
              void action.run(async () =>
                action.setMessage(
                  (await api.call('POST', '/auth/verification', messageViewSchema, {})).message,
                ),
              )
            }
          />
        )}
        <Txt kind="small">Appearance</Txt>
        {['system', 'light', 'dark'].map((t) => (
          <Check
            key={t}
            label={t === 'system' ? 'Match system' : t === 'light' ? 'Light' : 'Dark'}
            value={theme === t}
            onChange={() => setTheme(t)}
          />
        ))}
        <Check label="Receive push alerts" value={push} onChange={setPush} />
        <Check label="Receive account security emails" value={security} onChange={setSecurity} />
        <Button
          label="Save preferences"
          busy={action.busy}
          onPress={() =>
            void action.run(async () => {
              await api.call('PATCH', '/profile', userViewSchema, {
                name,
                phone: phone || null,
                theme,
                pushEnabled: push,
                securityEmails: security,
              });
              action.setMessage('Preferences saved.');
            })
          }
        />
        <Button
          label="Upload profile image"
          secondary
          onPress={() =>
            void action.run(async () => {
              const image = await chooseImage();
              if (image) await api.call('PUT', '/profile/avatar', messageViewSchema, image);
            })
          }
        />
        {user.hasAvatar && (
          <Button
            label="Remove profile image"
            secondary
            onPress={() =>
              void action.run(async () => {
                await api.call('DELETE', '/profile/avatar', messageViewSchema);
              })
            }
          />
        )}
      </Card>
      <Card>
        <Txt kind="title">Permissions & sharing</Txt>
        <Txt kind="small">{permissions}</Txt>
        <Button
          label="Review permission choices"
          secondary
          onPress={() => router.push('/permissions')}
        />
        <Button
          label="Refresh permission status"
          secondary
          onPress={() => void action.run(check)}
        />
        <Button
          label="Open device settings"
          secondary
          onPress={() => void Linking.openSettings()}
        />
        <Button
          label="Enable background sharing"
          secondary
          onPress={() =>
            void action.run(async () => {
              if (await enableBackground())
                action.setMessage('Background sharing is enabled for the next active session.');
              await check();
            })
          }
        />
        <Button
          label="Turn background sharing off"
          secondary
          onPress={() =>
            void action.run(async () => {
              await disableBackground();
              action.setMessage('Background tracking stopped. Foreground sharing can continue.');
            })
          }
        />
        <Button
          label="Register push notifications"
          secondary
          onPress={() =>
            void action.run(async () => {
              await registerPush();
              await check();
              action.setMessage('Device registered.');
            })
          }
        />
      </Card>
      <Card>
        <Txt kind="title">Privacy, always.</Txt>
        <Txt kind="small">
          Tracking requires an active SOS or journey and your explicit sharing choice. Location
          history is retained for 7 days by default. Private incident locations stay with the
          report. Closing or force-stopping the app may interrupt tracking.
        </Txt>
        <Button
          label="Delete location history & stop sharing"
          secondary
          onPress={() =>
            Alert.alert(
              'Delete tracking history?',
              'This stops sharing and deletes stored SOS and journey coordinates. Incident locations stay with their reports.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete & stop',
                  style: 'destructive',
                  onPress: () =>
                    void action.run(async () => {
                      await stopTracking();
                      action.setMessage(
                        (await api.call('DELETE', '/location', messageViewSchema)).message,
                      );
                    }),
                },
              ],
            )
          }
        />
      </Card>
      <Card>
        <Txt kind="title">Account management</Txt>
        <Button
          label="Sign out"
          secondary
          busy={action.busy}
          onPress={() =>
            void action.run(async () => {
              await unregisterPush();
              await logout();
              await stopTracking();
            })
          }
        />
        <Button label="Delete my account" secondary onPress={() => setDeleting((v) => !v)} />
        {deleting && (
          <>
            <Banner error>
              Deletion permanently removes your account, contacts, events and private evidence. Sent
              alerts cannot be recalled.
            </Banner>
            <Input
              label="Your password"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
            <Input
              label="Type DELETE to confirm"
              value={confirmation}
              onChangeText={setConfirmation}
              autoCapitalize="characters"
            />
            <Button
              label="Permanently delete account"
              danger
              busy={action.busy}
              disabled={confirmation !== 'DELETE'}
              onPress={() =>
                void action.run(async () => {
                  await api.call('DELETE', '/profile', messageViewSchema, {
                    password,
                    confirmation,
                  });
                  await stopTracking();
                  await save(null);
                })
              }
            />
          </>
        )}
      </Card>
    </Screen>
  );
}
