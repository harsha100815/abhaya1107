import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { messageViewSchema } from '@abhaya/validation';
import { api } from './session';
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});
export async function registerPush() {
  if (!Device.isDevice) throw new Error('Push notifications require a physical device.');
  const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
  if (typeof projectId !== 'string')
    throw new Error('An EAS project ID is required before push registration.');
  if (Platform.OS === 'android')
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Safety alerts',
      importance: Notifications.AndroidImportance.HIGH,
    });
  const permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted)
    throw new Error('Notifications are off. You can enable them in Settings.');
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  await api.call('POST', '/notifications/devices', messageViewSchema, {
    token,
    platform: Platform.OS,
  });
  await SecureStore.setItemAsync('abhaya.push', token);
}
export async function unregisterPush() {
  const token = await SecureStore.getItemAsync('abhaya.push');
  if (token) await api.call('DELETE', '/notifications/devices', messageViewSchema, { token });
  await SecureStore.deleteItemAsync('abhaya.push');
}
