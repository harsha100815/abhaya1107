import crypto from 'node:crypto';

export const now = () => new Date().toISOString();
export const id = () => crypto.randomUUID();
export const hashToken = (value: string) => crypto.createHash('sha256').update(value).digest('hex');
export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');
export const addMinutes = (date: Date | string, minutes: number) => new Date(new Date(date).getTime() + minutes * 60_000).toISOString();
export const extendDeadline = (deadline: string, minutes: number, currentTime = Date.now()) => addMinutes(new Date(Math.max(Date.parse(deadline), currentTime)), minutes);
export const addHours = (date: Date | string, hours: number) => new Date(new Date(date).getTime() + hours * 3_600_000).toISOString();
export const safeUser = (user: { id: string; fullName: string; email: string; phone: string; role: string; avatar?: string; city?: string }) => ({
  id: user.id,
  fullName: user.fullName,
  firstName: user.fullName.split(' ')[0],
  email: user.email,
  phone: user.phone,
  role: user.role,
  avatar: user.avatar,
  city: user.city,
});
export const asNumber = (value: unknown, fallback = 0) => {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
};
export const distanceKm = (a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) => {
  const earthRadius = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const value = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return Math.round(earthRadius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value)) * 10) / 10;
};
