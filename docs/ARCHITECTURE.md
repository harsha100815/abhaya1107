# ABHAYA 1107 architecture

Fresh rebuild from the supplied specification. The existing GitHub implementation was inspected after repository access became available; see [the inventory](REBUILD-INVENTORY.md) for the comparison and intentionally deferred features.

- `apps/mobile`: Expo Router, SecureStore, real foreground/background location, explicit sharing controls, push registration, accessible SOS countdown.
- `apps/api`: Express 5, PostgreSQL, Prisma 7, short-lived JWTs, rotating opaque refresh tokens, transactional notification outbox, overdue journey worker.
- `apps/web`: Next.js authenticated companion; server-side token proxy with HttpOnly cookies.
- `packages`: validation, types, design tokens, client, state logic, configuration.

Private by default: incidents and history are owner-only; no fabricated public safety layer. A communication provider accepting an alert is not proof of delivery. Test events use an isolated simulated transport and never call a real provider. A missed journey check-in produces an OVERDUE state, never an inferred SOS.

Safety mutations use database transactions, ownership predicates, bounded payloads and idempotency keys. Location ingestion requires an active, owned SOS or journey and explicit sharing. Stop-sharing revokes subsequent ingestion and tracking access. All active tracking and queued notification work is invalidated on deletion.

A separately supervised worker polls a durable PostgreSQL outbox. Queue claim leases prevent concurrent sends. Ambiguous provider failures are surfaced and not blindly replayed. Database advisory/row locks protect refresh rotation and journey escalation.

This repository records verified results in [VALIDATION.md](VALIDATION.md). Native device, provider and store acceptance cannot be inferred from type checks or web tests.
