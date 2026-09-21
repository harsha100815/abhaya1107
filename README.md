# ABHAYA 1107

A fresh TypeScript personal-safety platform with an Expo mobile app, a Next.js web companion, and a PostgreSQL/Prisma API. The clients use real authenticated endpoints for SOS, trusted contacts, journey check-ins, private incident records, location sharing and account management.

**Release status:** implemented and under validation, not yet approved for real emergency use. Read [the validation record](docs/VALIDATION.md) for executed checks and remaining device/provider gates. Android/iOS JavaScript exports are separate from signed native binaries. The default local environment is clearly labelled **TEST MODE** and never contacts anyone through an SOS test.

## Architecture

| Directory             | Responsibility                                                                                                    |
| --------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `apps/mobile`         | Expo SDK 55, React Native, Expo Router, SecureStore, Location, Notifications, image/camera selection, native maps |
| `apps/web`            | Next.js 16 companion, responsive light/dark interface, HttpOnly session proxy, permission-aware browser location  |
| `apps/api`            | Express 5 API, PostgreSQL, Prisma 7, authentication, ownership checks, transactional outbox and worker            |
| `packages/validation` | Shared Zod request and response schemas                                                                           |
| `packages/types`      | Shared domain types                                                                                               |
| `packages/client`     | Bounded API requests, response validation, single-flight token refresh                                            |
| `packages/ui`         | Color, typography, spacing, radius and motion tokens                                                              |
| `packages/utils`      | SOS, delivery, permission and journey rules                                                                       |
| `packages/config`     | Product constants                                                                                                 |
| `tests/e2e`           | Browser flows with acknowledged/unconfirmed SOS assertions                                                        |

See [architecture](docs/ARCHITECTURE.md), [original-project inventory](docs/REBUILD-INVENTORY.md), [security/privacy](docs/SECURITY.md), and [device acceptance](docs/DEVICE-TESTS.md).

The API and the separately supervised worker use the same database. The worker detects overdue journeys, claims notification work, checks provider receipts and applies retention. The API alone does not deliver queued alerts.

## Requirements

- Node.js 24 LTS (use `.nvmrc`) and npm 11.
- PostgreSQL 17 or Docker Compose for the standard development environment.
- A physical Android/iOS device for GPS, push and background behavior.
- Expo/EAS account for cloud builds; Apple signing membership for distributed iOS builds.
- Optional local tools: Android Studio/JDK/Android SDK or macOS/Xcode.

## Installation

```bash
git clone --branch rebuild/fresh-start https://github.com/harsha100815/abhaya1107.git
cd abhaya1107
npm ci
npm run setup
npm run db:generate
docker compose up -d --wait postgres
npm run db:deploy
npm run dev
```

`setup` creates fresh development secrets in ignored `.env` files and never overwrites existing files. It generates the same PostgreSQL password for the Compose database and API. If a database volume already exists with other credentials, reconcile those credentials; do not delete a real database to fix a login problem.

- Web: `http://localhost:3000`
- API: `http://localhost:4000/api/v1`
- Health: `http://localhost:4000/health`

Create your own account. There are no prefilled production passwords, automatic demo users, fabricated incidents, or seeded contact numbers. Email verification/recovery is unavailable until an email provider is configured; the UI states that honestly. You can still register and test the local safety flows.

For physical phones, set `apps/mobile/.env` → `EXPO_PUBLIC_API_URL` to the development computer's reachable LAN address, with `/api/v1` at the end. Restart Expo after changing it. Production must use HTTPS.

```bash
npm run mobile
```

Use an Expo development build for background location and remote notifications. Expo Go is not an acceptance environment for these native features.

## Commands

| Command                          | Purpose                                                              |
| -------------------------------- | -------------------------------------------------------------------- |
| `npm run dev`                    | API + worker + web                                                   |
| `npm run api` / `npm run worker` | Run services independently                                           |
| `npm run web` / `npm run mobile` | Start clients                                                        |
| `npm run lint`                   | ESLint on project source                                             |
| `npm run typecheck`              | Strict TypeScript across every workspace                             |
| `npm test`                       | Unit tests                                                           |
| `npm run test:local`             | Isolated PGlite PostgreSQL-WASM API integration tests                |
| `npm run test:integration`       | API integration tests against `TEST_DATABASE_URL`                    |
| `npm run test:e2e:local`         | Isolated database/API/worker/browser stack and browser E2E           |
| `npm run test:e2e`               | Browser E2E against an already-running TEST stack                    |
| `npm run build`                  | Production API and web builds                                        |
| `npm run build:mobile`           | Android + iOS JavaScript/Hermes exports, not native binaries         |
| `npm run check:mobile`           | Expo dependency compatibility                                        |
| `npm run format`                 | Format source with Prettier                                          |
| `npm run db:generate`            | Generate Prisma client                                               |
| `npm run db:migrate`             | Create a development migration                                       |
| `npm run db:deploy`              | Apply committed migrations                                           |
| `npm run db:status`              | Check database connection and migration status without changing data |

