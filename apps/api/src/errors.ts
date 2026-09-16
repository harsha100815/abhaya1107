import type { NextFunction, Request, Response } from 'express';

export class AppError extends Error {
  statusCode: number;
  code: string;
  details?: unknown;
  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export const notFound = (message = 'The requested resource was not found') => new AppError(404, 'NOT_FOUND', message);
export const badRequest = (message: string, details?: unknown) => new AppError(400, 'BAD_REQUEST', message, details);
export const unauthorized = (message = 'Authentication is required') => new AppError(401, 'UNAUTHORIZED', message);
export const forbidden = (message = 'You do not have permission to perform this action') => new AppError(403, 'FORBIDDEN', message);
export const conflict = (message: string) => new AppError(409, 'CONFLICT', message);

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  const appError = error instanceof AppError ? error : undefined;
  if (!appError) console.error('[api:error]', error);
  res.status(appError?.statusCode ?? 500).json({
    ok: false,
    error: {
      code: appError?.code ?? 'INTERNAL_ERROR',
      message: appError?.message ?? 'Something went wrong. Please try again.',
      ...(appError?.details ? { details: appError.details } : {}),
    },
  });
}
