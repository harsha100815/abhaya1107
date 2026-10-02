# Deployment readiness — 2 October 2026

## Working copy

Use `/Users/hasnabadharshavardhan/Projects/abhaya1107` on `rebuild/fresh-start`.
The original checkout was replaced with the newer rebuild formerly named
`abhaya1107-release`. Four nested test clones and the old auth-form-fix checkout
were removed after their recovery archives were verified.

Recovery files are outside the repository at
`/Users/hasnabadharshavardhan/Projects/_archives/abhaya1107-2026-10-02`.
They preserve source, Git history, local changes, and environment files. Dependencies
and generated caches were excluded. Keep these archives private.

The preserved UUID fallback now passes strict TypeScript checks. The old local
Expo 57 dependency change and hard-coded phone hotspot origin are archived rather
than applied to the SDK 55 rebuild.

## Passed locally

- Prisma client generation and committed database migration on temporary test databases.
- ESLint and all workspace TypeScript checks.
- 21 unit tests and 14 API integration tests.
- API, worker, and optimized web builds; TypeScript checks and builds also passed
  on the deployment Node.js 24 runtime (24.21.0).
- Android and iOS JavaScript exports (not signed native binaries).
- Four browser flows: form persistence, registration/login/contact/GPS/TEST SOS,
  denied GPS, and offline SOS recovery.
- `render.yaml` validated against Render's current published JSON Schema.
- Remote rebuild branch refreshed and matched the starting local commit `32f6921`.

## Deployable scope and remaining steps

The existing Blueprint is for a **TEST preview** with simulated alerts. Follow
[the Render guide](RENDER.md), using `rebuild/fresh-start` and the root `render.yaml`.

1. Push the prepared local commit and let the repository CI checks pass.
2. Connect the repository in Render and provide fresh `JWT_SECRET` and
   `DATA_ENCRYPTION_KEY` in its secret fields. Local `.env` files stay local.
3. Review Render's actual cost estimate; the worker uses a paid plan.
4. Apply the Blueprint, verify web/API/worker startup and migrations, then run
   the post-deployment checks in the Render guide against the assigned HTTPS URL.

No cloud deployment or live URL has been verified by this cleanup. Schema validation
cannot replace Render's authenticated semantic validation or actual cloud startup.
For real emergency use, configure real SMS/email/push delivery, appropriate backed-up
infrastructure, and complete physical-device and security acceptance checks.

Sources: [Render Blueprint specification](https://render.com/docs/blueprint-spec).
