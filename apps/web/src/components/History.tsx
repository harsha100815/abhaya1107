'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { eventViewSchema, journeyViewSchema, incidentViewSchema } from '@abhaya/validation';
import { deliveryLabel } from '@abhaya/utils';
import { api, readableTime } from '../lib/api';
import { Badge, Empty, Notice, Button } from './common';
export function History() {
  const [tab, setTab] = useState<'sos' | 'safety-sessions' | 'incidents'>('sos'),
    [take, setTake] = useState(30);
  const query = useQuery({
    queryKey: ['history', tab, take],
    queryFn: async () => {
      if (tab === 'sos')
        return (await api.call('GET', `/sos?take=${take}`, eventViewSchema.array())).map((e) => ({
          id: e.id,
          title: 'SOS event',
          at: e.createdAt,
          status: e.status,
          detail:
            e.notifications
              .map((n) => `${n.recipientLabel}: ${deliveryLabel(n.status)}`)
              .join('\n') || 'No contact alerts recorded.',
          location: e.locations[0]
            ? `${e.locations[0].latitude}, ${e.locations[0].longitude}`
            : 'No location recorded',
          mode: e.testMode ? 'TEST' : 'LIVE',
        }));
      if (tab === 'safety-sessions')
        return (
          await api.call('GET', `/safety-sessions?take=${take}`, journeyViewSchema.array())
        ).map((j) => ({
          id: j.id,
          title: j.destination,
          at: j.createdAt,
          status: j.status,
          detail: `Expected ${readableTime(j.expectedAt)}${j.lastCheckInAt ? ` · Last check-in ${readableTime(j.lastCheckInAt)}` : ''}`,
          location: j.locations[0]
            ? `${j.locations[0].latitude}, ${j.locations[0].longitude}`
            : 'No location recorded',
          mode: j.testMode ? 'TEST' : 'LIVE',
        }));
      return (await api.call('GET', `/incidents?take=${take}`, incidentViewSchema.array())).map(
        (i) => ({
          id: i.id,
          title: i.category.replaceAll('_', ' '),
          at: i.occurredAt,
          status: 'PRIVATE',
          detail: i.description,
          location: i.latitude !== null ? `${i.latitude}, ${i.longitude}` : 'No location recorded',
          mode: 'PRIVATE',
        }),
      );
    },
  });
  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">YOUR TIMELINE</p>
          <h2>Every step, accounted for.</h2>
          <p>Your history is visible only to you.</p>
        </div>
      </div>
      <div className="segmented">
        {(['sos', 'safety-sessions', 'incidents'] as const).map((t) => (
          <button
            key={t}
            aria-pressed={t === tab}
            className={t === tab ? 'selected' : ''}
            onClick={() => {
              setTab(t);
              setTake(30);
            }}
          >
            {t === 'sos' ? 'SOS events' : t === 'safety-sessions' ? 'Journeys' : 'Reports'}
          </button>
        ))}
      </div>
      {query.isPending && <p role="status">Loading your history…</p>}
      {query.error && <Notice error>{query.error.message}</Notice>}
      {query.data?.map((row) => (
        <details className="card history-row" key={row.id}>
          <summary>
            <span className="timeline-dot" />
            <div>
              <strong>{row.title}</strong>
              <p className="small">
                {readableTime(row.at)} · {row.mode}
              </p>
            </div>
            <Badge>{row.status}</Badge>
          </summary>
          <p className="preserve">{row.detail}</p>
          <p className="small">{row.location}</p>
        </details>
      ))}
      {query.data?.length === 0 && (
        <Empty title="Your story starts here.">
          Your SOS events, journeys and reports will appear as you use ABHAYA.
        </Empty>
      )}
      {query.data?.length === take && take < 100 && (
        <Button className="secondary" onClick={() => setTake(100)}>
          Load more history
        </Button>
      )}
    </>
  );
}
