"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redis = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const url = process.env.REDIS_URL;
if (!url)
    throw new Error('REDIS_URL missing');
exports.redis = new ioredis_1.default(url, {
    lazyConnect: true,
    enableAutoPipelining: true,
    maxRetriesPerRequest: 3,
    // IMPORTANT: no `tls` here for free plan
});
// (optional) quick visibility
exports.redis.on('error', (e) => {
    const u = new URL(url);
    console.error('[redis] error', e?.message, { protocol: u.protocol, host: u.hostname, port: u.port });
});
