import { ApiClient } from '@abhaya/client';
export const api = new ApiClient({ baseUrl: '/api', cookieSession: true, timeoutMs: 18000 });
export const uuid = () => crypto.randomUUID();
export const readableTime = (value: string) =>
  new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
