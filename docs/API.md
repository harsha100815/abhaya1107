# ABHAYA API v1

Base URL: `/api/v1`. Every JSON response is shaped as `{ ok: true, data }` or `{ ok: false, error: { code, message, details? } }`.

## Authentication

```text
POST /auth/signup
POST /auth/login
POST /auth/refresh
POST /auth/otp/request
POST /auth/otp/verify
POST /auth/logout                 Bearer
GET  /auth/me                     Bearer
POST /auth/forgot-password
POST /auth/reset-password
```

Access tokens are short-lived JWTs. Refresh tokens are random, stored only as hashes in session records, rotated on refresh, and revocable.

## User / trusted circle

```text
GET/PATCH /users/me
PATCH      /users/me/settings
GET        /users/me/sessions
DELETE     /users/me/sessions/:sessionId
GET/POST   /trusted-contacts
PATCH/DELETE /trusted-contacts/:contactId
POST       /trusted-contacts/:contactId/test
POST       /trusted-contacts/invitations/:token/accept
```

## Emergency

```text
GET  /emergency/active
GET  /emergency/history
POST /emergency
POST /emergency/:id/cancel
POST /emergency/:id/resolve
POST /emergency/:id/acknowledge
POST /emergency/:id/location
POST /emergency/:id/share/revoke
POST /location/update
```

Create an emergency with `{ source, location?, countdown? }`. The response includes `deliveryState`, recipient delivery rows, and a relative temporary `shareUrl`. Delivery states are `PENDING`, `PARTIAL`, `DELIVERED`, or `FAILED`; the API never turns an unconfigured provider into a real-world delivery claim.

## Journeys, timers, check-ins

```text
GET/POST /journeys
POST /journeys/:id/start
POST /journeys/:id/check-in
POST /journeys/:id/extend
POST /journeys/:id/end
GET/POST /timers
POST /timers/:id/confirm
POST /timers/:id/extend
POST /timers/:id/cancel
POST /check-ins
GET /check-ins
```

Demo-only admin simulation endpoints:

```text
POST /journeys/:id/simulate-deviation       ADMIN + DEMO_MODE
POST /timers/:id/simulate-expiry            ADMIN + DEMO_MODE
```

These flows ask the user to confirm. GPS anomalies are not classified as emergencies automatically.

## Resources, evidence, history

```text
GET  /resources?lat=&lng=&type=
GET  /notifications
GET  /history
POST /evidence/sessions
POST /evidence/:id/complete
DELETE /evidence/:id
GET  /public/share/:token                   no account data
```

Evidence endpoints validate MIME type, size, owner and emergency association. Production configuration should return a short-lived presigned S3 multipart URL instead of receiving raw media through the API.

## Admin (ADMIN role)

```text
GET  /admin/overview
GET  /admin/users
GET  /admin/emergencies
GET  /admin/journeys
GET  /admin/notifications
GET  /admin/audits
GET  /admin/resources
POST /admin/resources
POST /admin/emergencies/:id/resolve
```

All admin actions are RBAC-protected and audit logged. Active incident responses must still follow human and legal operating procedures.

## Health

```text
GET /health
GET /ready
```
