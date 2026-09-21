# Security and privacy design

## Authentication

Passwords use bcrypt at cost 12 with a maximum 72 UTF-8 bytes. Access JWTs last 10 minutes, enforce HS256, issuer and audience, and reference a live database session. Every request checks session revocation. Refresh tokens are random 256-bit values stored as SHA-256 hashes; rotation locks the session row. Replaying a used token revokes that session family. Password reset revokes all sessions. Password-reset and verification tokens expire after 30 minutes and are consumed atomically.

Mobile session credentials live in SecureStore (device-only keychain accessibility). Web tokens are only in HttpOnly, SameSite Strict cookies. The Next.js proxy rejects mutations from an unexpected Origin. The browser client performs one shared refresh for concurrent requests; no tokens are persisted to localStorage. Multiple open browser tabs can race a refresh and cause a conservative sign-out; the user must log in again.

## Authorization and location

Resource queries constrain ownership. Safety mutations lock the user row; partial unique indexes prevent multiple active SOS/journeys and primary contacts. Private history never enters a public safety map. Tracking links use hashed 256-bit bearer tokens, expire in 24 hours, and require the source event to remain active with sharing enabled. Tokens are carried in URL fragments then posted in the lookup body. Location ingestion requires one owned, active sharing subject; malformed, future or stale points are rejected. SOS and location request IDs provide idempotency. Emergency creation is never automatically queued offline.

## Evidence and sensitive logs

Image files are validated, size/pixel bounded, decoded with Sharp, stripped of metadata and re-encoded as JPEG. Evidence, profile images and queued message bodies use AES-256-GCM encryption with a separately supplied 32-byte key. Keep the encryption key in a secret manager, back it up separately and retain it across deployments. Rotation requires re-encryption of existing rows. Coordinates, phone numbers, email addresses and bearer tokens are not placed in request logs. Configure PostgreSQL encrypted disks/backups and strict database access because relational location columns are not individually encrypted.

## Notifications

SOS creation and outbox insertion are one transaction. A worker claims jobs with SKIP LOCKED and a lease. It never reports successful delivery merely because a row exists. TEST rows never call external providers. Provider acknowledgement is ACCEPTED, separate from DELIVERED. An ambiguous timeout/crash becomes UNKNOWN and is not blindly resent (duplicate emergency alerts can be harmful). SMS/email status polling can advance delivery state; an Expo receipt confirms APNs/FCM handoff only. In-flight messages cannot be recalled when an SOS is resolved, data is deleted or contact preferences change.

## Operations

Database-backed limits survive restarts and are shared by replicas. Keep database and application hosts time-synchronized. Explicitly configure reverse proxy trust; do not trust arbitrary forwarded IP headers. A shared web proxy can cause the API's IP bucket to apply to many web users, so load-test limits and use a correctly authenticated edge/IP forwarding architecture before large deployments. Cap replicas against the database connection budget. Supervise the API and worker separately. Monitor worker errors, outbox age, overdue session lag, UNKNOWN deliveries and health checks. Do not log outbound provider payloads or authorization headers.

Location points default to 7-day retention. Grants expire within 24 hours, account tokens are cleaned after expiry, old sessions are removed and notification records default to 30 days. Private incidents remain until owner deletion. Account deletion cascades dependent records. Backup expiration must implement the same documented deletion policy. Stopping sharing does not delete previously received messages from recipients’ devices.

## Required launch evidence

Complete real provider receipt tests, physical Android/iOS permission/background tests, independent abuse/security review, restore drills, load testing, operational monitoring and regional consent/privacy review. See VALIDATION.md for actual results rather than treating this file as certification. No automatic police integration exists.
