# Production deployment

Updated 29 October 2026. Production deployment work is in progress. No live release,
provider delivery, signed mobile build or domain cutover is certified by this change.

Use `render.production.yaml` for the always-on web/API/worker/PostgreSQL deployment.
The root `render.yaml` and `npm start` remain explicitly simulated TEST previews.
The production Blueprint starts each service separately; it does not use `npm start`.

## Deployment prerequisites

The local checkout inspected for this release has no SMS, email or Expo credentials.
Render's browser session currently requires sign-in. Cloud environment values have
not been inspected. Enter provider secrets directly in Render, never in source or chat.

| Setting                                                   | Destination and purpose                                                             |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `JWT_SECRET`                                              | API secret field; fresh random value of at least 48 characters                      |
| `DATA_ENCRYPTION_KEY`                                     | API secret field; 32 random bytes encoded as 64 lowercase hex characters            |
| `SMS_ACCOUNT_SID`, `SMS_AUTH_TOKEN`, `SMS_FROM`           | API secret fields; the implemented SMS adapter uses Twilio                          |
| `EMAIL_API_KEY`, `EMAIL_FROM`                             | API secret fields; the implemented email adapter uses Resend with a verified sender |
| `EXPO_ACCESS_TOKEN`                                       | API secret field; required for production push configuration                        |
| `NEXT_PUBLIC_MAP_TILE_URL`, `NEXT_PUBLIC_MAP_ATTRIBUTION` | Web build settings; approved tile provider and attribution                          |
| `DATABASE_URL`                                            | Blueprint-managed private PostgreSQL connection for API and worker                  |
| `PUBLIC_WEB_URL`, `CORS_ORIGINS`, `API_ORIGIN`            | Blueprint-managed service URLs for the initial deployment                           |

Render copies API secrets into the worker. Preserve the encryption key with the
database backup; changing it loses access to previously encrypted records. Do not
reuse development credentials or import synthetic preview accounts into production.

For native builds also configure `EXPO_PUBLIC_API_URL` with the actual HTTPS API URL
including `/api/v1`, `EXPO_PUBLIC_EAS_PROJECT_ID`, the restricted Android maps key,
FCM/APNs credentials and platform signing. An Expo access token alone does not
complete native push setup.

## Apply the production Blueprint

1. Merge the reviewed deployment changes into `rebuild/fresh-start` and require its
   GitHub validation workflow to pass. `main` contains the older application.
2. Sign in to the existing Render workspace and inspect the current services and
   custom domain before creating anything. Avoid duplicate resources and retain
   the existing deployment for rollback.
3. Create a Blueprint from `https://github.com/harsha100815/abhaya1107`, branch
   `rebuild/fresh-start`, and explicitly select `render.production.yaml`.
4. Supply the values above. Review Render's actual recurring cost for the two
   `1c-2g` services, `0.5c-512mb` worker, `0.5c-1g` PostgreSQL and 20 GB storage
   before applying the Blueprint. Confirm provider billing separately.
5. Wait for successful builds. The API pre-deploy command runs
   `npm run production:check -w @abhaya/api` before migrations. It rejects missing
   live-provider configuration, TEST mode and inconsistent HTTPS origins.
6. Confirm API migration success, API/web health, and a running worker whose
   migration check completes. A healthy web/API alone does not prove worker health.

The API and worker both parse the same production requirements at startup. The
preflight checks configuration without connecting to a provider or database; it
cannot establish credential validity, carrier delivery or device display.

## Read-only live verification

Run from a machine with network access, using the exact URLs assigned by Render:

```bash
npm run deploy:verify -- \
  --api-origin https://YOUR_ACTUAL_API_HOST \
  --web-origin https://YOUR_ACTUAL_WEB_HOST
```

Supply origins only, without `/api/v1`. The command sends four GET requests: API
`/health`, API `/api/v1/config`, web `/`, and web `/api/config`. It rejects HTTP
origins, redirects, unhealthy databases, TEST mode, and missing SMS/email/push
configuration on either the API or the web proxy. It never registers an account,
starts an SOS, queues an alert, sends a message or changes user data.

After these checks, verify live account verification/recovery, worker processing,
and delivery to explicitly selected consenting recipients. Record provider receipts
and physical-device results. Do not infer delivery from `liveAlertsConfigured`.

## Domain cutover and rollback

Only after the assigned-host checks pass, attach `abhaya1107.in` to the production
web service and verify the DNS/TLS instructions shown by Render. Set web
`WEB_ORIGIN`, API `PUBLIC_WEB_URL`, and API/worker `CORS_ORIGINS` consistently to
`https://abhaya1107.in`; update the web start command's `WEB_ORIGIN` assignment to
use this custom origin. Keep the web's `API_URL` pointed to the actual API service.
The Blueprint initially sets these origins to the assigned Render hostname, so
update the Blueprint as part of the cutover to keep future syncs consistent.
Repeat the read-only check with the custom web origin and verify HTTPS sign-in.

Take a production database backup and retain the encryption key and last working
deployment before future releases. Exercise restore and rollback. Use compatible
database migrations; restoring code alone cannot undo a destructive schema change.

## Remaining acceptance work

The [production audit](audits/production-costs-2026-10-02.md) still records unresolved
shared-IP public limits, sequential worker throughput, load measurement, operational
monitoring/recovery and signed-device acceptance. This release preparation does
not resolve those findings or establish capacity for 1,000 users. Complete the
[device matrix](DEVICE-TESTS.md) and record live provider/cloud evidence before
presenting the service as ready for real emergency use.

Render references: [Blueprint fields](https://render.com/docs/blueprint-spec),
[deploy lifecycle](https://render.com/docs/deploys),
[pricing](https://render.com/pricing).
