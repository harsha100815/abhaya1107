import { z } from 'zod';

export const idSchema = z.string().uuid();
export const emailSchema = z.string().trim().toLowerCase().email().max(254);
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{7,14}$/, 'Use international format, for example +919876543210');
export const passwordSchema = z
  .string()
  .min(12, 'Use at least 12 characters')
  .max(72, 'Use at most 72 characters')
  .refine(
    (v) => new TextEncoder().encode(v).length <= 72,
    'Password must be at most 72 UTF-8 bytes',
  );
export const registerSchema = z
  .object({ name: z.string().trim().min(2).max(80), email: emailSchema, password: passwordSchema })
  .strict();
export const loginSchema = z
  .object({ email: emailSchema, password: z.string().min(1).max(256) })
  .strict();
export const contactSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    phone: phoneSchema,
    email: emailSchema.optional(),
    isPrimary: z.boolean().default(false),
    receivesAlerts: z.boolean().default(true),
    consentConfirmed: z.literal(true, {
      errorMap: () => ({ message: 'Confirm this person agreed to receive your safety alerts' }),
    }),
  })
  .strict();
export const locationSchema = z
  .object({
    latitude: z.number().finite().min(-90).max(90),
    longitude: z.number().finite().min(-180).max(180),
    accuracy: z.number().finite().min(0).max(100000),
    capturedAt: z.string().datetime(),
  })
  .strict();
export const sosSchema = z
  .object({
    clientRequestId: idSchema,
    testMode: z.boolean(),
    shareLocation: z.boolean(),
    location: locationSchema.optional(),
  })
  .strict()
  .refine((v) => v.shareLocation || !v.location, {
    message: 'Location requires explicit sharing consent',
  });
export const locationUpdateSchema = z
  .object({
    clientRequestId: idSchema,
    emergencyId: idSchema.optional(),
    safetySessionId: idSchema.optional(),
    location: locationSchema,
  })
  .strict()
  .refine((v) => Number(!!v.emergencyId) + Number(!!v.safetySessionId) === 1, {
    message: 'Choose exactly one active SOS or journey',
  });
export const journeySchema = z
  .object({
    clientRequestId: idSchema,
    destination: z.string().trim().min(2).max(160),
    expectedAt: z.string().datetime(),
    contactId: idSchema,
    shareLocation: z.boolean(),
    testMode: z.boolean(),
  })
  .strict();
export const journeyActionSchema = z
  .object({
    action: z.enum(['check-in', 'extend', 'complete', 'cancel']),
    expectedAt: z.string().datetime().optional(),
  })
  .strict();
export const incidentSchema = z
  .object({
    clientRequestId: idSchema,
    category: z.enum([
      'HARASSMENT',
      'SUSPICIOUS_ACTIVITY',
      'ACCIDENT',
      'UNSAFE_LOCATION',
      'MEDICAL',
      'OTHER',
    ]),
    description: z.string().trim().min(10).max(4000),
    occurredAt: z.string().datetime(),
    location: locationSchema.optional(),
  })
  .strict();
export const profileSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    phone: phoneSchema.nullable().optional(),
    theme: z.enum(['system', 'light', 'dark']).optional(),
    pushEnabled: z.boolean().optional(),
    securityEmails: z.boolean().optional(),
  })
  .strict();
export const evidenceSchema = z
  .object({
    mimeType: z.enum(['image/jpeg', 'image/png']),
    base64: z.string().min(8).max(4200000),
    privacyConsent: z.literal(true),
  })
  .strict();
export const deviceSchema = z
  .object({
    token: z
      .string()
      .regex(/^(ExponentPushToken|ExpoPushToken)\[[\w-]+\]$/)
      .max(200),
    platform: z.enum(['ios', 'android']),
  })
  .strict();
export const opaqueTokenSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const refreshSchema = z.object({ refreshToken: opaqueTokenSchema }).strict();
export const resetSchema = z
  .object({ token: opaqueTokenSchema, password: passwordSchema })
  .strict();
export const paginationSchema = z.object({
  take: z.coerce.number().int().min(1).max(100).default(30),
  cursor: idSchema.optional(),
});

export const userViewSchema = z.object({
  id: idSchema,
  name: z.string(),
  email: z.string(),
  phone: z.string().nullable(),
  emailVerifiedAt: z.string().nullable(),
  theme: z.enum(['system', 'light', 'dark']),
  pushEnabled: z.boolean(),
  securityEmails: z.boolean(),
  hasAvatar: z.boolean(),
});
export const authViewSchema = z.object({
  user: userViewSchema,
  accessToken: z.string(),
  refreshToken: z.string(),
});
export const contactViewSchema = z.object({
  id: idSchema,
  name: z.string(),
  phone: z.string(),
  email: z.string().nullable(),
  isPrimary: z.boolean(),
  receivesAlerts: z.boolean(),
});
export const deliverySchema = z.object({
  id: idSchema,
  channel: z.string(),
  status: z.string(),
  recipientLabel: z.string(),
  createdAt: z.string(),
  errorCode: z.string().nullable(),
});
export const pointViewSchema = locationSchema.extend({ id: idSchema });
export const eventViewSchema = z.object({
  id: idSchema,
  status: z.enum(['ACTIVE', 'CANCELLED', 'RESOLVED']),
  testMode: z.boolean(),
  shareLocation: z.boolean(),
  createdAt: z.string(),
  endedAt: z.string().nullable(),
  locations: z.array(pointViewSchema),
  notifications: z.array(deliverySchema),
});
export const journeyViewSchema = z.object({
  id: idSchema,
  destination: z.string(),
  expectedAt: z.string(),
  status: z.enum(['ACTIVE', 'OVERDUE', 'COMPLETED', 'CANCELLED']),
  shareLocation: z.boolean(),
  testMode: z.boolean(),
  contactId: idSchema.nullable(),
  lastCheckInAt: z.string().nullable(),
  createdAt: z.string(),
  locations: z.array(pointViewSchema),
  notifications: z.array(deliverySchema),
});
export const incidentViewSchema = z.object({
  id: idSchema,
  category: z.string(),
  description: z.string(),
  occurredAt: z.string(),
  createdAt: z.string(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  hasEvidence: z.boolean(),
});
export const configViewSchema = z.object({
  testOnly: z.boolean(),
  liveAlertsConfigured: z.boolean(),
  emailVerificationConfigured: z.boolean(),
  emergencyNumber: z.string().nullable(),
});
export const messageViewSchema = z.object({ message: z.string() });
export const dashboardSchema = z.object({
  user: userViewSchema,
  contacts: z.array(contactViewSchema),
  emergencies: z.array(eventViewSchema),
  journeys: z.array(journeyViewSchema),
  incidents: z.array(incidentViewSchema),
});
