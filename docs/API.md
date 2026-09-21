# API contract

Base path: `/api/v1`. JSON success envelopes are `{ "success": true, "data": ..., "error": null }`. Failures return `{ "success": false, "data": null, "error": { "code": "...", "message": "...", "requestId": "..." } }`. Media responses are private `image/jpeg`.

See `packages/validation/src/index.ts` for exact Zod payloads and response schemas. Dates are UTC ISO 8601 strings. IDs are UUIDs. Phone numbers use E.164 format. Protected endpoints require `Authorization: Bearer <access-token>`; resource ownership is enforced in database predicates. Unknown fields are rejected in mutation payloads.

| Route                                                         | Behavior                                                                      |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `POST /auth/register`, `/auth/login`                          | Return user, 10-minute access JWT, opaque refresh token                       |
| `POST /auth/refresh`                                          | Atomically rotate refresh token; replay revokes its session                   |
| `POST /auth/logout`                                           | Revoke current session                                                        |
| `POST /auth/forgot-password`, `/auth/reset-password`          | Email reset link and one-use password reset                                   |
| `POST /auth/verification`, `/auth/verify`                     | Request/consume email verification link                                       |
| `GET/PATCH/DELETE /profile`                                   | Read/update owned profile; deletion requires password + `DELETE`              |
| `GET/PUT/DELETE /profile/avatar`                              | Private, encrypted profile image                                              |
| `GET/POST /contacts`, `PATCH/DELETE /contacts/:id`            | Manage up to 10 consented trusted contacts                                    |
| `GET/POST /sos`, `GET/PATCH /sos/:id`                         | List/create/read/resolve or cancel SOS                                        |
| `POST /sos/:id/stop-sharing`                                  | Stop location ingestion and revoke tracking grants                            |
| `POST/DELETE /location`                                       | Ingest a fresh owned point; delete stored SOS/journey points and stop sharing |
| `GET/POST /safety-sessions`, `GET/PATCH /safety-sessions/:id` | Start/check in/extend/complete/cancel journeys                                |
| `POST /safety-sessions/:id/stop-sharing`                      | Revoke journey location sharing                                               |
| `GET/POST /incidents`, `GET/DELETE /incidents/:id`            | Private reports with optional consented coordinates                           |
| `GET/PUT /incidents/:id/evidence`                             | Private image; consent required on upload                                     |
| `GET /notifications`                                          | Owner's outgoing delivery states                                              |
| `POST/DELETE /notifications/devices`                          | Register/unregister owned Expo push token                                     |
| `GET /dashboard`                                              | Owner's latest records and contacts                                           |
| `GET /config`                                                 | Safe client configuration flags                                               |
| `GET /safety-map`                                             | Explicitly empty unconfigured public data layers                              |
| `POST /tracking/lookup`                                       | Expiring bearer link lookup, token in request body                            |

List routes for SOS, journeys and incidents accept `take` (1–100, default 30) and optional `cursor`. Dashboard is a recent summary, not a full export. SOS, journey, location and incident creation use client-generated UUID request IDs. Do not automatically retry emergency mutations with a new request ID.

A journey's `check-in` and `extend` actions require a new future `expectedAt` within 24 hours. Only an expired ACTIVE journey can become OVERDUE; that state alone never creates an emergency. Sharing defaults off. Test events are rejected in production and live events are rejected in a test-only environment.

Status codes include 400 validation, 401 authentication, 403 origin, 404 unavailable/foreign records, 409 conflicting safety state, 413 oversized media, 429 rate limit, and 503 unconfigured email service. Network timeouts are unconfirmed operations, not delivery failures or successes.
