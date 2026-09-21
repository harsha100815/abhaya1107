'use client';
import { useEffect, useState } from 'react';
import type { Dashboard, LocationPoint } from '@abhaya/types';
import { pointViewSchema } from '@abhaya/validation';
import { api, uuid } from '../lib/api';
export function useLocation(data?: Dashboard) {
  const [point, setPoint] = useState<LocationPoint | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [sharingError, setSharingError] = useState('');
  const refresh = () => {
    setError('');
    if (!navigator.geolocation) {
      setError('This browser does not support location. SOS remains available.');
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPoint({
          latitude: p.coords.latitude,
          longitude: p.coords.longitude,
          accuracy: p.coords.accuracy,
          capturedAt: new Date(p.timestamp).toISOString(),
        });
        setBusy(false);
      },
      () => {
        setError(
          'Location unavailable. Check GPS and browser permissions. SOS remains available without coordinates.',
        );
        setBusy(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  };
  const emergency = data?.emergencies.find((e) => e.status === 'ACTIVE' && e.shareLocation),
    journey = data?.journeys.find(
      (j) => ['ACTIVE', 'OVERDUE'].includes(j.status) && j.shareLocation,
    );
  useEffect(() => {
    if ((!emergency && !journey) || !navigator.geolocation) return;
    let latest: LocationPoint | null = null;
    let lastSent = 0;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const flush = async () => {
      timer = undefined;
      const location = latest;
      latest = null;
      if (stopped || !location) return;
      lastSent = Date.now();
      try {
        if (emergency)
          await api.call('POST', '/location', pointViewSchema, {
            clientRequestId: uuid(),
            emergencyId: emergency.id,
            location,
          });
        if (journey && !stopped)
          await api.call('POST', '/location', pointViewSchema, {
            clientRequestId: uuid(),
            safetySessionId: journey.id,
            location,
          });
        if (!stopped) setSharingError('');
      } catch (e) {
        if (!stopped)
          setSharingError(e instanceof Error ? e.message : 'Location update not confirmed.');
      }
    };
    const id = navigator.geolocation.watchPosition(
      (p) => {
        const location = {
          latitude: p.coords.latitude,
          longitude: p.coords.longitude,
          accuracy: p.coords.accuracy,
          capturedAt: new Date(p.timestamp).toISOString(),
        };
        setPoint(location);
        latest = location;
        if (timer === undefined)
          timer = setTimeout(() => void flush(), Math.max(0, 15000 - (Date.now() - lastSent)));
      },
      () => setSharingError('Live location unavailable. Check GPS and permissions.'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 },
    );
    return () => {
      stopped = true;
      clearTimeout(timer);
      navigator.geolocation.clearWatch(id);
    };
  }, [emergency?.id, journey?.id]);
  return { point, error, busy, refresh, sharingError };
}
