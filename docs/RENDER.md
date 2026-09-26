# Render TEST preview

The root `render.yaml` provisions the complete web/API/worker/PostgreSQL stack
from `rebuild/fresh-start` in Singapore. It is a TEST preview: SOS and journey
alerts are simulated, and email verification/recovery remain unavailable until
an email provider is configured. The existing UI labels TEST mode. This is not
a live emergency service or an Android/iOS binary release.

## Cost and limits

The web app, API, and database use Render's free plans. The separate background
worker requires the Starter plan, listed at **US$7/month** on 26 September 2026.
Review the actual Dashboard estimate, billing settings, taxes, and any usage
charges before applying the Blueprint. Committing this file creates no resources.

Free web services sleep after inactivity and share the workspace's monthly free
hours. An API cold start may exceed the web request timeout; wait for the API to
wake and use **Try again**. Free PostgreSQL expires after 30 days and has no
backups. Only one free database is allowed per workspace. Use synthetic test data.

See [Render pricing](https://render.com/pricing) and
[free-service limits](https://render.com/docs/free). Upgrade the database before
expiry to retain data. Always-on services and a backed-up database are required
before considering a real safety release.

## Apply the Blueprint

1. In the Render Dashboard, create a **Blueprint** from
   `https://github.com/harsha100815/abhaya1107`.
2. Select **rebuild/fresh-start** and the root **render.yaml**. `main` still
   contains the original project, so selecting it will not deploy this rebuild.
3. Provide the two API secrets when Render prompts. Generate distinct new keys
   locally with the commands below; enter the values only into Render's secret
   fields. Never commit them or paste them into chat.
4. Review the worker's paid plan and the three free resources, then apply.
5. Wait for **all three services** to become live. Open the web service's actual
   HTTPS URL from Render. URLs are wired by Render, so no guessed hostname or
   manual localhost configuration is needed.

Run each command separately. The first output is `JWT_SECRET`; the second is
`DATA_ENCRYPTION_KEY`:

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Keep both values in a password manager. The worker copies the API's secrets;
do not generate different worker keys. Preserve the encryption key for the full
lifetime of the database.

## Startup and configuration

- The API applies committed Prisma migrations before listening on `$PORT`.
  A migration failure prevents an apparently healthy API from starting.
- The worker checks migration status without modifying the database, waits for
  the API's migration to finish, and starts only after the schema is current.
- All processes use the internal database URL. Public database connections are
  disabled by the empty `ipAllowList`.
- The web service calls the API through its HTTPS URL because free web services
  cannot receive private-network requests. The start command adds `/api/v1` and
  sets the exact `WEB_ORIGIN` from Render's assigned URL.
- The web runs a production Next.js build with secure cookies. The compiled API
  and worker intentionally use `NODE_ENV=development`, `TEST_MODE_ONLY=true` for
  this preview. Production's real-provider validation is unchanged.
- `autoDeployTrigger: checksPass` deploys subsequent branch changes after CI
  passes. Preview environments are disabled to avoid accidental extra workers.
- The build includes development dependencies needed by TypeScript and Prisma.
  No local `.env` files, local database data, or developer accounts are uploaded.

If you add a custom domain, update `WEB_ORIGIN`, `PUBLIC_WEB_URL`, and
`CORS_ORIGINS` consistently. Do not turn off the origin checks.

## Verify after deployment

1. Confirm `/health` on the API returns HTTP 200 and inspect its deployment log
   for successful migrations. Health alone does not verify delivery.
2. Open the web URL and register a synthetic account. Leave the form filled for
   at least 15 seconds and switch browser focus; entered values should remain.
3. Sign in and add a consenting test contact. Run a TEST SOS and confirm the UI
   keeps the TEST label and shows simulated delivery accurately.
4. Exercise a short TEST journey, check-in, cancellation, sign-out, and sign-in.
5. Inspect the worker log for database errors, then check the corresponding
   simulated outbox/journey results. An API running without a healthy worker is
   an incomplete deployment.

Before live use, provide SMS/email/push credentials, choose appropriate paid
infrastructure, set production mode on both API and worker, and complete the
security and device acceptance checks in this repository. Provider delivery and
physical-device behavior cannot be established from the web preview alone.

## Validation status

The Blueprint is checked locally against Render's published JSON Schema. Account
access, Render's authenticated semantic validation, actual cloud builds, assigned
URLs, and live health must still be verified after deployment. Local validation
is not proof that a Render deployment has completed.
