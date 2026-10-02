'use client';
import { useEffect, useRef, useState } from 'react';
import type { LocationPoint, Incident } from '@abhaya/types';
import { MapPin } from 'lucide-react';
import { Button, Notice } from './common';
export function SafetyMap({
  point,
  incidents = [],
}: {
  point: LocationPoint | null;
  incidents?: Incident[];
}) {
  const [enabled, setEnabled] = useState(false),
    [error, setError] = useState(''),
    container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!enabled || !container.current) return;
    let map: import('leaflet').Map | undefined,
      cancelled = false;
    void import('leaflet')
      .then((L) => {
        if (cancelled || !container.current) return;
        const tiles = process.env.NEXT_PUBLIC_MAP_TILE_URL;
        if (!tiles) {
          setError('Map tiles are not configured. Coordinates remain available.');
          return;
        }
        const points = incidents.filter((i) => i.latitude !== null && i.longitude !== null);
        const first =
          point ??
          (points[0] ? { latitude: points[0].latitude!, longitude: points[0].longitude! } : null);
        if (!first) {
          setError('No location available yet. Refresh GPS or attach a report location.');
          return;
        }
        map = L.map(container.current).setView([first.latitude, first.longitude], 14);
        L.tileLayer(tiles, {
          attribution: process.env.NEXT_PUBLIC_MAP_ATTRIBUTION ?? '© OpenStreetMap contributors',
          maxZoom: 19,
        })
          .on('tileerror', () => {
            if (!cancelled) setError('Map tiles could not load. Coordinates remain available.');
          })
          .addTo(map);
        if (point)
          L.circleMarker([point.latitude, point.longitude], {
            radius: 10,
            color: '#245C43',
            fillColor: '#A6D5B4',
            fillOpacity: 1,
            weight: 3,
          })
            .addTo(map)
            .bindTooltip('Your current location');
        const layer = L.layerGroup().addTo(map);
        const draw = () => {
          layer.clearLayers();
          const cell = 360 / 2 ** (map!.getZoom() + 4),
            groups = new Map<string, { lat: number; lng: number; count: number }>();
          for (const p of points) {
            const key = `${Math.floor(p.latitude! / cell)}:${Math.floor(p.longitude! / cell)}`,
              group = groups.get(key) ?? { lat: 0, lng: 0, count: 0 };
            group.lat += p.latitude!;
            group.lng += p.longitude!;
            group.count++;
            groups.set(key, group);
          }
          for (const g of groups.values())
            L.circleMarker([g.lat / g.count, g.lng / g.count], {
              radius: g.count > 1 ? 15 : 7,
              color: '#BE3F39',
            })
              .addTo(layer)
              .bindTooltip(g.count > 1 ? `${g.count} private reports` : 'Your private report');
        };
        draw();
        map.on('zoomend', draw);
      })
      .catch(() => setError('Map could not load. Check your connection.'));
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [enabled, point?.latitude, point?.longitude, incidents]);
  return (
    <section className="card map-card">
      <div className="row between">
        <div>
          <p className="eyebrow">A CLEARER PICTURE</p>
          <h3>Your safety map</h3>
        </div>
        <MapPin />
      </div>
      {enabled ? (
        <div
          className="map-surface"
          ref={container}
          aria-label="Map with your position and private reports"
        />
      ) : (
        <div className="map-placeholder">
          <MapPin size={38} strokeWidth={1} />
          <h3>Your location stays yours.</h3>
          <p>
            Load the map to show your position and private reports. The map tile provider will
            receive your IP address and approximate map area.
          </p>
          <Button className="secondary" onClick={() => setEnabled(true)}>
            Load map
          </Button>
        </div>
      )}
      {error && <Notice error>{error}</Notice>}
      {point && (
        <p className="small">
          {point.latitude.toFixed(5)}, {point.longitude.toFixed(5)} · ±{Math.round(point.accuracy)}{' '}
          m · {new Date(point.capturedAt).toLocaleTimeString()}
        </p>
      )}
      <p className="small">
        No verified public safety dataset is connected. This map does not rate neighbourhood safety.
      </p>
    </section>
  );
}
