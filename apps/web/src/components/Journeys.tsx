'use client';
import { useEffect, useState } from 'react';
import { Navigation, Check, Clock, ArrowRight } from 'lucide-react';
import type { Journey, Contact, AppConfig } from '@abhaya/types';
import { journeyViewSchema, messageViewSchema } from '@abhaya/validation';
import { deliveryLabel } from '@abhaya/utils';
import { api, uuid, readableTime } from '../lib/api';
import { Button, Field, Badge, Empty, Notice, useAction, ActionNotice } from './common';
export function Journeys({
  journeys,
  contacts,
  config,
}: {
  journeys: Journey[];
  contacts: Contact[];
  config: AppConfig;
}) {
  const action = useAction(),
    [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const active = journeys.find((j) => ['ACTIVE', 'OVERDUE'].includes(j.status));
  const change = (j: Journey, verb: string) =>
    void action.run(async () => {
      await api.call('PATCH', `/safety-sessions/${j.id}`, journeyViewSchema, {
        action: verb,
        ...(['extend', 'check-in'].includes(verb)
          ? {
              expectedAt: new Date(
                Math.max(Date.now(), Date.parse(j.expectedAt)) + 15 * 60000,
              ).toISOString(),
            }
          : {}),
      });
    });
  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">FROM HERE TO HOME</p>
          <h2>A little company on the way.</h2>
          <p>Set a check-in time. Let your circle know if you miss it.</p>
        </div>
        <Navigation size={32} />
      </div>
      <ActionNotice action={action} />
      {active ? (
        <section className="card journey-active">
          <div className="row between">
            <Badge alert={active.status === 'OVERDUE'}>
              {active.status === 'OVERDUE' ? 'Check-in overdue' : 'Journey in progress'}
            </Badge>
            <Badge>{active.testMode ? 'TEST' : 'LIVE'}</Badge>
          </div>
          <h2>{active.destination}</h2>
          <div className="time-left">
            {Math.max(0, Math.ceil((Date.parse(active.expectedAt) - now) / 60000))}
            <span>minutes to check-in</span>
          </div>
          <p>Expected {readableTime(active.expectedAt)}</p>
          {active.status === 'OVERDUE' && (
            <Notice error>You missed your planned check-in. This is not an automatic SOS.</Notice>
          )}
          <div className="row wrap">
            <Button
              className="primary"
              busy={action.busy}
              onClick={() => change(active, 'complete')}
            >
              <Check size={17} />
              Arrived safely
            </Button>
            <Button
              className="secondary"
              busy={action.busy}
              onClick={() => change(active, 'check-in')}
            >
              Check in · add 15 min
            </Button>
            <Button
              className="secondary"
              busy={action.busy}
              onClick={() => change(active, 'extend')}
            >
              <Clock size={17} />
              Extend 15 min
            </Button>
            <Button className="link" busy={action.busy} onClick={() => change(active, 'cancel')}>
              Cancel journey
            </Button>
          </div>
          {active.shareLocation && (
            <Button
              className="link"
              onClick={() =>
                void action.run(async () => {
                  await api.call(
                    'POST',
                    `/safety-sessions/${active.id}/stop-sharing`,
                    messageViewSchema,
                    {},
                  );
                })
              }
            >
              Stop location sharing
            </Button>
          )}
          {active.notifications.map((n) => (
            <p className="small" key={n.id}>
              {n.recipientLabel}: {deliveryLabel(n.status)}
            </p>
          ))}
        </section>
      ) : (
        <section className="card">
          <h3>Where are you heading?</h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void action.run(async () => {
                await api.call('POST', '/safety-sessions', journeyViewSchema, {
                  clientRequestId: uuid(),
                  destination: f.get('destination'),
                  expectedAt: new Date(Date.now() + Number(f.get('minutes')) * 60000).toISOString(),
                  contactId: f.get('contact'),
                  shareLocation: f.get('share') === 'on',
                  testMode: config.testOnly,
                });
              });
            }}
          >
            <div className="form-grid">
              <Field label="Destination">
                <input
                  name="destination"
                  placeholder="Home, a friend’s place…"
                  minLength={2}
                  maxLength={160}
                  required
                />
              </Field>
              <Field label="Check in after">
                <select name="minutes">
                  <option value="15">15 minutes</option>
                  <option value="30">30 minutes</option>
                  <option value="60">1 hour</option>
                  <option value="120">2 hours</option>
                </select>
              </Field>
              <Field label="Alert this person if I miss check-in">
                <select name="contact" required defaultValue="">
                  <option value="" disabled>
                    Choose a trusted contact
                  </option>
                  {contacts
                    .filter((c) => c.receivesAlerts)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </Field>
            </div>
            <label className="check">
              <input type="checkbox" name="share" />
              Share live location during this journey
            </label>
            <p className="small">
              Your contact is alerted only if the check-in time passes.{' '}
              {config.testOnly
                ? 'In TEST MODE no message is actually sent.'
                : 'Provider delivery can fail; check alert status.'}{' '}
              Browser tracking needs this page to stay open.
            </p>
            <Button
              className="primary"
              busy={action.busy}
              disabled={!contacts.some((c) => c.receivesAlerts)}
            >
              Start {config.testOnly ? 'test ' : ''}journey
              <ArrowRight size={17} />
            </Button>
          </form>
          {!contacts.length && (
            <Empty title="First, add someone you trust.">
              Add an emergency contact in Your circle to start a journey.
            </Empty>
          )}
        </section>
      )}
    </>
  );
}
