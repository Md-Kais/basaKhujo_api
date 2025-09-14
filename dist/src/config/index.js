"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const zod_1 = require("zod");
// Reusable helpers
const duration = zod_1.z.union([
    zod_1.z.number().int().positive(),
    zod_1.z.string().regex(/^\d+(ms|s|m|h|d)$/i, 'Use 15m, 7d, 900s, etc.')
]);
const csv = (val) => (val ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
// ---- Zod schema for env ----
const EnvSchema = zod_1.z.object({
    NODE_ENV: zod_1.z.enum(['development', 'test', 'production']).default('development'),
    PORT: zod_1.z.coerce.number().int().positive().default(4000),
    // Database (Neon + Prisma)
    DATABASE_URL: zod_1.z.string().url({ message: 'DATABASE_URL must be a valid URL' }),
    DIRECT_URL: zod_1.z.string().url().optional(), // recommended when using a pooler
    // JWT
    JWT_ACCESS_SECRET: zod_1.z.string().min(16, 'JWT_ACCESS_SECRET is required (>=16 chars)'),
    JWT_REFRESH_SECRET: zod_1.z.string().min(16, 'JWT_REFRESH_SECRET is required (>=16 chars)'),
    JWT_ACCESS_EXPIRES_IN: duration.default('15m'),
    JWT_REFRESH_EXPIRES_IN: duration.default('7d'),
    // Redis (either Redis Cloud rediss:// or Upstash etc.)
    REDIS_URL: zod_1.z.string().url().optional(),
    // Cloudinary
    CLOUDINARY_CLOUD_NAME: zod_1.z.string().min(1, 'CLOUDINARY_CLOUD_NAME required'),
    CLOUDINARY_API_KEY: zod_1.z.string().min(1, 'CLOUDINARY_API_KEY required'),
    CLOUDINARY_API_SECRET: zod_1.z.string().min(1, 'CLOUDINARY_API_SECRET required'),
    // CORS / Client
    CLIENT_URL: zod_1.z.string().url().default('http://localhost:3000'),
    CORS_ALLOWED_ORIGINS: zod_1.z.string().optional(), // CSV list; optional if you just use CLIENT_URL
    // Rate limiting (global & auth)
    RATE_LIMIT_WINDOW_MS: zod_1.z.coerce.number().int().positive().default(15 * 60 * 1000),
    RATE_LIMIT_MAX: zod_1.z.coerce.number().int().positive().default(300),
    AUTH_RATE_LIMIT_MAX: zod_1.z.coerce.number().int().positive().default(60),
    // Misc
    LOG_LEVEL: zod_1.z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});
const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
    // Pretty print what failed
    console.error('\n❌ Invalid environment configuration:\n');
    for (const issue of parsed.error.issues) {
        console.error(` • ${issue.path.join('.')}: ${issue.message}`);
    }
    console.error('\nFix your .env and try again.');
    process.exit(1);
}
const env = parsed.data;
// Build derived config
const allowedOrigins = new Set([env.CLIENT_URL, ...csv(env.CORS_ALLOWED_ORIGINS)]);
exports.config = Object.freeze({
    env: env.NODE_ENV,
    isProd: env.NODE_ENV === 'production',
    isDev: env.NODE_ENV === 'development',
    port: env.PORT,
    db: {
        url: env.DATABASE_URL,
        // Use DIRECT_URL for Prisma Migrate when DATABASE_URL goes through a pooler
        directUrl: env.DIRECT_URL ?? env.DATABASE_URL,
    },
    jwt: {
        accessSecret: env.JWT_ACCESS_SECRET,
        refreshSecret: env.JWT_REFRESH_SECRET,
        accessExpiresIn: env.JWT_ACCESS_EXPIRES_IN, // string like '15m' or number (seconds)
        refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN, // string like '7d' or number (seconds)
    },
    redis: {
        url: env.REDIS_URL, // pass straight to ioredis (supports rediss:// for TLS)
    },
    cloudinary: {
        cloudName: env.CLOUDINARY_CLOUD_NAME,
        apiKey: env.CLOUDINARY_API_KEY,
        apiSecret: env.CLOUDINARY_API_SECRET,
        defaultFolder: 'basakhujo',
    },
    cors: {
        allowedOrigins: Array.from(allowedOrigins),
    },
    rateLimit: {
        windowMs: env.RATE_LIMIT_WINDOW_MS,
        max: env.RATE_LIMIT_MAX,
        authMax: env.AUTH_RATE_LIMIT_MAX,
    },
    logLevel: env.LOG_LEVEL,
});
