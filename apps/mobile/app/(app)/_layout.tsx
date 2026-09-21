import { useEffect, useState } from 'react';
import { Tabs } from 'expo-router';
import { View, Text, AppState, Alert } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import * as Notifications from 'expo-notifications';
import { Ionicons } from '@expo/vector-icons';
import { useDashboard, usePalette } from '../../src/ui';
import { useLiveLocation, stopTracking } from '../../src/location';
import { queryClient } from '../../src/state';
export default function AppTabs() {
  const c = usePalette(),
    query = useDashboard(),
    location = useLiveLocation(query.data),
    [online, setOnline] = useState(true);
  useEffect(() => {
    const off = NetInfo.addEventListener((s) =>
      setOnline(s.isConnected !== false && s.isInternetReachable !== false),
    );
    const state = AppState.addEventListener('change', (s) => {
      if (s === 'active') void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    });
    const notification = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data ?? {};
      Alert.alert(
        typeof data.title === 'string' ? data.title : 'Safety update',
        typeof data.message === 'string' ? data.message : 'Open your safety space to review.',
      );
    });
    return () => {
      off();
      state.remove();
      notification.remove();
      void stopTracking();
    };
  }, []);
  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      {(!online || location.error) && (
        <View style={{ padding: 12, paddingTop: 44, backgroundColor: c.dangerSoft }}>
          <Text accessibilityRole="alert" style={{ color: c.danger, fontSize: 12 }}>
            {!online
              ? 'You’re offline. SOS and location transmission are unconfirmed.'
              : location.error}
          </Text>
        </View>
      )}
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: c.accent,
          tabBarInactiveTintColor: c.muted,
          tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.border },
          tabBarLabelStyle: { fontSize: 10 },
          tabBarHideOnKeyboard: true,
        }}
      >
        {(
          [
            { name: 'index', title: 'Overview', icon: 'shield-checkmark-outline' },
            { name: 'circle', title: 'Circle', icon: 'people-outline' },
            { name: 'journey', title: 'Journey', icon: 'navigate-outline' },
            { name: 'map', title: 'Map', icon: 'map-outline' },
            { name: 'records', title: 'Records', icon: 'time-outline' },
            { name: 'settings', title: 'Settings', icon: 'options-outline' },
          ] as const
        ).map((t) => (
          <Tabs.Screen
            key={t.name}
            name={t.name}
            options={{
              title: t.title,
              tabBarIcon: ({ color, size }) => <Ionicons name={t.icon} color={color} size={size} />,
            }}
          />
        ))}
      </Tabs>
    </View>
  );
}
