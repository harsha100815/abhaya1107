import { useState } from 'react';
import { View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Platform } from 'react-native';
import { Screen, Heading, Card, Txt, Button, Banner, useDashboard } from '../../src/ui';
import { useLiveLocation } from '../../src/location';
export default function SafetyMap() {
  const query = useDashboard(),
    location = useLiveLocation(),
    [show, setShow] = useState(false);
  const markers =
      query.data?.incidents.filter((i) => i.latitude !== null && i.longitude !== null) ?? [],
    active = query.data?.emergencies.find((e) => e.status === 'ACTIVE')?.locations[0],
    point = location.current ?? active;
  return (
    <Screen>
      <Heading
        eyebrow="YOUR SURROUNDINGS"
        title="A clearer picture."
        description="Only your position, active SOS and private report locations appear here."
      />
      <Card>
        <Txt kind="small">
          Refreshing location does not upload it. Loading the map shares your approximate map area
          with the device’s map provider.
        </Txt>
        <Button
          label="Refresh my location"
          busy={location.busy}
          onPress={() => void location.refresh()}
        />
        {location.error && <Banner error>{location.error}</Banner>}
        {point && (
          <Txt kind="small">
            {point.latitude.toFixed(5)}, {point.longitude.toFixed(5)} · ±
            {Math.round(point.accuracy)} m{'\n'}
            {new Date(point.capturedAt).toLocaleString()}
          </Txt>
        )}
        {point && !show && <Button label="Load map" secondary onPress={() => setShow(true)} />}
        <View style={{ borderRadius: 18, overflow: 'hidden' }}>
          {show && point && (
            <MapView
              style={{ height: 360, width: '100%' }}
              provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
              initialRegion={{
                latitude: point.latitude,
                longitude: point.longitude,
                latitudeDelta: 0.02,
                longitudeDelta: 0.02,
              }}
              accessibilityLabel="Your safety map"
            >
              <Marker
                coordinate={point}
                title="Your last obtained location"
                description={`Accuracy ±${Math.round(point.accuracy)} m`}
              />
              {active && <Marker coordinate={active} title="Active SOS" pinColor="#BE3F39" />}
              {markers.map((i) => (
                <Marker
                  key={i.id}
                  coordinate={{ latitude: i.latitude!, longitude: i.longitude! }}
                  title="Your private report"
                  description={i.category.replaceAll('_', ' ')}
                  pinColor="#BE3F39"
                />
              ))}
            </MapView>
          )}
        </View>
        <Banner>
          No verified public safety dataset is connected. This map does not rate neighbourhood
          safety.
        </Banner>
        {Platform.OS === 'android' && (
          <Txt kind="small">
            Android map display requires a configured Google Maps key in the native build.
          </Txt>
        )}
      </Card>
    </Screen>
  );
}
