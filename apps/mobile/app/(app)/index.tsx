import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { configViewSchema } from '@abhaya/validation';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/session';
import {
  Screen,
  Heading,
  Card,
  Txt,
  Row,
  Button,
  Banner,
  Loading,
  useDashboard,
  usePalette,
} from '../../src/ui';
import { Sos } from '../../src/Sos';
import { useLiveLocation } from '../../src/location';
export default function Dashboard() {
  const query = useDashboard(),
    location = useLiveLocation(),
    c = usePalette();
  const config = useQuery({
    queryKey: ['config'],
    queryFn: () => api.call('GET', '/config', configViewSchema),
  });
  if (!query.data || !config.data) {
    if (query.error || config.error)
      return (
        <Screen>
          <Banner error>{(query.error ?? config.error)?.message}</Banner>
          <Button
            label="Try again"
            onPress={() => {
              void query.refetch();
              void config.refetch();
            }}
          />
        </Screen>
      );
    return <Loading />;
  }
  const data = query.data,
    active = data.emergencies.find((e) => e.status === 'ACTIVE'),
    journey = data.journeys.find((j) => ['ACTIVE', 'OVERDUE'].includes(j.status));
  return (
    <Screen refreshing={query.isFetching} onRefresh={() => void query.refetch()}>
      <Row>
        <Txt kind="title">abhaya 1107</Txt>
        <Ionicons name="shield-checkmark-outline" size={26} color={c.accent} />
      </Row>
      <Heading
        eyebrow="A LITTLE MORE PEACE OF MIND"
        title={`Hello, ${data.user.name.split(' ')[0]}.`}
        description="Wherever today takes you, keep your circle close."
      />
      {query.error && <Banner error>{query.error.message}</Banner>}
      <Banner>
        {active
          ? 'Your SOS is active. Review delivery below.'
          : `${data.contacts.filter((c) => c.receivesAlerts).length} alert contacts · No active SOS.`}
      </Banner>
      <Sos active={active} config={config.data} location={location.current} />
      <Card>
        <Row>
          <Ionicons name="location-outline" size={24} color={c.accent} />
          <Txt kind="small">{location.current ? 'GPS obtained' : 'Not located'}</Txt>
        </Row>
        <Txt kind="title">Know where you stand.</Txt>
        <Txt kind="small">
          Allow location to add coordinates to your SOS or report. Refreshing alone does not upload
          them.
        </Txt>
        {location.current && (
          <Txt kind="small">
            {location.current.latitude.toFixed(5)}, {location.current.longitude.toFixed(5)} · ±
            {Math.round(location.current.accuracy)} m{'\n'}
            {new Date(location.current.capturedAt).toLocaleTimeString()}
          </Txt>
        )}
        {location.error && <Banner error>{location.error}</Banner>}
        <Button
          label="Refresh my location"
          secondary
          busy={location.busy}
          onPress={() => void location.refresh()}
        />
      </Card>
      <Card>
        <Txt kind="title">A little company on the way.</Txt>
        <Txt kind="small">
          {journey
            ? `Journey to ${journey.destination} · Check in by ${new Date(journey.expectedAt).toLocaleTimeString()}`
            : 'Set a check-in time for your journey. Alert your contact if you miss it.'}
        </Txt>
        <Button
          label={journey ? 'Open current journey' : 'Plan a safe journey'}
          secondary
          onPress={() => router.push('/journey')}
        />
      </Card>
      <Card>
        <Txt kind="title">Your circle</Txt>
        {data.contacts.length ? (
          data.contacts.slice(0, 3).map((contact) => (
            <Row key={contact.id}>
              <Txt>{contact.name}</Txt>
              <Txt kind="small">
                {contact.isPrimary ? 'Primary' : contact.receivesAlerts ? 'Alerts on' : 'Paused'}
              </Txt>
            </Row>
          ))
        ) : (
          <Txt kind="small">A friend. A sibling. Someone who picks up.</Txt>
        )}
        <Button label="Manage my circle" secondary onPress={() => router.push('/circle')} />
      </Card>
      <Button
        label="Permissions & notifications"
        secondary
        onPress={() => router.push('/permissions')}
      />
    </Screen>
  );
}
