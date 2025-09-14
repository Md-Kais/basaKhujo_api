import dotenv from 'dotenv';
dotenv.config();

import { z } from 'zod';

// Reusable helpers
const duration = z.union([
  z.number().int().positive(),
  z.string().regex(/^\d+(ms|s|m|h|d)$/i, 'Use 15m, 7d, 900s, etc.')
]);

const csv = (val?: string) =>
  (val ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

// ---- Zod schema for env ----
const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),

  // Database (Neon + Prisma)
  DATABASE_URL: z.string().url({ message: 'DATABASE_URL must be a valid URL' }),
  DIRECT_URL: z.string().url().optional(), // recommended when using a pooler

  // JWT
  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET is required (>=16 chars)'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET is required (>=16 chars)'),
  JWT_ACCESS_EXPIRES_IN: duration.default('15m'),
  JWT_REFRESH_EXPIRES_IN: duration.default('7d'),

  // Redis (either Redis Cloud rediss:// or Upstash etc.)
  REDIS_URL: z.string().url().optional(),

  // Cloudinary
  CLOUDINARY_CLOUD_NAME: z.string().min(1, 'CLOUDINARY_CLOUD_NAME required'),
  CLOUDINARY_API_KEY: z.string().min(1, 'CLOUDINARY_API_KEY required'),
  CLOUDINARY_API_SECRET: z.string().min(1, 'CLOUDINARY_API_SECRET required'),

  // CORS / Client
  CLIENT_URL: z.string().url().default('http://localhost:3000'),
  CORS_ALLOWED_ORIGINS: z.string().optional(), // CSV list; optional if you just use CLIENT_URL

  // Rate limiting (global & auth)
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(60),

  // Misc
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  // Pretty print what failed
  console.error('\n❌ Invalid environment configuration:\n');
  for (const issue of parsed.error.issues) {
    console.error(
      ` • ${issue.path.join('.')}: ${issue.message}`
    );
  }
  console.error('\nFix your .env and try again.');
  process.exit(1);
}

const env = parsed.data;

// Build derived config
const allowedOrigins = new Set<string>([env.CLIENT_URL, ...csv(env.CORS_ALLOWED_ORIGINS)]);

export const config = Object.freeze({
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
    accessExpiresIn: env.JWT_ACCESS_EXPIRES_IN,   // string like '15m' or number (seconds)
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

export type AppConfig = typeof config;
