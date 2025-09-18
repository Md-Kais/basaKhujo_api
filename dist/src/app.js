"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const hpp_1 = __importDefault(require("hpp"));
const compression_1 = __importDefault(require("compression"));
const morgan_1 = __importDefault(require("morgan"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const routes_1 = __importDefault(require("./routes"));
const rateLimiter_1 = require("./middlewares/rateLimiter");
const error_1 = require("./middlewares/error");
const prisma_1 = require("./db/prisma");
const redis_1 = require("./db/redis");
const app = (0, express_1.default)();
// If you run behind a proxy (Render/Koyeb/etc.) and use rate limit / secure cookies:
app.set('trust proxy', 1);
// --- Core middleware (order matters) ---
app.use((0, helmet_1.default)()); // security headers first. :contentReference[oaicite:1]{index=1}
app.use((0, morgan_1.default)(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use((0, hpp_1.default)()); // protect against HTTP param pollution. :contentReference[oaicite:2]{index=2}
app.use((0, compression_1.default)()); // gzip responses. :contentReference[oaicite:3]{index=3}
app.use(express_1.default.json({ limit: '2mb' }));
app.use((0, cookie_parser_1.default)());
// CORS (allow multiple origins via comma-separated env)
const corsOrigins = (process.env.CORS_ORIGIN ?? process.env.CLIENT_URL ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
app.use((0, cors_1.default)({ origin: corsOrigins.length ? corsOrigins : true, credentials: true })); // :contentReference[oaicite:4]{index=4}
// --- Liveness & Readiness ---
app.get(['/health', '/api/health'], (_req, res) => {
    res.status(200).json({
        status: 'ok',
        uptime: Math.round(process.uptime()),
        env: process.env.NODE_ENV || 'dev',
        timestamp: new Date().toISOString(),
    });
});
app.get('/ready', async (_req, res) => {
    const checks = { db: 'down', redis: 'down' };
    try {
        await prisma_1.prisma.$queryRaw `SELECT 1`;
        checks.db = 'up';
    }
    catch { }
    try {
        const pong = await redis_1.redis.ping();
        checks.redis = pong === 'PONG' ? 'up' : 'down';
    }
    catch { }
    const allUp = Object.values(checks).every(v => v === 'up');
    res.status(allUp ? 200 : 503).json({ status: allUp ? 'ready' : 'not_ready', checks });
});
// --- API routes (wrap with rate limiter once) ---
app.use('/api', rateLimiter_1.rateLimiter, routes_1.default); // rate limit before your routes. :contentReference[oaicite:5]{index=5}
// --- 404 then error handler (must be last) ---
app.use(error_1.notFound);
app.use(error_1.errorHandler);
exports.default = app;
