"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = validate;
function validate(schemas) {
    return (req, res, next) => {
        try {
            // Body is writable – safe to replace
            if (schemas.body) {
                const parsed = schemas.body.safeParse(req.body);
                if (!parsed.success)
                    return res.status(400).json(zodToResponse(parsed.error));
                req.body = parsed.data;
            }
            // ❌ Do not assign to req.query in Express 5 (getter-only)
            // ✅ Put validated query on res.locals
            if (schemas.query) {
                const parsed = schemas.query.safeParse(req.query);
                if (!parsed.success)
                    return res.status(400).json(zodToResponse(parsed.error));
                res.locals.query = parsed.data;
            }
            // req.params writes may not persist across the pipeline in v5;
            // keep a validated copy on locals as well.
            if (schemas.params) {
                const parsed = schemas.params.safeParse(req.params);
                if (!parsed.success)
                    return res.status(400).json(zodToResponse(parsed.error));
                req.params = parsed.data; // keeps TS happy
                res.locals.params = parsed.data;
            }
            if (schemas.headers) {
                const parsed = schemas.headers.safeParse(req.headers);
                if (!parsed.success)
                    return res.status(400).json(zodToResponse(parsed.error));
                // don’t overwrite req.headers; validation only
            }
            next();
        }
        catch (err) {
            next(err);
        }
    };
}
function zodToResponse(error) {
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
