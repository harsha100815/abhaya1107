import '../src/location';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider, useSession } from '../src/session';
import { queryClient } from '../src/state';
void SplashScreen.preventAutoHideAsync();
function Routes() {
  const { session, loading } = useSession();
  useEffect(() => {
    if (!loading) void SplashScreen.hideAsync();
  }, [loading]);
  if (loading) return null;
  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={!!session}>
          <Stack.Screen name="(app)" />
          <Stack.Screen name="permissions" />
        </Stack.Protected>
        <Stack.Protected guard={!session}>
          <Stack.Screen name="welcome" />
          <Stack.Screen name="auth" />
        </Stack.Protected>
      </Stack>
    </>
  );
}
export default function Root() {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <Routes />
      </SessionProvider>
    </QueryClientProvider>
  );
}
