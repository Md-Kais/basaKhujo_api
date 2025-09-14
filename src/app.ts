import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import hpp from 'hpp';
import compression from 'compression';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';

import router from './routes';
import { rateLimiter } from './middlewares/rateLimiter';
import { notFound, errorHandler } from './middlewares/error';
import { prisma } from './db/prisma';
import { redis } from './db/redis';

const app = express();

// If you run behind a proxy (Render/Koyeb/etc.) and use rate limit / secure cookies:
app.set('trust proxy', 1);

// --- Core middleware (order matters) ---
app.use(helmet()); // security headers first. :contentReference[oaicite:1]{index=1}
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(hpp());             // protect against HTTP param pollution. :contentReference[oaicite:2]{index=2}
app.use(compression());     // gzip responses. :contentReference[oaicite:3]{index=3}
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

// CORS (allow multiple origins via comma-separated env)
const corsOrigins = (process.env.CORS_ORIGIN ?? process.env.CLIENT_URL ?? '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
app.use(cors({ origin: corsOrigins.length ? corsOrigins : true, credentials: true })); // :contentReference[oaicite:4]{index=4}

// --- Liveness & Readiness ---
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

app.get('/ready', async (_req, res) => {
  const checks: Record<string, 'up' | 'down'> = { db: 'down', redis: 'down' };
  try { await prisma.$queryRaw`SELECT 1`; checks.db = 'up'; } catch {}
  try { const pong = await redis.ping(); checks.redis = pong === 'PONG' ? 'up' : 'down'; } catch {}
  const allUp = Object.values(checks).every(v => v === 'up');
  res.status(allUp ? 200 : 503).json({ status: allUp ? 'ready' : 'not_ready', checks });
});

// --- API routes (wrap with rate limiter once) ---
app.use('/api', rateLimiter, router); // rate limit before your routes. :contentReference[oaicite:5]{index=5}

// --- 404 then error handler (must be last) ---
app.use(notFound);
app.use(errorHandler);

export default app;
