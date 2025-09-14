import { redis } from '../db/redis';

export async function cached<T>(key: string, ttlSec: number, fetcher: () => Promise<T>): Promise<T> {
  const hit = await redis.get(key);
  if (hit) return JSON.parse(hit);
  const data = await fetcher();
  await redis.set(key, JSON.stringify(data), 'EX', ttlSec);
  return data;
}

export async function invalidate(pattern: string) {
  // naive invalidation for Redis Cloud (scan + del)
  const stream = redis.scanStream({ match: pattern });
  const keys: string[] = [];
  for await (const chunk of stream) keys.push(...chunk);
  if (keys.length) await redis.del(...keys);
}
