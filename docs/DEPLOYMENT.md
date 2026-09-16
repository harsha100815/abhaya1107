# Deployment guide

## Local Docker services

```bash
cp .env.example .env
# Replace all secrets for any shared environment
docker compose up -d postgres redis
DATABASE_MODE=postgres npm run db:migrate
npm run build
npm start
```

The compose file is a local reference. For production, use managed PostgreSQL/Redis, encrypted volumes, a reverse proxy/TLS certificate, separate API/web deployments, and a managed object store.

## Web

Build `apps/web` with `npm run build:web` and serve `apps/web/dist` from a static host or CDN. Configure the static host to proxy `/api/v1` and `/ws` to the API origin, or set an explicit reverse proxy. Browser code must continue to use relative API URLs.

## API

```bash
npm --workspace @abhaya/api run build
NODE_ENV=production DATABASE_MODE=postgres node apps/api/dist/server.js
```

Expose only the reverse proxy, not the database. Add process supervision, health/readiness checks, graceful shutdown, log shipping, metrics, and automated rollback.

## Providers

- FCM/APNs: configure device registration, platform credentials, token rotation, receipt handling, and notification content privacy.
- Twilio: configure verified sender, regional emergency messaging rules, retries, and delivery callbacks.
- Resend/SendGrid: configure verified domain, SPF/DKIM/DMARC, bounce handling, and redacted templates.
- S3: configure private bucket, KMS/server-side encryption, short-lived presigned URLs, multipart upload, malware scanning, access logs, and lifecycle deletion.
- Maps: configure a token with correct allowed origins; document third-party location processing.

## CI/CD

The GitHub Actions workflow runs install, typecheck, lint, tests, and production builds. Add managed Postgres integration tests, E2E tests on supported browsers/devices, and migration rollback checks before shipping.
