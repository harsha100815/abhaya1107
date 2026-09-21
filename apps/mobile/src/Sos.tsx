import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View, Linking } from 'react-native';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import type { Emergency, AppConfig, LocationPoint } from '@abhaya/types';
import { sosSchema, eventViewSchema, messageViewSchema } from '@abhaya/validation';
import type { z } from 'zod';
import { deliveryLabel } from '@abhaya/utils';
import { api } from './session';
import { queryClient } from './state';
import { Card, Txt, Row, Button, Check, Banner, usePalette, useAction, Feedback } from './ui';
const KEY = 'abhaya.pending-sos';
export function Sos({
  active,
  config,
  location,
}: {
  active?: Emergency;
  config: AppConfig;
  location: LocationPoint | null;
}) {
  const c = usePalette(),
    action = useAction(),
    [phase, setPhase] = useState<'idle' | 'countdown' | 'sending' | 'unconfirmed'>('idle'),
    [seconds, setSeconds] = useState(3),
    [share, setShare] = useState(false),
    [error, setError] = useState('');
  const pending = useRef<z.infer<typeof sosSchema> | null>(null);
  useEffect(() => {
    void SecureStore.getItemAsync(KEY).then((raw) => {
      if (raw) {
        const result = sosSchema.safeParse(JSON.parse(raw));
        if (result.success) {
          pending.current = result.data;
          setPhase('unconfirmed');
          setError(
            'A previous SOS attempt has no saved acknowledgement. Refresh status or retry the same request.',
          );
        }
      }
    });
  }, []);
  useEffect(() => {
    if (active) {
      setPhase('idle');
      pending.current = null;
      void SecureStore.deleteItemAsync(KEY);
    }
  }, [active?.id]);
  const begin = () => {
    pending.current = null;
    setSeconds(3);
    setError('');
    setPhase('countdown');
  };
  const send = async () => {
    setPhase('sending');
    pending.current ??= {
      clientRequestId: Crypto.randomUUID(),
      testMode: config.testOnly,
      shareLocation: share,
      ...(share && location && Date.now() - Date.parse(location.capturedAt) < 120000
        ? { location }
        : {}),
    };
    try {
      await SecureStore.setItemAsync(KEY, JSON.stringify(pending.current));
      await api.call('POST', '/sos', eventViewSchema, pending.current);
      await SecureStore.deleteItemAsync(KEY);
      pending.current = null;
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setPhase('idle');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No server acknowledgement.');
      setPhase('unconfirmed');
    }
  };
  useEffect(() => {
    if (phase !== 'countdown') return;
    const timer = setTimeout(() => {
      if (seconds <= 1) void send();
      else setSeconds((n) => n - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [phase, seconds]);
  if (active)
    return (
      <Card danger>
        <Txt kind="eyebrow" color={c.danger}>
          {active.testMode ? 'TEST SOS ACTIVE' : 'SOS ACTIVE'}
        </Txt>
        <Txt kind="title">Your SOS is recorded.</Txt>
        <Txt kind="small">
          The server acknowledged this event. Contact delivery is tracked separately.
        </Txt>
        {active.notifications.length ? (
          active.notifications.map((n) => (
            <View key={n.id}>
              <Txt>{n.recipientLabel}</Txt>
              <Txt kind="small">{deliveryLabel(n.status)}</Txt>
            </View>
          ))
        ) : (
          <Banner error>No contact alerts were queued. Contact someone directly.</Banner>
        )}
        <Button
          label="I’m safe · resolve SOS"
          busy={action.busy}
          onPress={() =>
            void action.run(async () => {
              await api.call('PATCH', `/sos/${active.id}`, eventViewSchema, { status: 'RESOLVED' });
            })
          }
        />
        <Button
          label="Cancel SOS"
          secondary
          busy={action.busy}
          onPress={() =>
            void action.run(async () => {
              await api.call('PATCH', `/sos/${active.id}`, eventViewSchema, {
                status: 'CANCELLED',
              });
            })
          }
        />
        {active.shareLocation && (
          <Button
            label="Stop location sharing"
            secondary
            onPress={() =>
              void action.run(async () => {
                await api.call('POST', `/sos/${active.id}/stop-sharing`, messageViewSchema, {});
              })
            }
          />
        )}
        <Feedback action={action} />
        <Txt kind="small">Ending SOS stops sharing. Messages already sent cannot be recalled.</Txt>
      </Card>
    );
  return (
    <Card danger>
      <Row>
        <Txt kind="eyebrow">YOUR PEOPLE. WITHIN REACH.</Txt>
        <Txt kind="small">{config.testOnly ? 'TEST MODE' : 'LIVE MODE'}</Txt>
      </Row>
      <Txt kind="title">A direct line to your circle.</Txt>
      <View style={{ alignItems: 'center', paddingVertical: 18 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Hold for SOS"
          accessibilityHint="Hold for over one second to start a cancellable three second countdown"
          accessibilityActions={[{ name: 'activate', label: 'Start SOS countdown' }]}
          onAccessibilityAction={() => {
            if (phase === 'idle') begin();
          }}
          delayLongPress={1200}
          onLongPress={begin}
          disabled={phase !== 'idle'}
          style={({ pressed }) => ({
            width: 194,
            height: 194,
            borderRadius: 97,
            borderWidth: 10,
            borderColor: '#E8B9AF',
            backgroundColor: pressed ? '#912C27' : '#BD413C',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: phase === 'idle' ? 1 : 0.65,
          })}
        >
          <Text style={{ color: '#fff', fontSize: 48, fontWeight: '600', letterSpacing: 2 }}>
            SOS
          </Text>
          <Text style={{ color: '#fff', fontSize: 9, letterSpacing: 1.5, marginTop: 5 }}>
            HOLD TO ACTIVATE
          </Text>
        </Pressable>
      </View>
      {phase === 'countdown' && (
        <>
          <Banner>Activating in {seconds} seconds…</Banner>
          <Button label="Cancel countdown" secondary onPress={() => setPhase('idle')} />
        </>
      )}
      {phase === 'sending' && <Banner>Sending. Waiting for server acknowledgement…</Banner>}
      {phase === 'unconfirmed' && (
        <>
          <Banner error>{error} SOS transmission is unconfirmed.</Banner>
          <Button label="Retry same SOS" onPress={() => void send()} />
          <Button
            label="Refresh SOS status"
            secondary
            onPress={() => void queryClient.invalidateQueries({ queryKey: ['dashboard'] })}
          />
        </>
      )}
      <Check
        label="Share my live location with alerted contacts for this SOS"
        value={share}
        onChange={(v) => {
          if (phase === 'idle') setShare(v);
        }}
      />
      {phase === 'idle' && (
        <Button label="Start SOS countdown without holding" secondary onPress={begin} />
      )}
      <Txt kind="small">
        {config.testOnly
          ? 'Test alerts are simulated. No contact or emergency service will receive them.'
          : 'Alerts go to your configured contacts. ABHAYA does not automatically contact emergency services.'}
      </Txt>
      {config.emergencyNumber && (
        <Button
          label={`Call ${config.emergencyNumber}`}
          secondary
          onPress={() => void Linking.openURL(`tel:${config.emergencyNumber}`)}
        />
      )}
    </Card>
  );
}
