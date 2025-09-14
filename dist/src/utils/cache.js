"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cached = cached;
exports.invalidate = invalidate;
const redis_1 = require("../db/redis");
async function cached(key, ttlSec, fetcher) {
    const hit = await redis_1.redis.get(key);
    if (hit)
        return JSON.parse(hit);
    const data = await fetcher();
    await redis_1.redis.set(key, JSON.stringify(data), 'EX', ttlSec);
    return data;
}
async function invalidate(pattern) {
    // naive invalidation for Redis Cloud (scan + del)
    const stream = redis_1.redis.scanStream({ match: pattern });
    const keys = [];
    for await (const chunk of stream)
        keys.push(...chunk);
    if (keys.length)
        await redis_1.redis.del(...keys);
}
