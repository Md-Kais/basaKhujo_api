import Redis from 'ioredis';

const url = process.env.REDIS_URL!;
if (!url) throw new Error('REDIS_URL missing');

export const redis = new Redis(url, {
  lazyConnect: true,
  enableAutoPipelining: true,
  maxRetriesPerRequest: 3,
  // IMPORTANT: no `tls` here for free plan
});

// (optional) quick visibility
redis.on('error', (e) => {
  const u = new URL(url);
  console.error('[redis] error', e?.message, { protocol: u.protocol, host: u.hostname, port: u.port });
});
