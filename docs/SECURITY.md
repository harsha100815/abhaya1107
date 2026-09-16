# Security checklist

Implemented in the MVP:

- Helmet security headers and disabled `x-powered-by`.
- CORS allowlist from environment variables.
- Zod request validation and consistent error envelopes.
- Password hashing with bcrypt (12 rounds in demo; tune with production benchmarking).
- Short-lived access JWTs and random refresh-token rotation with hashed storage.
- Authentication rate limiting plus global API rate limiting.
- RBAC middleware for admin routes.
- UUID identifiers internally/externally where appropriate.
- Secure random 256-bit public-link tokens; only SHA-256 hashes are persisted.
- Link expiration and revocation.
- Duplicate active emergency prevention.
- Owner checks for locations, journeys, timers, evidence, contacts, and sessions.
- MIME/size validation for evidence metadata.
- Audit logs for signup/login/settings/admin operations.
- Sensitive values excluded from ordinary request logging.

Before production:

- Use an audited cookie/CSRF strategy or a reviewed mobile token strategy; do not store access tokens in localStorage for a high-risk browser deployment without a threat-model decision.
- Replace the in-process rate limiter with Redis and add login brute-force/account lockout rules that do not enable denial-of-service abuse.
- Require TLS, HSTS, secure cookies, strict CSP, trusted origins, and secret manager-backed rotation.
- Add idempotency keys for emergency creation and provider jobs.
- Add malware scanning, content disarm/defense, encryption-at-rest, object access logs, and lifecycle deletion for evidence.
- Add database row-level authorization tests, dependency scanning, SAST/DAST, security headers tests, backup restore drills, and third-party penetration testing.
- Redact location, medical data, email/phone, tokens, URLs, and evidence metadata from logs/analytics.
- Validate emergency service numbers and local legal requirements by jurisdiction. Do not silently escalate to authorities.
