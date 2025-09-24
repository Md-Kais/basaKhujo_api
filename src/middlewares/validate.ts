// src/middlewares/validate.ts
import type { RequestHandler } from 'express';
import type { ParamsDictionary } from 'express-serve-static-core';
import { ZodError, ZodTypeAny } from 'zod';

type Schemas = Partial<Record<'body' | 'query' | 'params' | 'headers', ZodTypeAny>>;

export function validate(schemas: Schemas): RequestHandler {
  return (req, res, next) => {
    try {
      // Body is writable – safe to replace
      if (schemas.body) {
        const parsed = schemas.body.safeParse(req.body);
        if (!parsed.success) return res.status(400).json(zodToResponse(parsed.error));
        req.body = parsed.data as any;
      }

      // ❌ Do not assign to req.query in Express 5 (getter-only)
      // ✅ Put validated query on res.locals
      if (schemas.query) {
        const parsed = schemas.query.safeParse(req.query);
        if (!parsed.success) return res.status(400).json(zodToResponse(parsed.error));
        (res.locals as any).query = parsed.data;
      }

      // req.params writes may not persist across the pipeline in v5;
      // keep a validated copy on locals as well.
      if (schemas.params) {
        const parsed = schemas.params.safeParse(req.params);
        if (!parsed.success) return res.status(400).json(zodToResponse(parsed.error));
        req.params = parsed.data as unknown as ParamsDictionary; // keeps TS happy
        (res.locals as any).params = parsed.data;
      }

      if (schemas.headers) {
        const parsed = schemas.headers.safeParse(req.headers);
        if (!parsed.success) return res.status(400).json(zodToResponse(parsed.error));
        // don’t overwrite req.headers; validation only
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

function zodToResponse(error: ZodError) {
  return {
    status: 400,
    message: 'Validation failed',
    errors: error.issues.map((i) => ({
      path: i.path.join('.'),
      code: i.code,
      message: i.message,
    })),
  };
}
