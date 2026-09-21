import type { z } from 'zod';
import type {
  userViewSchema,
  authViewSchema,
  contactViewSchema,
  eventViewSchema,
  journeyViewSchema,
  incidentViewSchema,
  locationSchema,
  configViewSchema,
  dashboardSchema,
} from '@abhaya/validation';
export type User = z.infer<typeof userViewSchema>;
export type AuthSession = z.infer<typeof authViewSchema>;
export type Contact = z.infer<typeof contactViewSchema>;
export type Emergency = z.infer<typeof eventViewSchema>;
export type Journey = z.infer<typeof journeyViewSchema>;
export type Incident = z.infer<typeof incidentViewSchema>;
export type LocationPoint = z.infer<typeof locationSchema>;
export type AppConfig = z.infer<typeof configViewSchema>;
export type Dashboard = z.infer<typeof dashboardSchema>;
export type ApiResult<T> =
  | { success: true; data: T; error: null }
  | { success: false; data: null; error: { code: string; message: string; requestId?: string } };
