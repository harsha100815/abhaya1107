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
