# ABHAYA 1107 architecture

## Runtime topology

```text
React/Vite web ── relative /api/v1 ── Express API ── demo JSON store (local)
      │                                  ├─ authenticated WebSocket /ws
Expo mobile ── HTTPS /api/v1 ───────────┤
      │                                  ├─ notification abstraction
      │                                  └─ PostgreSQL repository path (production)
Admin web view ── same API/RBAC ─────────┘
```

The browser uses relative API calls. Vite proxies `/api`, `/ws`, and `/socket.io` during development, so browser code never assumes that a user's device can reach `localhost` for a second service.

## Domain boundaries

- `auth`: password hashing, access tokens, refresh rotation, session revocation, rate limits.
- `emergency`: state machine, status history, delivery state, share links, trusted-contact notifications.
- `journey`: explicit location session start/end, progress, check-ins, configurable anomaly confirmation.
- `timer`: expiry/grace/confirmation/escalation model.
- `location`: throttled client update contract, timestamped accuracy, last-known state, websocket fan-out.
- `notifications`: channel-neutral queue and provider adapter. Mock delivery is visibly labelled.
- `evidence`: consent-first recording session metadata and storage integration boundary.
- `admin`: role-based metrics, incident operations, verified resource management, audit logs.

## Location lifecycle

1. User has location sharing disabled by default.
2. A user explicitly starts an emergency or journey.
3. Client requests OS location permission and posts timestamped points to `/api/v1/location/update` or the emergency location endpoint.
4. API stores the latest point and emits a scoped realtime update. Production should persist a minimum, retention-bounded route history in PostgreSQL.
5. User resolves/ends the session; API rejects further updates and public links are revoked/expired.

## Emergency state machine

`CREATED → COUNTDOWN → ACTIVE → ACKNOWLEDGED → RESOLVED`

Cancellation is allowed from `CREATED`, `COUNTDOWN`, `ACTIVE`, and `ACKNOWLEDGED`. Terminal states are `RESOLVED` and `CANCELLED`. The API records every transition with actor, reason, and timestamp.

## Scaling path

- Move event persistence to PostgreSQL through repositories generated from the schema.
- Move rate limits, idempotency keys, notification retries, and websocket presence to Redis.
- Put notification delivery on a durable queue with provider receipts and dead-letter handling.
- Use S3 multipart/presigned uploads for evidence with antivirus and retention workers.
- Partition high-volume `journey_locations` by time/user/session, retain only the configured minimum.
- Run API instances statelessly behind a load balancer; use Redis adapter for websocket broadcasts.
- Add OpenTelemetry traces and redacted structured logs; never log raw location, medical, tokens, or evidence URLs.
