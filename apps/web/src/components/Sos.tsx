'use client';
import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Phone, ShieldAlert } from 'lucide-react';
import type { AppConfig, Emergency, LocationPoint } from '@abhaya/types';
import { eventViewSchema, messageViewSchema } from '@abhaya/validation';
import { deliveryLabel } from '@abhaya/utils';
import { api, uuid } from '../lib/api';
import { Button, Notice, Badge, useAction, ActionNotice } from './common';
export function Sos({
  active,
  config,
  point,
}: {
  active?: Emergency;
  config: AppConfig;
  point: LocationPoint | null;
}) {
  const [phase, setPhase] = useState<'idle' | 'countdown' | 'sending' | 'unconfirmed'>('idle'),
    [count, setCount] = useState(3),
    [share, setShare] = useState(false),
    [error, setError] = useState(''),
    [holding, setHolding] = useState(false);
  const held = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<{
    clientRequestId: string;
    testMode: boolean;
    shareLocation: boolean;
    location?: LocationPoint;
  } | null>(null);
  const client = useQueryClient(),
    action = useAction();
  const start = () => {
    if (active || phase === 'sending') return;
    pending.current = null;
    setCount(3);
    setError('');
    setPhase('countdown');
  };
  const send = async () => {
    setPhase('sending');
    pending.current ??= {
      clientRequestId: uuid(),
      testMode: config.testOnly,
      shareLocation: share,
      ...(share && point && Date.now() - Date.parse(point.capturedAt) < 120000
        ? { location: point }
        : {}),
    };
    try {
      await api.call('POST', '/sos', eventViewSchema, pending.current);
      await client.invalidateQueries({ queryKey: ['dashboard'] });
      setPhase('idle');
      pending.current = null;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Server acknowledgement not received.');
      setPhase('unconfirmed');
    }
  };
  useEffect(() => {
    if (phase !== 'countdown') return;
    const timer = setTimeout(() => {
      if (count <= 1) void send();
      else setCount((n) => n - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [phase, count]);
  useEffect(
    () => () => {
      if (held.current) clearTimeout(held.current);
    },
    [],
  );
  const release = () => {
    if (held.current) clearTimeout(held.current);
    setHolding(false);
  };
  if (active)
    return (
      <section className="sos-panel active">
        <div className="row between">
          <Badge alert>{active.testMode ? 'TEST SOS ACTIVE' : 'SOS ACTIVE'}</Badge>
          <ShieldAlert />
        </div>
        <h2>Your SOS is recorded.</h2>
        <p>ABHAYA acknowledged this event. Check each contact’s delivery status below.</p>
        {active.notifications.length ? (
          active.notifications.map((n) => (
            <div className="delivery" key={n.id}>
              <strong>{n.recipientLabel}</strong>
              <span>{deliveryLabel(n.status)}</span>
            </div>
          ))
        ) : (
          <Notice error>
            No contact alerts were queued. Add alert-enabled contacts and contact someone directly.
          </Notice>
        )}
        <div className="row wrap">
          <Button
            busy={action.busy}
            className="primary"
            onClick={() =>
              void action.run(async () => {
                await api.call('PATCH', `/sos/${active.id}`, eventViewSchema, {
                  status: 'RESOLVED',
                });
              })
            }
          >
            I’m safe · resolve SOS
          </Button>
          <Button
            busy={action.busy}
            className="secondary"
            onClick={() =>
              void action.run(async () => {
                await api.call('PATCH', `/sos/${active.id}`, eventViewSchema, {
                  status: 'CANCELLED',
                });
              })
            }
          >
            Cancel SOS
          </Button>
          {active.shareLocation && (
            <Button
              busy={action.busy}
              className="link"
              onClick={() =>
                void action.run(async () => {
                  await api.call('POST', `/sos/${active.id}/stop-sharing`, messageViewSchema, {});
                })
              }
            >
              Stop location sharing
            </Button>
          )}
        </div>
        <ActionNotice action={action} />
        <p className="small">
          Resolving or cancelling stops tracking. Messages already sent cannot be recalled.
        </p>
      </section>
    );
  return (
    <section className="sos-panel">
      <div className="row between">
        <p className="eyebrow">WHEN EVERY SECOND MATTERS</p>
        <Badge>{config.testOnly ? 'TEST MODE' : 'LIVE MODE'}</Badge>
      </div>
      <div className="sos-content">
        <div>
          <h2>
            A direct line
            <br /> to your people.
          </h2>
          <p>
            Hold to start a 3-second countdown.
            <br /> You can cancel before activation.
          </p>
        </div>
        <button
          className={`sos-button ${holding ? 'holding' : ''}`}
          aria-label="Hold for SOS"
          disabled={phase !== 'idle'}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            setHolding(true);
            held.current = setTimeout(() => {
              setHolding(false);
              start();
            }, 1200);
          }}
          onPointerUp={release}
          onPointerCancel={release}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              start();
            }
          }}
        >
          <span>SOS</span>
          <small>HOLD TO ACTIVATE</small>
        </button>
      </div>
      {phase === 'countdown' && (
        <div className="countdown" role="alert">
          <strong>Activating in {count}…</strong>
          <Button className="secondary" onClick={() => setPhase('idle')}>
            Cancel countdown
          </Button>
        </div>
      )}
      {phase === 'sending' && <Notice>Sending. Waiting for server acknowledgement…</Notice>}
      {phase === 'unconfirmed' && (
        <>
          <Notice error>
            {error} Your SOS is unconfirmed. It may have reached the server; refresh status or retry
            using the same request.
          </Notice>
          <div className="row">
            <Button className="secondary" onClick={() => void send()}>
              Retry same SOS
            </Button>
            <Button
              className="link"
              onClick={() => void client.invalidateQueries({ queryKey: ['dashboard'] })}
            >
              Refresh status
            </Button>
          </div>
        </>
      )}
      <label className="check">
        <input
          type="checkbox"
          checked={share}
          disabled={phase !== 'idle'}
          onChange={(e) => setShare(e.target.checked)}
        />{' '}
        Share my live location with alerted contacts for this SOS
      </label>
      {share && !point && (
        <p className="small">
          Current coordinates are unavailable. Tracking will try after activation if permission is
          granted.
        </p>
      )}
      <div className="sos-foot">
        <button className="link" disabled={phase !== 'idle'} onClick={start}>
          Start countdown without holding
        </button>
        {config.emergencyNumber && (
          <a className="link" href={`tel:${config.emergencyNumber}`}>
            <Phone size={15} />
            Call {config.emergencyNumber}
          </a>
        )}
      </div>
      <p className="small">
        {config.testOnly
          ? 'Test alerts are simulated. No contact or emergency service will receive them.'
          : 'Alerts go to configured contacts. ABHAYA does not automatically contact emergency services.'}
      </p>
    </section>
  );
}
