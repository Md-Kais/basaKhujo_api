import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import multer from 'multer';
import * as jwt from 'jsonwebtoken';

export class ApiError extends Error {
  statusCode: number;
  details?: unknown;
  constructor(statusCode: number, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

export const notFound: RequestHandler = (req, _res, next) => {
  next(new ApiError(404, `Route ${req.method} ${req.originalUrl} not found`));
};

// ---- Prisma type guards (no runtime import) ----
type PrismaKnown = { name?: string; code?: string; meta?: unknown; clientVersion?: string };
const isPrismaKnown = (e: unknown): e is PrismaKnown =>
  !!e && typeof e === 'object' && 'code' in (e as any) && typeof (e as any).code === 'string';

const isPrismaValidation = (e: unknown): boolean =>
  !!e && typeof e === 'object' && (e as any).name === 'PrismaClientValidationError';

// -----------------------------------------------
export const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) return next(err);

  let status = 500;
  let message = 'Internal Server Error';
  let details: any;

  if (err instanceof ApiError) {
    status = err.statusCode; message = err.message; details = err.details;
  } else if (err instanceof ZodError) {
    status = 400; message = 'Validation failed';
    details = err.issues.map(i => ({ path: i.path.join('.'), code: i.code, message: i.message }));
  } else if (isPrismaKnown(err)) {
    // P2002 unique, P2025 not found, P2003 FK, etc.
    switch (err.code) {
      case 'P2002': status = 409; message = 'Unique constraint failed'; details = { target: (err as any).meta?.target }; break;
      case 'P2025': status = 404; message = 'Record not found'; break;
      case 'P2003': status = 409; message = 'Foreign key constraint failed'; break;
      default:      status = 400; message = 'Database error';
    }
  } else if (isPrismaValidation(err)) {
    status = 400; message = 'Invalid database query';
  } else if (err instanceof multer.MulterError) {
    status = 400; message = `Upload error: ${err.message}`; details = { code: err.code, field: err.field };
  } else if (err instanceof jwt.TokenExpiredError) {
    status = 401; message = 'Token expired';
  } else if (err instanceof jwt.JsonWebTokenError) {
    status = 401; message = 'Invalid token';
  } else if (err instanceof SyntaxError && (err as any).type === 'entity.parse.failed') {
    status = 400; message = 'Invalid JSON payload';
  }

  const payload: any = { status, message };
  if (details) payload.details = details;
  if (process.env.NODE_ENV !== 'production') payload.stack = err.stack;
  return res.status(status).json(payload);
};
