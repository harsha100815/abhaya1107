# Physical device acceptance

Use a TEST API and consenting testers. Never use real emergency service numbers for testing.

1. Install Android preview APK and an iOS development/preview build.
2. Register, sign out, sign back in, restart the app and confirm SecureStore session recovery.
3. Add a consenting contact. Validate invalid phone, edit, primary selection, alert disable and deletion.
4. Deny foreground, background, camera and notification permissions independently; verify recovery/settings routes and SOS availability.
5. Grant foreground location. Confirm actual GPS, accuracy and capture timestamp match your physical device.
6. Start TEST SOS through hold + countdown. Cancel once before activation. Start again, confirm server acknowledgement and TEST deliveries, then confirm location changes persist in the API.
7. Switch apps/lock the phone with background permission enabled. Confirm foreground-service/OS indicator, background points and explicit stop behavior. Force-stop and relaunch; do not assume uninterrupted tracking.
8. Interrupt network before transmission and after server commit. Confirm unconfirmed UI, retry with the same request ID and one server event. Resolve SOS and confirm tracking/link revocation.
9. Start a journey, check in, extend, complete and cancel. Let one deadline pass; confirm OVERDUE and one escalation per deadline, with no automatic SOS.
10. Create/delete a private incident; attach image/library/camera evidence and confirm another account cannot access it.
11. Check light/dark mode, 200% text, TalkBack/VoiceOver, keyboard focus on web and alternative SOS activation.
12. Delete account and confirm access/refresh tokens and tracking links fail; verify data removal and retention.
13. In a separate staging environment, configure Twilio/Resend/Expo credentials and contact only consenting test recipients. Confirm ACCEPTED vs actual provider-reported delivery, provider error, offline device, expired push token and ambiguous timeout semantics.

These tests are a release gate and require actual devices and configured providers. The browser E2E tests use synthetic geolocation and do not prove native GPS/background behavior.
