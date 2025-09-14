"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = exports.notFound = exports.ApiError = void 0;
const zod_1 = require("zod");
const multer_1 = __importDefault(require("multer"));
const jwt = __importStar(require("jsonwebtoken"));
class ApiError extends Error {
    constructor(statusCode, message, details) {
        super(message);
        this.statusCode = statusCode;
        this.details = details;
    }
}
exports.ApiError = ApiError;
const notFound = (req, _res, next) => {
    next(new ApiError(404, `Route ${req.method} ${req.originalUrl} not found`));
};
exports.notFound = notFound;
const isPrismaKnown = (e) => !!e && typeof e === 'object' && 'code' in e && typeof e.code === 'string';
const isPrismaValidation = (e) => !!e && typeof e === 'object' && e.name === 'PrismaClientValidationError';
// -----------------------------------------------
const errorHandler = (err, _req, res, next) => {
    if (res.headersSent)
        return next(err);
    let status = 500;
    let message = 'Internal Server Error';
    let details;
    if (err instanceof ApiError) {
        status = err.statusCode;
        message = err.message;
        details = err.details;
    }
    else if (err instanceof zod_1.ZodError) {
        status = 400;
        message = 'Validation failed';
        details = err.issues.map(i => ({ path: i.path.join('.'), code: i.code, message: i.message }));
    }
    else if (isPrismaKnown(err)) {
        // P2002 unique, P2025 not found, P2003 FK, etc.
        switch (err.code) {
            case 'P2002':
                status = 409;
                message = 'Unique constraint failed';
                details = { target: err.meta?.target };
                break;
            case 'P2025':
                status = 404;
                message = 'Record not found';
                break;
            case 'P2003':
                status = 409;
                message = 'Foreign key constraint failed';
                break;
            default:
                status = 400;
                message = 'Database error';
        }
    }
    else if (isPrismaValidation(err)) {
        status = 400;
        message = 'Invalid database query';
    }
    else if (err instanceof multer_1.default.MulterError) {
        status = 400;
        message = `Upload error: ${err.message}`;
        details = { code: err.code, field: err.field };
    }
    else if (err instanceof jwt.TokenExpiredError) {
        status = 401;
        message = 'Token expired';
    }
    else if (err instanceof jwt.JsonWebTokenError) {
        status = 401;
        message = 'Invalid token';
    }
    else if (err instanceof SyntaxError && err.type === 'entity.parse.failed') {
        status = 400;
        message = 'Invalid JSON payload';
    }
    const payload = { status, message };
    if (details)
        payload.details = details;
    if (process.env.NODE_ENV !== 'production')
        payload.stack = err.stack;
    return res.status(status).json(payload);
};
exports.errorHandler = errorHandler;
