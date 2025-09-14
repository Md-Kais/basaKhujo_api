import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Missing token' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET!);
    (req as any).user = decoded;
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid token' });
  }
}

export const requireRole = (...roles: string[]) =>
  (req: any, res: any, next: any) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    next();
  };
