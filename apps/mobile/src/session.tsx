import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { ApiClient } from '@abhaya/client';
import { authViewSchema, messageViewSchema } from '@abhaya/validation';
import type { AuthSession } from '@abhaya/types';
import { queryClient } from './state';
const KEY = 'abhaya.session.v1';
let listener: ((session: AuthSession | null) => void) | undefined;
export const tokens = {
  read: async () => {
    const raw = await SecureStore.getItemAsync(KEY);
    if (!raw) return null;
    const parsed = authViewSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  },
  write: async (session: AuthSession | null) => {
    if (session)
      await SecureStore.setItemAsync(KEY, JSON.stringify(session), {
        keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
      });
    else {
      await SecureStore.deleteItemAsync(KEY);
      queryClient.clear();
    }
    listener?.(session);
  },
};
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';
export const api = new ApiClient({ baseUrl: API_URL, tokens });
const SessionContext = createContext<{
  session: AuthSession | null;
  loading: boolean;
  save: (value: AuthSession | null) => Promise<void>;
}>({ session: null, loading: true, save: tokens.write });
export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    listener = setSession;
    void tokens
      .read()
      .then(setSession)
      .catch(() => tokens.write(null))
      .finally(() => setLoading(false));
    return () => {
      listener = undefined;
    };
  }, []);
  return (
    <SessionContext.Provider value={{ session, loading, save: tokens.write }}>
      {children}
    </SessionContext.Provider>
  );
}
export const useSession = () => useContext(SessionContext);
export async function logout() {
  await api.call('POST', '/auth/logout', messageViewSchema, {});
  await tokens.write(null);
}
