import type { RequestHandler } from 'express';
import type { ParamsDictionary } from 'express-serve-static-core';
import { ZodError, ZodTypeAny } from 'zod';

/**
 * Generic Zod validator middleware.
 * Pass any combination of { body, query, params, headers } Zod schemas.
 *
 * Example:
 *   router.post(
 *     '/properties',
 *     validate({ body: createPropertySchema }),
 *     controllerFn
 *   )
 */
type Schemas = Partial<Record<'body' | 'query' | 'params' | 'headers', ZodTypeAny>>;

export function validate(schemas: Schemas): RequestHandler {
  return (req, res, next) => {
    try {
      if (schemas.body) {
        const parsed = schemas.body.safeParse(req.body);
        if (!parsed.success) return res.status(400).json(zodToResponse(parsed.error));
        req.body = parsed.data;
      }
      if (schemas.query) {
        const parsed = schemas.query.safeParse(req.query);
        if (!parsed.success) return res.status(400).json(zodToResponse(parsed.error));
        req.query = parsed.data as any;
      }
    if (schemas.params) {
  const parsed = schemas.params.safeParse(req.params);
  if (!parsed.success) return res.status(400).json(zodToResponse(parsed.error));
  // ✅ satisfy Express type
  req.params = parsed.data as unknown as ParamsDictionary;
}
      if (schemas.headers) {
        const parsed = schemas.headers.safeParse(req.headers);
        if (!parsed.success) return res.status(400).json(zodToResponse(parsed.error));
        // do not overwrite headers object; just ensure validation occurred
      }
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

function zodToResponse(error: ZodError) {
  // Zod exposes a standardized issues array; great for API responses. :contentReference[oaicite:1]{index=1}
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
