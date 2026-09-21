'use client';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import { pointViewSchema } from '@abhaya/validation';
import { api } from '../../lib/api';
import { SafetyMap } from '../../components/SafetyMap';
const schema = z.object({
  name: z.string(),
  status: z.string(),
  testMode: z.boolean(),
  location: pointViewSchema.nullable(),
  expiresAt: z.string(),
});
export default function Tracking() {
  const [data, setData] = useState<z.infer<typeof schema> | null>(null),
    [error, setError] = useState('');
  useEffect(() => {
    const token = new URLSearchParams(location.hash.slice(1)).get('token');
    history.replaceState(null, '', location.pathname);
    if (!token) {
      setError('Open the private link sent by your contact.');
      return;
    }
    let stopped = false;
    const load = async () => {
      try {
        const result = await api.call('POST', '/tracking/lookup', schema, { token });
        if (!stopped) {
          setData(result);
          setError('');
        }
      } catch (e) {
        if (!stopped) {
          setData(null);
          setError(e instanceof Error ? e.message : 'Sharing unavailable.');
        }
      }
    };
    void load();
    const timer = setInterval(() => void load(), 15000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, []);
  return (
    <main className="public-page">
      <a className="brand" href="/">
        abhaya<span className="brand-number">1107</span>
      </a>
      <section className="card">
        <p className="eyebrow">PRIVATE CONTACT LINK</p>
        <h1>{data ? `${data.name} is sharing with you.` : 'Contact location'}</h1>
        {error && <p role="alert">{error}</p>}
        {data && (
          <>
            <p>
              {data.testMode ? 'TEST MODE · ' : ''}
              {data.status} · Expires {new Date(data.expiresAt).toLocaleString()}
            </p>
            <p>
              A missed check-in does not confirm an emergency. Contact your trusted person directly.
            </p>
            {data.location ? (
              <p>
                Last update: {new Date(data.location.capturedAt).toLocaleString()} · ±
                {Math.round(data.location.accuracy)} m
              </p>
            ) : (
              <p>No device coordinates have been received.</p>
            )}
            <SafetyMap point={data.location} />
          </>
        )}
      </section>
    </main>
  );
}
