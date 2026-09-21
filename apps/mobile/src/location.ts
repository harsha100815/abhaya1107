import { useEffect, useState } from 'react';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { Alert, AppState, Linking, Platform, DeviceEventEmitter } from 'react-native';
import { z } from 'zod';
import { pointViewSchema } from '@abhaya/validation';
import type { Dashboard, LocationPoint } from '@abhaya/types';
import { api } from './session';
import { ApiError } from '@abhaya/client';
const TASK = 'abhaya-active-location',
  KEY = 'abhaya.tracking.v1',
  ERROR = 'abhaya.tracking.error';
const targetsSchema = z.array(
  z.object({ emergencyId: z.string().optional(), safetySessionId: z.string().optional() }),
);
const point = (p: Location.LocationObject): LocationPoint => ({
  latitude: p.coords.latitude,
  longitude: p.coords.longitude,
  accuracy: p.coords.accuracy ?? 100000,
  capturedAt: new Date(p.timestamp).toISOString(),
});
async function transmit(location: LocationPoint) {
  const raw = await SecureStore.getItemAsync(KEY);
  const targets = raw ? targetsSchema.parse(JSON.parse(raw)) : [];
  for (const target of targets) {
    try {
      await api.call('POST', '/location', pointViewSchema, {
        ...target,
        clientRequestId: Crypto.randomUUID(),
        location,
      });
    } catch (e) {
      if (e instanceof ApiError && [401, 409].includes(e.status)) {
        const remaining = targets.filter((t) => t !== target);
        await SecureStore.setItemAsync(KEY, JSON.stringify(remaining));
        if (!remaining.length) await stopTracking();
      }
      throw e;
    }
  }
}
TaskManager.defineTask<{ locations: Location.LocationObject[] }>(TASK, async ({ data, error }) => {
  if (error) {
    await SecureStore.setItemAsync(
      ERROR,
      'Background location is unavailable. Check permissions and GPS.',
    );
    return;
  }
  const latest = data?.locations.at(-1);
  if (!latest) return;
  try {
    await transmit(point(latest));
    await SecureStore.deleteItemAsync(ERROR);
  } catch {
    await SecureStore.setItemAsync(
      ERROR,
      'A background location update was not confirmed. Check your connection.',
    );
  }
});
export async function stopTracking() {
  await SecureStore.deleteItemAsync(KEY);
  if (await Location.hasStartedLocationUpdatesAsync(TASK))
    await Location.stopLocationUpdatesAsync(TASK);
}
export async function enableBackground() {
  const accepted = await new Promise<boolean>((resolve) =>
    Alert.alert(
      'Location while the app is in the background',
      'During an active SOS or journey, ABHAYA will share location with alerted contacts even when you switch apps. Android shows a persistent notification. You can stop sharing at any time.',
      [
        { text: 'Not now', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Continue', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    ),
  );
  if (!accepted) return false;
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== 'granted')
    throw new Error('Allow foreground location before background sharing.');
  const result = await Location.requestBackgroundPermissionsAsync();
  if (result.status !== 'granted')
    throw new Error('Background permission is off. You can enable it in Settings.');
  await SecureStore.setItemAsync('abhaya.background', 'enabled');
  DeviceEventEmitter.emit('abhaya-tracking-preferences');
  return true;
}
export async function disableBackground() {
  await SecureStore.deleteItemAsync('abhaya.background');
  if (await Location.hasStartedLocationUpdatesAsync(TASK))
    await Location.stopLocationUpdatesAsync(TASK);
  DeviceEventEmitter.emit('abhaya-tracking-preferences');
}
export function useLiveLocation(data?: Dashboard) {
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const event = DeviceEventEmitter.addListener('abhaya-tracking-preferences', () =>
      setRevision((r) => r + 1),
    );
    return () => event.remove();
  }, []);
  const [current, setCurrent] = useState<LocationPoint | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const emergency = data?.emergencies.find((e) => e.status === 'ACTIVE' && e.shareLocation),
    journey = data?.journeys.find(
      (j) => ['ACTIVE', 'OVERDUE'].includes(j.status) && j.shareLocation,
    );
  const refresh = async () => {
    setBusy(true);
    setError('');
    try {
      const enabled = await Location.hasServicesEnabledAsync();
      if (!enabled) throw new Error('GPS is off. Enable device location services.');
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted')
        throw new Error('Location permission is off. SOS remains available without coordinates.');
      const result = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('GPS timed out. Try again outdoors.')), 12000),
        ),
      ]);
      const p = point(result);
      setCurrent(p);
      return p;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Location unavailable.');
      return null;
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    if (data === undefined) return;
    let subscription: Location.LocationSubscription | undefined,
      stopped = false,
      last = 0;
    const targets = [
      ...(emergency ? [{ emergencyId: emergency.id }] : []),
      ...(journey ? [{ safetySessionId: journey.id }] : []),
    ];
    void (async () => {
      if (!targets.length) {
        await stopTracking();
        return;
      }
      await SecureStore.setItemAsync(KEY, JSON.stringify(targets));
      const permission = await Location.getForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setError(
          'Location sharing is enabled, but device permission is off. Enable location in Settings.',
        );
        return;
      }
      const background =
        (await SecureStore.getItemAsync('abhaya.background')) === 'enabled' &&
        (await Location.getBackgroundPermissionsAsync()).granted;
      if (background) {
        if (!(await Location.hasStartedLocationUpdatesAsync(TASK)))
          await Location.startLocationUpdatesAsync(TASK, {
            accuracy: Location.Accuracy.High,
            timeInterval: 15000,
            distanceInterval: 20,
            pausesUpdatesAutomatically: false,
            showsBackgroundLocationIndicator: true,
            ...(Platform.OS === 'android'
              ? {
                  foregroundService: {
                    notificationTitle: 'ABHAYA location sharing',
                    notificationBody:
                      'Sharing during your active SOS or journey. Open ABHAYA to stop.',
                  },
                }
              : {}),
          });
      }
      const watcher = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 15000, distanceInterval: 15 },
        (p) => {
          if (stopped) return;
          const loc = point(p);
          setCurrent(loc);
          if (background || Date.now() - last < 15000) return;
          last = Date.now();
          void transmit(loc)
            .then(() => setError(''))
            .catch(() => setError('Location update unconfirmed. Check your connection.'));
        },
      );
      if (stopped) watcher.remove();
      else subscription = watcher;
    })().catch(() => setError('Could not start tracking. Review permissions in Settings.'));
    const state = AppState.addEventListener('change', (s) => {
      if (s === 'active')
        void SecureStore.getItemAsync(ERROR).then((v) => {
          if (v) setError(v);
        });
    });
    return () => {
      stopped = true;
      subscription?.remove();
      state.remove();
    };
  }, [emergency?.id, journey?.id, revision]);
  return { current, error, busy, refresh, openSettings: () => Linking.openSettings() };
}
