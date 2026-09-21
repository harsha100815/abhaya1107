-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "EmergencyStatus" AS ENUM ('ACTIVE', 'CANCELLED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "JourneyStatus" AS ENUM ('ACTIVE', 'OVERDUE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('QUEUED', 'PROCESSING', 'ACCEPTED', 'DELIVERED', 'FAILED', 'UNKNOWN', 'TEST', 'CANCELLED', 'UNCONFIGURED');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "phone" TEXT,
    "emailVerifiedAt" TIMESTAMP(3),
    "theme" TEXT NOT NULL DEFAULT 'system',
    "pushEnabled" BOOLEAN NOT NULL DEFAULT true,
    "securityEmails" BOOLEAN NOT NULL DEFAULT true,
    "avatar" BYTEA,
    "avatarMime" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionToken" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActionToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmergencyContact" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "receivesAlerts" BOOLEAN NOT NULL DEFAULT true,
    "consentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmergencyContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmergencyEvent" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "clientRequestId" UUID NOT NULL,
    "status" "EmergencyStatus" NOT NULL DEFAULT 'ACTIVE',
    "testMode" BOOLEAN NOT NULL,
    "shareLocation" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "EmergencyEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LocationUpdate" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "clientRequestId" UUID NOT NULL,
    "emergencyId" UUID,
    "safetySessionId" UUID,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "accuracy" DOUBLE PRECISION NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LocationUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SafetySession" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "clientRequestId" UUID NOT NULL,
    "contactId" UUID,
    "destination" TEXT NOT NULL,
    "expectedAt" TIMESTAMP(3) NOT NULL,
    "status" "JourneyStatus" NOT NULL DEFAULT 'ACTIVE',
    "shareLocation" BOOLEAN NOT NULL DEFAULT false,
    "testMode" BOOLEAN NOT NULL,
    "lastCheckInAt" TIMESTAMP(3),
    "escalationCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "SafetySession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Incident" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "clientRequestId" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "evidence" BYTEA,
    "evidenceMime" TEXT,
    "evidenceConsentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "emergencyId" UUID,
    "safetySessionId" UUID,
    "dedupeKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "recipientLabel" TEXT NOT NULL,
    "payload" BYTEA NOT NULL,
    "testMode" BOOLEAN NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "leaseUntil" TIMESTAMP(3),
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "providerId" TEXT,
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Device" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateBucket" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateBucket_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "ShareGrant" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "emergencyId" UUID,
    "safetySessionId" UUID,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShareGrant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Session_userId_revokedAt_idx" ON "Session"("userId", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_sessionId_idx" ON "RefreshToken"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "ActionToken_tokenHash_key" ON "ActionToken"("tokenHash");

-- CreateIndex
CREATE INDEX "ActionToken_userId_purpose_idx" ON "ActionToken"("userId", "purpose");

-- CreateIndex
CREATE INDEX "EmergencyContact_userId_idx" ON "EmergencyContact"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "EmergencyContact_userId_phone_key" ON "EmergencyContact"("userId", "phone");

-- CreateIndex
CREATE INDEX "EmergencyEvent_userId_createdAt_idx" ON "EmergencyEvent"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmergencyEvent_userId_clientRequestId_key" ON "EmergencyEvent"("userId", "clientRequestId");

-- CreateIndex
CREATE INDEX "LocationUpdate_emergencyId_capturedAt_idx" ON "LocationUpdate"("emergencyId", "capturedAt");

-- CreateIndex
CREATE INDEX "LocationUpdate_safetySessionId_capturedAt_idx" ON "LocationUpdate"("safetySessionId", "capturedAt");

-- CreateIndex
CREATE INDEX "LocationUpdate_createdAt_idx" ON "LocationUpdate"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LocationUpdate_userId_clientRequestId_key" ON "LocationUpdate"("userId", "clientRequestId");

-- CreateIndex
CREATE INDEX "SafetySession_status_expectedAt_idx" ON "SafetySession"("status", "expectedAt");

-- CreateIndex
CREATE INDEX "SafetySession_userId_createdAt_idx" ON "SafetySession"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SafetySession_userId_clientRequestId_key" ON "SafetySession"("userId", "clientRequestId");

-- CreateIndex
CREATE INDEX "Incident_userId_createdAt_idx" ON "Incident"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Incident_userId_clientRequestId_key" ON "Incident"("userId", "clientRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_dedupeKey_key" ON "Notification"("dedupeKey");

-- CreateIndex
CREATE INDEX "Notification_status_nextAttemptAt_idx" ON "Notification"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Device_token_key" ON "Device"("token");

-- CreateIndex
CREATE INDEX "Device_userId_idx" ON "Device"("userId");

-- CreateIndex
CREATE INDEX "RateBucket_expiresAt_idx" ON "RateBucket"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ShareGrant_tokenHash_key" ON "ShareGrant"("tokenHash");

-- CreateIndex
CREATE INDEX "ShareGrant_userId_idx" ON "ShareGrant"("userId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionToken" ADD CONSTRAINT "ActionToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyContact" ADD CONSTRAINT "EmergencyContact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyEvent" ADD CONSTRAINT "EmergencyEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocationUpdate" ADD CONSTRAINT "LocationUpdate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocationUpdate" ADD CONSTRAINT "LocationUpdate_emergencyId_fkey" FOREIGN KEY ("emergencyId") REFERENCES "EmergencyEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocationUpdate" ADD CONSTRAINT "LocationUpdate_safetySessionId_fkey" FOREIGN KEY ("safetySessionId") REFERENCES "SafetySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetySession" ADD CONSTRAINT "SafetySession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetySession" ADD CONSTRAINT "SafetySession_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "EmergencyContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_emergencyId_fkey" FOREIGN KEY ("emergencyId") REFERENCES "EmergencyEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_safetySessionId_fkey" FOREIGN KEY ("safetySessionId") REFERENCES "SafetySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShareGrant" ADD CONSTRAINT "ShareGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShareGrant" ADD CONSTRAINT "ShareGrant_emergencyId_fkey" FOREIGN KEY ("emergencyId") REFERENCES "EmergencyEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShareGrant" ADD CONSTRAINT "ShareGrant_safetySessionId_fkey" FOREIGN KEY ("safetySessionId") REFERENCES "SafetySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "one_active_sos_per_user" ON "EmergencyEvent" ("userId") WHERE "status" = 'ACTIVE';
CREATE UNIQUE INDEX "one_open_journey_per_user" ON "SafetySession" ("userId") WHERE "status" IN ('ACTIVE','OVERDUE');
CREATE UNIQUE INDEX "one_primary_contact_per_user" ON "EmergencyContact" ("userId") WHERE "isPrimary" = true;
ALTER TABLE "LocationUpdate" ADD CONSTRAINT "location_coordinates" CHECK ("latitude" BETWEEN -90 AND 90 AND "longitude" BETWEEN -180 AND 180 AND "accuracy" >= 0);
ALTER TABLE "LocationUpdate" ADD CONSTRAINT "one_location_subject" CHECK (("emergencyId" IS NOT NULL)::int + ("safetySessionId" IS NOT NULL)::int = 1);
ALTER TABLE "ShareGrant" ADD CONSTRAINT "one_grant_subject" CHECK (("emergencyId" IS NOT NULL)::int + ("safetySessionId" IS NOT NULL)::int = 1);
