# Validation record

Executed on 21 September 2026 with Node.js 24.19.0 and npm 11.9.0. This records development validation, not approval for live emergency use.

| Check                                                | Result                         | Scope                                                                                             |
| ---------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------- |
| Clean lockfile install (`npm ci`)                    | Passed                         | Patched dependency versions installed from the committed lockfile                                 |
| Prisma client generation and initial migration       | Passed                         | Disposable PostgreSQL-WASM databases                                                              |
| ESLint and TypeScript checks                         | Passed                         | All application and shared workspaces                                                             |
| Unit tests (`npm test`)                              | 18 passed                      | Safety rules, validation, API response handling, refresh coordination, credentials and encryption |
| API integration (`npm run test:local`)               | 14 passed                      | Real Express/Prisma queries against disposable PGlite PostgreSQL-WASM                             |
| Browser E2E (`npm run test:e2e:local`)               | 3 passed                       | Chromium, Next.js, API and worker with a disposable database                                      |
| Production API and Next.js builds                    | Passed                         | Compiled API and Next.js standalone build                                                         |
| Android and iOS JavaScript/Hermes export             | Passed                         | Expo SDK 55; this does not produce an installable native binary                                   |
| Production dependency audit (`npm audit --omit=dev`) | 0 reported vulnerabilities     | Registry result at validation time; not a security certification                                  |
| Responsive visual review                             | Passed                         | Desktop light/dark and 390px browser layouts; screenshots in `docs/screenshots`                   |
| Standard PostgreSQL 17 CI                            | Configured, pending remote run | Separate from the locally executed PGlite checks                                                  |
| Docker image builds                                  | Not executed                   | Docker daemon unavailable in this environment                                                     |
| Signed APK/AAB and iOS build                         | Not executed                   | EAS project/signing credentials and native build environment required                             |
| Physical-device GPS/background/push                  | Not executed                   | Follow `DEVICE-TESTS.md` on actual Android and iOS devices                                        |
| Live SMS/email/push delivery                         | Not executed                   | Provider credentials and consented test recipients required                                       |

## What the tests establish

Browser coverage includes account creation, sign-out/sign-in, a consented contact, GPS permission, countdown cancellation, an acknowledged TEST SOS, simulated delivery, live coordinate ingestion, resolution, dark appearance, denied GPS without invented coordinates, and offline SOS recovery with the original idempotency key. Simulated coordinates and contacts in screenshots are browser-test fixtures, not production seed data.

API coverage includes ownership isolation, contact changes, SOS idempotency, stale-location rejection, explicit sharing, tracking-link revocation, journey overdue escalation, private incident access, unavailable recovery providers, rotating refresh/replay behavior, and account deletion. No test sends a real alert.

Browser testing found and fixed an unbound native `fetch` call and the unauthenticated refresh response, which had prevented first-time sign-in. It also verified the fix that retains a pending GPS change during location throttling.

## Dependency notes

Root overrides pin patched `deepmerge-ts`, `mysql2`, `decode-uri-component` and `xcode`'s `uuid`. The committed lockfile was freshly resolved and installed with `npm ci`; generation, builds and runtime tests were rerun with those versions. npm 11.9's `npm ls` reports upstream range mismatches for these deliberate overrides. Review and remove each override when its upstream package adopts a patched compatible version. Do not regenerate a lockfile without checking the resolved versions, audit result and builds.

## Remaining release gates

Run the standard PostgreSQL CI and container builds. Configure HTTPS endpoints, database backups/encryption, real delivery providers and monitoring. Link the EAS project, provide Maps/APNs/FCM/signing credentials, produce an Android preview APK, and complete the physical-device checklist. Verify delivery failures and receipts with consenting recipients before enabling LIVE mode. Phone-number ownership verification and verified public map/resource datasets are not implemented; the interface does not claim they are.

The previous implementation is preserved on `main`; this rebuild uses a new database and does not import its JSON snapshots.

## Database diagnostics follow-up — 21 September 2026

A local startup report showed API and worker database failures without actionable error codes. Added safe Prisma/PostgreSQL codes and fixed troubleshooting hints to server logs; query values, connection strings, exception messages and stacks remain excluded. Added `npm run db:status` and a read-only migration precheck before `npm run dev`.

Follow-up validation passed: 21 unit tests (including three diagnostics/privacy cases), ESLint, API TypeScript and API build. A disposable empty PostgreSQL-WASM database returned exit 1 from the migration check; after `db:deploy`, the same check returned exit 0. The reporting user's database cause still needs confirmation from their migration/error output. No user database was reset or modified by this follow-up.

## Local database isolation — 21 September 2026

Subsequent user output confirmed Docker could not bind host port 5432 and Prisma returned P1010 from the existing server. Repeated clones also used the same directory basename and therefore the same default Compose project name. Added `POSTGRES_PORT` support and an explicit `npm run setup:db` recovery command that assigns this checkout a unique Compose project and an available local port, with matching API credentials. It preserves old containers/volumes and API secrets, backs up environment files and does not migrate data from any old database.

ESLint and isolated configuration checks passed: two same-name checkouts receive different project identities; an occupied port is avoided; API and Compose settings match; credentials are not printed; secrets and backups are preserved; a second run leaves files unchanged; production mode and conflicting shell overrides are refused before writes. Container startup on the user's Mac still needs to be run there; no Docker daemon is available in this workspace.

## Authentication form stability — 26 September 2026

Reproduced the reported input reset in Chromium: after the 10-second dashboard polling interval, a partially filled registration form lost its values. An unauthenticated query error was cleared during each refetch, causing the form to unmount while the loading screen appeared.

Signed-out state is now cached explicitly as `null`; polling, focus and reconnect refreshes stop while signed out. Signing in explicitly reloads the dashboard, and authenticated dashboard polling remains enabled. The regression test failed before the change and passed afterward, retaining registration/login values, selected form mode and keyboard focus across polling intervals and focus events. All four browser flows passed after the change, as did ESLint, web TypeScript checks and the production web build. Hosting account access is still required for deployment; no deployed URL is claimed by these checks.

## Render preview configuration — 26 September 2026

Added a Render Blueprint for the web app, API, separately supervised worker, and
PostgreSQL 17 in Singapore. The compiled API/worker remain in simulated TEST mode;
the web uses its production build and secure cookies. Runtime URLs and shared
worker secrets reference Render service values, and the database rejects public
connections. The Blueprint documents the paid worker and free database expiry.

Validated the formatted Blueprint against Render's published JSON Schema
(downloaded on 26 September 2026), checked cross-resource references and shell
syntax, and exercised worker startup against a disposable PGlite database. The
worker stayed stopped before migrations, started after the API migration command
succeeded, and completed a database cycle without worker errors. No application
logic changed, so the preceding browser/build results remain applicable.

The Render plugin was installed but exposed no callable deployment tools. The
authorized browser fallback reached a GitHub social-login error after Google
verification. Authenticated Render validation, cloud builds, service health,
resource creation, and a public application URL are not completed or claimed.
