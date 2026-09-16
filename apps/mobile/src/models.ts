import type { CheckInRecord, ContactRecord, EmergencyRecord, JourneyRecord, NotificationRecord, TimerRecord, UserRecord } from '../../api/src/types';

export type Contact = ContactRecord;
export type Emergency = EmergencyRecord & { contactCount: number };
export type Journey = JourneyRecord;
export type SafetyTimer = TimerRecord;
export type Notification = NotificationRecord;
export type User = Omit<UserRecord, 'passwordHash'> & { firstName: string };
export type Page = 'Home' | 'Journey' | 'Timer' | 'Contacts' | 'More' | 'Settings' | 'Nearby' | 'History' | 'Emergency' | 'Evidence' | 'Notifications';
export interface DashboardData {
  user: User;
  contacts: Contact[];
  emergency: Emergency | null;
  journeys: Journey[];
  timers: SafetyTimer[];
  notifications: Notification[];
  history: { emergencies: Emergency[]; journeys: Journey[]; timers: SafetyTimer[]; checkIns: CheckInRecord[] };
}
export interface ScreenProps {
  data: DashboardData;
  busy: boolean;
  run: (job: () => Promise<unknown>, success?: string) => Promise<void>;
  navigate: (page: Page) => void;
}
