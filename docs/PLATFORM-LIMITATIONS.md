# Platform limitations and honest behavior

## Background location

Web browsers cannot guarantee background location, reliable execution after suspension, or hardware-button detection. The web app therefore uses explicit foreground geolocation and server-side last-known state. The Expo app requests background location only for an active journey and remains subject to iOS/Android permission, battery, OS suspension, and app-store rules.

## Silent SOS

A normal web/Expo app cannot universally monitor the power button, volume keys, or a device being shaken while terminated. ABHAYA implements a discreet in-app trigger surface and documents that approved native integrations would be needed for a hardware workflow. No covert surveillance is implemented.

## Push/SMS/email

Provider credentials and device tokens are required for real delivery. Demo mode uses a mock provider and records an explicit `DEMO_PROVIDER` note. UI delivery copy distinguishes created/sent/delivered/failed.

## Maps

The included web UI uses an embedded visual map treatment and coordinates from verified seed resources. Production should connect a reviewed Mapbox/Google Maps provider, comply with terms, and avoid leaking location to third-party tiles without user consent.

## Recording

Evidence mode requires explicit action and OS permission. The browser implementation provides a consent-first session UI and backend metadata boundary; production capture/upload must be implemented with `MediaRecorder`, encrypted/presigned storage, resumable multipart upload, malware scanning, and retention workers. It must never record silently.

## Emergency services

The app provides a call action but does not automatically contact authorities. Emergency numbers, location-sharing laws, and local integrations require jurisdiction-specific review.
