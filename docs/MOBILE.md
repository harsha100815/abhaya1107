# Mobile setup

The Expo client lives in `apps/mobile`.

```bash
npm install
EXPO_PUBLIC_API_URL=http://192.168.1.12:4000/api/v1 npx expo start
```

Use the host machine's LAN IP on a physical phone; `localhost` refers to the phone itself. The app stores tokens in `expo-secure-store`, requests notifications and foreground location explicitly, and exposes the core emergency, journey, timer, contacts, and settings flows.

For production builds:

1. Configure EAS credentials for APNs/FCM.
2. Review background-location entitlements and store disclosures.
3. Add native background task/reconnect tests for journeys.
4. Implement the S3 multipart evidence uploader and durable offline queue.
5. Run accessibility, permission-denied, airplane-mode, low-battery, terminated-app, and duplicate-SOS tests on iOS and Android.
