import { useEffect, useState } from 'react';
import * as Crypto from 'expo-crypto';
import { useQuery } from '@tanstack/react-query';
import { configViewSchema, journeyViewSchema, messageViewSchema } from '@abhaya/validation';
import { deliveryLabel } from '@abhaya/utils';
import { api } from '../../src/session';
import {
  Screen,
  Heading,
  Card,
  Txt,
  Input,
  Button,
  Check,
  Banner,
  useDashboard,
  useAction,
  Feedback,
} from '../../src/ui';
export default function Journey() {
  const query = useDashboard(),
    action = useAction(),
    [destination, setDestination] = useState(''),
    [minutes, setMinutes] = useState('30'),
    [contactId, setContact] = useState(''),
    [share, setShare] = useState(false),
    [now, setNow] = useState(Date.now());
  const config = useQuery({
    queryKey: ['config'],
    queryFn: () => api.call('GET', '/config', configViewSchema),
  });
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  if (!query.data || !config.data)
    return (
      <Screen>
        <Banner error={!!(query.error || config.error)}>
          {(query.error ?? config.error)?.message ?? 'Loading your journey…'}
        </Banner>
        <Button
          label="Retry"
          onPress={() => {
            void query.refetch();
            void config.refetch();
          }}
        />
      </Screen>
    );
  const active = query.data.journeys.find((j) => ['ACTIVE', 'OVERDUE'].includes(j.status));
  const change = (verb: string) =>
    void action.run(async () => {
      if (!active) return;
      await api.call('PATCH', `/safety-sessions/${active.id}`, journeyViewSchema, {
        action: verb,
        ...(['extend', 'check-in'].includes(verb)
          ? {
              expectedAt: new Date(
                Math.max(now, Date.parse(active.expectedAt)) + 900000,
              ).toISOString(),
            }
          : {}),
      });
    });
  return (
    <Screen>
      <Heading
        eyebrow="FROM HERE TO HOME"
        title="A little company on the way."
        description="A missed check-in alerts your contact. It does not automatically create an SOS."
      />
      <Feedback action={action} />
      {active ? (
        <Card>
          <Txt kind="eyebrow">
            {active.testMode ? 'TEST · ' : ''}
            {active.status}
          </Txt>
          <Txt kind="title">{active.destination}</Txt>
          <Txt kind="display">
            {Math.max(0, Math.ceil((Date.parse(active.expectedAt) - now) / 60000))} min
          </Txt>
          <Txt kind="small">Check in by {new Date(active.expectedAt).toLocaleTimeString()}</Txt>
          {active.status === 'OVERDUE' && (
            <Banner error>
              Your check-in is overdue. Contact your trusted person directly if necessary.
            </Banner>
          )}
          <Button label="I arrived safely" busy={action.busy} onPress={() => change('complete')} />
          <Button
            label="Check in · add 15 min"
            secondary
            busy={action.busy}
            onPress={() => change('check-in')}
          />
          <Button
            label="Extend by 15 min"
            secondary
            busy={action.busy}
            onPress={() => change('extend')}
          />
          {active.shareLocation && (
            <Button
              label="Stop location sharing"
              secondary
              onPress={() =>
                void action.run(async () => {
                  await api.call(
                    'POST',
                    `/safety-sessions/${active.id}/stop-sharing`,
                    messageViewSchema,
                    {},
                  );
                })
              }
            />
          )}
          <Button label="Cancel journey" secondary onPress={() => change('cancel')} />
          {active.notifications.map((n) => (
            <Txt key={n.id} kind="small">
              {n.recipientLabel}: {deliveryLabel(n.status)}
            </Txt>
          ))}
        </Card>
      ) : (
        <Card>
          <Txt kind="title">Where are you heading?</Txt>
          <Input
            label="Destination"
            value={destination}
            onChangeText={setDestination}
            placeholder="Home, a friend’s place…"
          />
          <Input
            label="Check in after · minutes"
            keyboardType="number-pad"
            value={minutes}
            onChangeText={setMinutes}
          />
          <Txt kind="small">Alert this person if I miss check-in:</Txt>
          {query.data.contacts
            .filter((c) => c.receivesAlerts)
            .map((c) => (
              <Check
                key={c.id}
                label={c.name}
                value={contactId === c.id}
                onChange={() => setContact(c.id)}
              />
            ))}
          {!query.data.contacts.some((c) => c.receivesAlerts) && (
            <Banner>Add an alert-enabled contact in Your circle before starting.</Banner>
          )}
          <Check
            label="Share my live location during this journey"
            value={share}
            onChange={setShare}
          />
          <Txt kind="small">
            {config.data.testOnly
              ? 'TEST MODE: no real message will be sent.'
              : 'LIVE MODE: the configured contact will be alerted if your check-in is missed.'}
          </Txt>
          <Button
            label="Start journey"
            busy={action.busy}
            disabled={!contactId}
            onPress={() =>
              void action.run(async () => {
                await api.call('POST', '/safety-sessions', journeyViewSchema, {
                  clientRequestId: Crypto.randomUUID(),
                  destination,
                  expectedAt: new Date(Date.now() + Number(minutes) * 60000).toISOString(),
                  contactId,
                  shareLocation: share,
                  testMode: config.data.testOnly,
                });
              })
            }
          />
        </Card>
      )}
    </Screen>
  );
}
