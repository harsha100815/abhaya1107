import { z } from 'zod';
import { AppError } from './errors.js';
import type { Request } from 'express';

export const parseBody = <T extends z.ZodTypeAny>(schema: T, req: Request): z.output<T> => {
  const result = schema.safeParse(req.body);
  if (!result.success) throw new AppError(422, 'VALIDATION_ERROR', 'Please check the highlighted fields.', result.error.flatten().fieldErrors);
  return result.data as z.output<T>;
};

export const emailSchema = z.string().trim().email().max(160).transform((value) => value.toLowerCase());
export const phoneSchema = z.string().trim().min(7).max(24).regex(/^[+0-9 ()-]+$/, 'Enter a valid phone number');
export const locationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().min(0).max(10000).optional(),
  speed: z.number().min(0).max(200).optional(),
  heading: z.number().min(0).max(360).optional(),
  timestamp: z.string().datetime().optional(),
}).transform((value) => ({ ...value, timestamp: value.timestamp ?? new Date().toISOString() }));
