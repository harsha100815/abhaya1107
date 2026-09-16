# ABHAYA 1107 mobile app

Expo/React Native implementation of the safety workflows. It shares the same versioned REST API as the web application.

## Run

```bash
npm install
npx expo start
```

Keep the phone and development computer on the same network, then scan the Expo QR code using Expo Go on iOS or Android. The mobile app derives the local API host from the Expo session and uses port 4000. Restart Expo after changing networks.

For a remote API, set `EXPO_PUBLIC_API_URL` to its full API base URL. Do not set it to `localhost` on a physical phone. The local `.env` can be left without an override.

The interface shares the website's DM Sans and Manrope fonts, forest palette, dashboard structure, and safety tools. Browser previews are available through Expo's web option; browser sign-ins last only until reload. Allow that preview origin in the API's `CORS_ORIGINS` when using the browser.

## Checks

```bash
npm run typecheck
npx expo export --platform all
```

The export validates JavaScript bundles for iOS, Android, and the browser. Native store builds and physical-device permission behavior still need device testing.

## Platform notes

- SOS creates a demo emergency after the cancellation countdown. Keep the app open during the countdown; if the OS suspends it, the elapsed time is reconciled on return. This is not a background emergency service.
- The emergency screen can attach one current location after an explicit tap and foreground permission. Continuous and background tracking are not implemented.
- Journeys support planning, start, check-in, extension, and arrival. Timers support countdown, check-in, extension, and cancellation. Automatic reminders, anomaly detection, and escalation are not connected.
- Demo notification records do not send actual messages or prove delivery. Production push/SMS/email providers and device registration remain necessary.
- The fake call is an in-app simulation and does not place a call. Hardware/power-button detection is not implemented.
- Evidence mode clearly explains that recording and media storage are not connected. Camera and microphone access remain off.
