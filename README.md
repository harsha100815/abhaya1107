# ABHAYA 1107

ABHAYA 1107 is a privacy-first personal safety platform for safer everyday movement. This repository contains a working TypeScript monorepo with a responsive user web app, secure REST/WebSocket API, PostgreSQL schema and migrations, Expo mobile client, admin operations views, durable local demo mode, notification abstractions, and deployment documentation.

> **Safety notice:** ABHAYA is a support and communication tool. It does not guarantee safety, detect danger from GPS alone, or automatically contact authorities. Emergency services should be contacted directly when appropriate.

## What works now

- **Authentication:** signup, login, logout, email/phone OTP request + verification, refresh-token rotation, bcrypt password hashing, rate-limited auth endpoints, session listing/revocation, forgot/reset flow in demo mode.
- **SOS:** short cancellation countdown, duplicate-event prevention, emergency state history, trusted-contact fan-out, explicit delivery state, secure expiring link, last-known/live location, acknowledge/resolve/cancel controls.
- **Safe journeys:** origin/destination/arrival planning, explicit start/end, temporary location session, check-ins, extension, anomaly confirmation flow, admin demo deviation simulation.
- **Safety timer:** 5/10/15/30/custom durations, confirmation, extension, cancel, grace-period demo flow, notification abstraction.
- **Trusted circle:** add/edit/verify/test/remove contacts, priorities and event preferences.
- **Resources:** verified resource seed data, map/list presentation, distance calculation, directions/call actions, admin resource API.
- **Evidence:** explicit consent UI and secure evidence metadata/upload-session APIs with size and MIME validation; production S3 presigned-upload hook.
- **Privacy:** location sharing off by default, no hidden camera/microphone, minimal public links, configurable retention/settings, public links exclude medical data.
- **Admin:** overview stats, active incident queue, users, resource view, audit history, admin resolution action with RBAC.
- **Realtime:** authenticated WebSocket at `/ws`, event broadcasts for emergency/location/journey state.
- **Demo mode:** file-backed durable store and mock notification provider run without PostgreSQL, Redis, FCM, Twilio, Resend, Mapbox, or S3 credentials.

## Quick start

Requirements: Node.js 20+, npm 10+. Docker is optional for local PostgreSQL/Redis.

```bash
cp .env.example .env
npm install
npm run dev
```

- Web app: <http://localhost:5173>
- API: <http://localhost:4000>
- Health: <http://localhost:4000/health>
- Readiness: <http://localhost:4000/ready>

The login page is prefilled for demo mode:

- User: `demo@abhaya.app` / `Password123!`
- Admin: `admin@abhaya.app` / `Admin123!`

The demo store is created at `apps/api/data/store.json` on first start. This path is ignored by git and is intentionally not a production data store.

## Verify the build

```bash
npm run typecheck
npm run build
npm test
```

Build output is written to ignored `apps/api/dist` and `apps/web/dist` directories.

## PostgreSQL / Docker

The API defaults to `DATABASE_MODE=file` so the complete workflow works without paid/external services. The repository also includes a PostgreSQL production path:

```bash
docker compose up -d postgres redis
DATABASE_MODE=postgres DATABASE_URL=postgresql://abhaya:abhaya_dev_password@localhost:5432/abhaya npm run db:migrate
```

`prisma/schema.prisma` and `prisma/migrations/0001_init/migration.sql` define the relational schema, indexes, enums, retention fields, audit records, and externally exposed UUID identifiers. The current demo adapter is intentionally deterministic; wire a Prisma repository or the included SQL migration into your deployment's application data layer before production. Never run production with the demo file driver.

## Monorepo

```text
/apps/api       Express + TypeScript REST API, WebSocket gateway, demo store
/apps/web       Vite + React + TypeScript user/admin application
/apps/mobile     Expo + React Native mobile app
/packages/types  shared domain types
/prisma          PostgreSQL schema and SQL migrations
/docs            architecture, API, realtime, security, privacy, deployment notes
/.github         CI workflow
```

## Environment variables

See `.env.example` for all variables. Required production values include:

- `DATABASE_URL`, `DATABASE_MODE=postgres`
- strong independent `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`
- `CORS_ORIGINS`, `WEB_ORIGIN`
- FCM/APNs provider credentials
- Twilio SMS credentials and a verified sender
- Resend/SendGrid email credentials
- S3-compatible storage credentials and encryption policy
- Map provider token

Secrets are read from environment variables and never hardcoded into the application. Provider credentials are optional in demo mode. The mock provider records a local result with `DEMO_PROVIDER` rather than falsely claiming delivery to a real device.

## Security and privacy before launch

This is a serious startup-grade MVP, not a legal or operational certification. Before a production launch:

1. Replace the JSON demo adapter with a reviewed PostgreSQL repository and Redis-backed rate limits/queues.
2. Run behind TLS, secure cookies or a reviewed token storage strategy, a managed secret store, WAF, monitoring, backups, and incident response.
3. Configure real push/SMS/email providers and verify delivery/receipt semantics per channel.
4. Configure S3 presigned uploads, malware scanning, encryption-at-rest, access logs, deletion jobs, and retention enforcement.
5. Obtain legal review for consent, emergency communications, health data, retention, data-subject requests, and regional emergency-service policy.
6. Test native background location, notification permissions, battery behavior, accessibility, abuse cases, and store review requirements on supported devices.
7. Conduct an independent security, privacy, threat-model, and safety review. Do not rely on GPS anomalies as an automatic danger classification.

Read `docs/SECURITY.md`, `docs/PRIVACY.md`, and `docs/PLATFORM-LIMITATIONS.md` before deployment.