All commands run from this repository's root unless an explicit `cd` is shown. Local test helpers use disposable PostgreSQL-WASM databases and cannot replace concurrency tests against standard PostgreSQL. CI includes a standard PostgreSQL 17 service.

## Environment variables

Copy the matching `.env.example` if configuring manually. Never commit real environment files or signing credentials.

| Scope        | Required settings                                                                                                          |
| ------------ | -------------------------------------------------------------------------------------------------------------------------- |
| API          | `DATABASE_URL`, `JWT_SECRET` (48+ characters), `DATA_ENCRYPTION_KEY` (64 hex characters), `CORS_ORIGINS`, `PUBLIC_WEB_URL` |
| API behavior | `NODE_ENV`, `PORT`, `TEST_MODE_ONLY`, `DB_POOL_MAX`, `TRUST_PROXY_HOPS`, `LOCATION_RETENTION_DAYS`, `LOG_LEVEL`            |
| SMS          | `SMS_ACCOUNT_SID`, `SMS_AUTH_TOKEN`, `SMS_FROM` (Twilio)                                                                   |
| Email        | `EMAIL_API_KEY`, `EMAIL_FROM` (Resend verified sender)                                                                     |
| Push         | `EXPO_ACCESS_TOKEN` plus EAS/APNs/FCM project credentials                                                                  |
| Direct dial  | Optional verified regional `EMERGENCY_NUMBER`; no automatic emergency-service API exists                                   |
| Web server   | `API_URL`, `WEB_ORIGIN`; exact browser origin is required for mutation requests                                            |
| Web map      | Build-time `NEXT_PUBLIC_MAP_TILE_URL`; use an approved provider and observe its terms                                      |
| Mobile       | Build-time `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_EAS_PROJECT_ID`                                                             |
| Android map  | `GOOGLE_MAPS_ANDROID_API_KEY`, restricted to package and signing certificates                                              |

API production startup refuses TEST mode, HTTP origins, missing SMS/email configuration or weak/missing keys. Use a separate development/staging API for simulated tests. Protect the encryption key for the full lifetime of encrypted data; do not regenerate it on deploy.

No credentials or backend secrets may use an `EXPO_PUBLIC_` / `NEXT_PUBLIC_` prefix. Map keys shipped in a native client need provider-side application restrictions.

## Database and test data

The initial migration creates domain tables, foreign keys, indexes, owner relationships, partial uniqueness constraints and location checks. Production uses actual relational Prisma queries. Development seeding is explicit and refuses production:

```bash
# Supply your chosen local SEED_NAME, SEED_EMAIL and SEED_PASSWORD securely.
npm run db:seed
```

The seed creates only a user; it sends no alerts and fabricates no safety data. Existing demo JSON snapshots are not automatically imported.

For integration tests, use a dedicated database whose name ends in `_test`:

```bash
export TEST_DATABASE_URL='postgresql://YOUR_TEST_CONNECTION/abhaya_test'
DATABASE_URL="$TEST_DATABASE_URL" npm run db:deploy
npm run test:integration
```

For the complete browser workflow, build the API first:

```bash
npm run build -w @abhaya/api
npm run test:e2e:local
```

The local browser helper includes a Linux headless Chromium package. On macOS/Windows, install Playwright's matching browser and set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to its executable, or run `npm run test:e2e` against your running TEST stack. Test reports may contain synthetic account and location data; do not commit real user traces.

## Android and iOS builds

The native package identifiers are `in.abhaya1107.app`. Confirm ownership and final branding before app-store submission. Link your own EAS project and add its ID to the mobile environment:

```bash
cd apps/mobile
npx eas-cli login
npx eas-cli init
npx eas-cli build --platform android --profile development
npx eas-cli build --platform android --profile preview
```

`preview` produces an APK for device testing. Use TEST API credentials and a reachable HTTPS staging URL. `development` includes the development client; run `npm run mobile` from the root to connect Metro. Production Android uses AAB:

```bash
npx eas-cli build --platform android --profile production
npx eas-cli build --platform ios --profile production
```

For local native development:

```bash
npm run android -w @abhaya/mobile
npm run ios -w @abhaya/mobile
```

