import type { ExpoConfig } from 'expo/config';
if (process.env.EAS_BUILD_PROFILE === 'production') {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL;
  if (!apiUrl || new URL(apiUrl).protocol !== 'https:')
    throw new Error('Production builds require an HTTPS EXPO_PUBLIC_API_URL.');
  if (!process.env.EXPO_PUBLIC_EAS_PROJECT_ID)
    throw new Error('Production builds require EXPO_PUBLIC_EAS_PROJECT_ID for push notifications.');
  if (!process.env.GOOGLE_MAPS_ANDROID_API_KEY)
    throw new Error('Production builds require GOOGLE_MAPS_ANDROID_API_KEY.');
}
const config: ExpoConfig = {
  name: 'ABHAYA 1107',
  slug: 'abhaya1107',
  version: '0.1.0',
  scheme: 'abhaya1107',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  icon: './assets/icon.png',
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'in.abhaya1107.app',
    infoPlist: { ITSAppUsesNonExemptEncryption: false },
  },
  android: {
    package: 'in.abhaya1107.app',
    adaptiveIcon: { foregroundImage: './assets/adaptive-icon.png', backgroundColor: '#E1EADB' },
    ...(process.env.GOOGLE_MAPS_ANDROID_API_KEY
      ? { config: { googleMaps: { apiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY } } }
      : {}),
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    [
      'expo-splash-screen',
      {
        image: './assets/splash-icon.png',
        imageWidth: 160,
        backgroundColor: '#F4F5F1',
        dark: { backgroundColor: '#101C17' },
      },
    ],
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'Use your location for SOS, journeys and private reports only when you choose.',
        locationAlwaysAndWhenInUsePermission:
          'Share location during your active SOS or journey even while ABHAYA is in the background. Stop sharing at any time.',
        isIosBackgroundLocationEnabled: true,
        isAndroidBackgroundLocationEnabled: true,
        isAndroidForegroundServiceEnabled: true,
      },
    ],
    ['expo-notifications', { color: '#245C43' }],
    [
      'expo-image-picker',
      {
        photosPermission: 'Choose a private profile or evidence image to upload.',
        cameraPermission: 'Take an image for your private report only when you choose.',
        microphonePermission: false,
      },
    ],
  ],
  experiments: { typedRoutes: true },
  extra: {
    ...(process.env.EXPO_PUBLIC_EAS_PROJECT_ID
      ? { eas: { projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID } }
      : {}),
  },
};
export default config;
