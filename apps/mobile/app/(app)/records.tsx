import { useState } from 'react';
import { Alert, Image, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import type { Incident } from '@abhaya/types';
import {
  eventViewSchema,
  journeyViewSchema,
  incidentViewSchema,
  messageViewSchema,
} from '@abhaya/validation';
import { deliveryLabel } from '@abhaya/utils';
import { api, API_URL, tokens } from '../../src/session';
import { chooseImage } from '../../src/images';
import { useLiveLocation } from '../../src/location';
import {
  Screen,
  Heading,
  Card,
  Txt,
  Row,
  Input,
  Button,
  Check,
  Banner,
  useAction,
  Feedback,
} from '../../src/ui';
export default function Records() {
  const [tab, setTab] = useState<'sos' | 'journeys' | 'reports'>('sos'),
    [show, setShow] = useState(false),
    [category, setCategory] = useState('OTHER'),
    [description, setDescription] = useState(''),
    [attachLocation, setAttachLocation] = useState(false),
    [image, setImage] = useState<Awaited<ReturnType<typeof chooseImage>>>(null),
    [selected, setSelected] = useState<string | null>(null);
  const action = useAction(),
    location = useLiveLocation();
  const history = useQuery({
    queryKey: ['history', tab],
    queryFn: async () => {
      if (tab === 'sos')
        return {
          kind: 'sos' as const,
          items: await api.call('GET', '/sos?take=100', eventViewSchema.array()),
        };
      if (tab === 'journeys')
        return {
          kind: 'journeys' as const,
          items: await api.call('GET', '/safety-sessions?take=100', journeyViewSchema.array()),
        };
      return {
        kind: 'reports' as const,
        items: await api.call('GET', '/incidents?take=100', incidentViewSchema.array()),
      };
    },
  });
  return (
    <Screen>
      <Heading
        eyebrow="YOUR PRIVATE TIMELINE"
        title="Every step, accounted for."
        description="Your history and evidence are visible only to you."
      />
      <Row>
        {(['sos', 'journeys', 'reports'] as const).map((t) => (
          <Button
            key={t}
            label={t === 'sos' ? 'SOS' : t === 'journeys' ? 'Journeys' : 'Reports'}
            secondary={tab !== t}
            onPress={() => {
              setTab(t);
              setSelected(null);
            }}
          />
        ))}
      </Row>
      <Feedback action={action} />
      {tab === 'reports' && (
        <Button label="Create private report" onPress={() => setShow((v) => !v)} />
      )}{' '}
      {show && tab === 'reports' && (
        <Card>
          <Txt kind="title">Make a note. Keep it safe.</Txt>
          <Txt kind="small">This saves a private record, not a police complaint.</Txt>
          <Txt kind="small">Category</Txt>
          {[
            'HARASSMENT',
            'SUSPICIOUS_ACTIVITY',
            'ACCIDENT',
            'UNSAFE_LOCATION',
            'MEDICAL',
            'OTHER',
          ].map((c) => (
            <Check
              key={c}
              label={c.replaceAll('_', ' ')}
              value={category === c}
              onChange={() => setCategory(c)}
            />
          ))}
          <Input
            label="What happened?"
            multiline
            numberOfLines={4}
            style={{ minHeight: 120, textAlignVertical: 'top' }}
            value={description}
            onChangeText={setDescription}
            maxLength={4000}
          />
          <Txt kind="small">
            The report records the current time. Describe an earlier incident’s time in the text.
          </Txt>
          <Check
            label="Attach my current location"
            value={attachLocation}
            onChange={setAttachLocation}
          />
          {attachLocation && (
            <>
              <Button
                label="Get report location"
                secondary
                busy={location.busy}
                onPress={() => void location.refresh()}
              />
              {location.error && <Banner error>{location.error}</Banner>}
              {location.current && <Txt kind="small">Coordinates ready to attach.</Txt>}
            </>
          )}
          <Button
            label={image ? 'Replace selected image' : 'Choose evidence image'}
            secondary
            onPress={() => void action.run(async () => setImage(await chooseImage()))}
          />
          <Button
            label="Take evidence photo"
            secondary
            onPress={() => void action.run(async () => setImage(await chooseImage(true)))}
          />
          {image && <Banner>One image is ready for private upload.</Banner>}
          <Button
            label="Save private report"
            busy={action.busy}
            onPress={() =>
              void action.run(async () => {
                const report = await api.call('POST', '/incidents', incidentViewSchema, {
                  clientRequestId: Crypto.randomUUID(),
                  category,
                  description,
                  occurredAt: new Date().toISOString(),
                  ...(attachLocation && location.current ? { location: location.current } : {}),
                });
                setShow(false);
                setDescription('');
                if (image) {
                  try {
                    await api.call(
                      'PUT',
                      `/incidents/${report.id}/evidence`,
                      messageViewSchema,
                      image,
                    );
                    setImage(null);
                  } catch (e) {
                    action.setMessage(
                      'Report saved. Evidence upload failed; open the report to retry.',
                    );
                    throw e;
                  }
                }
                action.setMessage('Private report saved.');
              })
            }
          />
          <Button label="Cancel report" secondary onPress={() => setShow(false)} />
        </Card>
      )}
      {history.isPending && <Txt>Loading history…</Txt>}
      {history.error && (
        <>
          <Banner error>{history.error.message}</Banner>
          <Button label="Retry" onPress={() => void history.refetch()} />
        </>
      )}
      {history.data?.kind === 'sos' &&
        history.data.items.map((e) => (
          <Card key={e.id}>
            <Txt kind="eyebrow">
              {e.testMode ? 'TEST SOS' : 'SOS'} · {e.status}
            </Txt>
            <Txt>{new Date(e.createdAt).toLocaleString()}</Txt>
            <Button
              label={selected === e.id ? 'Close details' : 'View event details'}
              secondary
              onPress={() => setSelected(selected === e.id ? null : e.id)}
            />
            {selected === e.id && (
              <>
                {e.locations[0] ? (
                  <Txt kind="small">
                    Last location: {e.locations[0].latitude}, {e.locations[0].longitude} ·{' '}
                    {new Date(e.locations[0].capturedAt).toLocaleString()}
                  </Txt>
                ) : (
                  <Txt kind="small">No location recorded.</Txt>
                )}
                {e.notifications.map((n) => (
                  <Txt key={n.id} kind="small">
                    {n.recipientLabel}: {deliveryLabel(n.status)}
                  </Txt>
                ))}
                {e.endedAt && <Txt kind="small">Ended {new Date(e.endedAt).toLocaleString()}</Txt>}
              </>
            )}
          </Card>
        ))}
      {history.data?.kind === 'journeys' &&
        history.data.items.map((j) => (
          <Card key={j.id}>
            <Txt kind="eyebrow">
              {j.testMode ? 'TEST · ' : ''}
              {j.status}
            </Txt>
            <Txt kind="title">{j.destination}</Txt>
            <Txt kind="small">
              Started {new Date(j.createdAt).toLocaleString()}
              {'\n'}Expected {new Date(j.expectedAt).toLocaleString()}
            </Txt>
            <Button
              label={selected === j.id ? 'Close details' : 'View journey details'}
              secondary
              onPress={() => setSelected(selected === j.id ? null : j.id)}
            />
            {selected === j.id && (
              <>
                <Txt kind="small">
                  {j.lastCheckInAt
                    ? `Checked in ${new Date(j.lastCheckInAt).toLocaleString()}`
                    : 'No manual check-in recorded.'}
                </Txt>
                {j.locations[0] && (
                  <Txt kind="small">
                    Last location: {j.locations[0].latitude}, {j.locations[0].longitude}
                  </Txt>
                )}
                {j.notifications.map((n) => (
                  <Txt key={n.id} kind="small">
                    {n.recipientLabel}: {deliveryLabel(n.status)}
                  </Txt>
                ))}
              </>
            )}
          </Card>
        ))}
      {history.data?.kind === 'reports' &&
        history.data.items.map((i) => <Report key={i.id} incident={i} />)}
      {history.data?.items.length === 0 && (
        <Card>
          <Txt kind="title">Your story starts here.</Txt>
          <Txt kind="small">Your history will appear as you use ABHAYA.</Txt>
        </Card>
      )}
    </Screen>
  );
}
function Report({ incident: i }: { incident: Incident }) {
  const action = useAction(),
    [evidence, setEvidence] = useState<{ uri: string; headers: { Authorization: string } } | null>(
      null,
    );
  return (
    <Card>
      <Txt kind="eyebrow">{i.category.replaceAll('_', ' ')} · PRIVATE</Txt>
      <Txt kind="small">{new Date(i.occurredAt).toLocaleString()}</Txt>
      <Txt>{i.description}</Txt>
      {i.latitude !== null && (
        <Txt kind="small">
          {i.latitude}, {i.longitude}
        </Txt>
      )}
      {i.hasEvidence && (
        <Button
          label="View private evidence"
          secondary
          onPress={() =>
            void action.run(async () => {
              await api.call('GET', '/profile', importSchema);
              const session = await tokens.read();
              if (!session) throw new Error('Sign in again.');
              setEvidence({
                uri: `${API_URL}/incidents/${i.id}/evidence`,
                headers: { Authorization: `Bearer ${session.accessToken}` },
              });
            })
          }
        />
      )}{' '}
      {evidence && (
        <View>
          <Image
            source={{ ...evidence, cache: 'reload' }}
            style={{ height: 250, width: '100%', borderRadius: 14 }}
            resizeMode="contain"
            accessibilityLabel="Your private evidence image"
            onError={() =>
              action.setMessage('Image could not load. Refresh your session and retry.')
            }
          />
        </View>
      )}
      <Button
        label={i.hasEvidence ? 'Replace evidence' : 'Attach evidence'}
        secondary
        onPress={() =>
          void action.run(async () => {
            const image = await chooseImage();
            if (image)
              await api.call('PUT', `/incidents/${i.id}/evidence`, messageViewSchema, image);
          })
        }
      />
      <Button
        label="Delete report"
        secondary
        onPress={() =>
          Alert.alert('Delete report?', 'This permanently removes the report and its evidence.', [
            { text: 'Keep report', style: 'cancel' },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: () =>
                void action.run(async () => {
                  await api.call('DELETE', `/incidents/${i.id}`, messageViewSchema);
                }),
            },
          ])
        }
      />
      <Feedback action={action} />
    </Card>
  );
}
import { userViewSchema as importSchema } from '@abhaya/validation';