The iOS command requires macOS/Xcode. EAS cloud builds require authentication and signing configuration. Generated native folders and Expo state are ignored. The manual GitHub Actions Android build expects `EXPO_TOKEN`, `GOOGLE_MAPS_ANDROID_API_KEY`, `EAS_PROJECT_ID`, and `PREVIEW_API_URL` in repository secret/variable storage. It is not triggered automatically or charged by the default CI.

## Deployment

1. Provision a private production PostgreSQL database with encryption, backups and tested restores.
2. Configure production API secrets, exact HTTPS origins and real providers in a secret manager.
3. Apply migrations once as a release job, before starting the new application version.
4. Run the API and worker as separate processes. Keep at least one worker running; use graceful shutdown and monitor queue age.
5. Build and run the web app with the correct map tile build variable and runtime `API_URL` / `WEB_ORIGIN`.
6. Terminate HTTPS at a trusted proxy. Set proxy trust only for your actual topology. Test health, latency, authorization, receipt failures and restoration before accepting real users.

```bash
npm ci
npm run db:generate
npm run db:deploy
npm run build
npm run start -w @abhaya/api
# Separate supervised process:
npm run start:worker -w @abhaya/api
# Separate supervised process:
npm run start -w @abhaya/web
```

Container configuration is also supplied:

```bash
docker build -f apps/api/Dockerfile --target migrate -t abhaya-migrate .
docker build -f apps/api/Dockerfile --target runtime -t abhaya-api .
docker build -f apps/web/Dockerfile -t abhaya-web .
```

Pass production environment values at runtime. Run the worker from the API image with command `node apps/api/dist/worker.js`. The web image uses Next.js standalone output. Set its map tile URL with the Docker build argument. Container builds are separately listed in the validation matrix.

`GET /health` returns only service/database health. It does not certify SMS, email, GPS or push delivery. Add monitoring for the worker and actual provider outcomes.

## CI and Git

The validation workflow installs the lockfile, generates Prisma, applies migrations to a dedicated PostgreSQL service, runs lint/type checks/unit/API tests, builds API/web/mobile bundles and exercises browser flows. Configure the `validate` job as a required status check in GitHub branch protection; adding a workflow alone does not enforce a merge gate.

The rebuild lives on `rebuild/fresh-start`. The previous `main` remains available for comparison. Secrets, signing files, native build output, caches and node_modules are ignored. Commit source changes and their validation evidence together. Do not force-push over the original project.

## Troubleshooting

- **“Let’s reconnect” with Prisma errors in API/worker logs:** stop `npm run dev` with Ctrl+C. Run `docker compose up -d --wait postgres`, then `npm run db:status`. If migrations are pending, run `npm run db:deploy` and restart `npm run dev`. Startup now runs the read-only migration check first. Logs include safe Prisma/PostgreSQL codes and hints without query values, passwords or connection strings. If status/deploy fails, retain its error code and stop there; do not reset the database or delete its volume.
- **Database authentication or port conflict:** an existing database may use different credentials, or another PostgreSQL instance may already own port 5432. Check `docker compose ps` and your API configuration against the actual server. Generating a new `.env` password does not change an existing PostgreSQL volume's password. Keep database credentials private when sharing error output.
- **Cannot reach the API on a phone:** use your computer LAN address, keep both devices on a reachable network, allow the development port, and restart Metro after changing `.env`.
- **GPS denied/timed out:** enable system GPS and review permissions in Settings; SOS remains available without coordinates. Accuracy and timestamps are shown; no coordinates are fabricated.
- **SOS unconfirmed:** it may have reached the server before the connection failed. Refresh status or use the same request retry. Do not interpret a spinner or queued message as delivery.
- **No contact alerts:** add consented, alert-enabled contacts. Check provider configuration, worker health, and individual delivery states.
- **Background tracking stops:** mobile operating systems can terminate work. Verify a development/preview build, background permission, Android foreground notification and device-specific battery settings.
- **Email reset/verification unavailable:** configure a verified sender and email API key, then run the worker. The UI does not claim an email was sent without configured delivery.
- **Map blank:** configure Android Maps signing restrictions or the web tile provider. Public incident/resource layers are empty until real verified data is integrated.
- **Web mutation returns Origin forbidden:** make `WEB_ORIGIN` match the full scheme/host/port you opened; avoid mixing `localhost` and `127.0.0.1`.
- **Session expired after concurrent tabs:** refresh-token replay protection may conservatively sign out competing tabs. Log in again.

ABHAYA helps communicate with trusted people. It does not guarantee safety, infer crimes from GPS, or automatically contact police. Live use requires the acceptance evidence in the linked device and security documents.
