// requireAuth.ts
import { verifyAccess } from '../utils/jwt';
import type { Request, Response, NextFunction } from 'express';

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Missing Authorization header' });

  try {
    const payload = verifyAccess(token); // typed: { id, role, iat, exp }
    (req as any).user = { id: payload.id, role: payload.role };
    return next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}
