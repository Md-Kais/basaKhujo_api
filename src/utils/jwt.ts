import * as jwt from 'jsonwebtoken';
import { config } from '../config';

// ---- Domain types (align with your Prisma Role enum) ----
export type Role = 'TENANT' | 'LANDLORD' | 'ADMIN';

export interface AccessPayload extends jwt.JwtPayload {
  id: string;
  role: Role;
}

// ---- Secrets & expirations (as you had) ----
const ACCESS_SECRET: jwt.Secret  = config.jwt.accessSecret as jwt.Secret;
const REFRESH_SECRET: jwt.Secret = config.jwt.refreshSecret as jwt.Secret;

const ACCESS_EXPIRES: jwt.SignOptions['expiresIn']  =
  config.jwt.accessExpiresIn as jwt.SignOptions['expiresIn'];
const REFRESH_EXPIRES: jwt.SignOptions['expiresIn'] =
  config.jwt.refreshExpiresIn as jwt.SignOptions['expiresIn'];

// ---- User-defined type guard to narrow jsonwebtoken's union return ----
function isAccessPayload(p: string | jwt.JwtPayload): p is AccessPayload {
  return typeof p !== 'string'
    && typeof (p as any).id === 'string'
    && typeof (p as any).role === 'string';
}

// ---- Sign helpers (compatible with your current call sites) ----
// Tip: only sign the fields you actually need in the token.
export function signAccess(payload: { id: string; role: Role } | object): string {
  const { id, role } = payload as any;
  const options: jwt.SignOptions = { expiresIn: ACCESS_EXPIRES };
  return jwt.sign({ id, role }, ACCESS_SECRET, options);
}

export function signRefresh(payload: { id: string; role: Role } | object): string {
  const { id, role } = payload as any;
  const options: jwt.SignOptions = { expiresIn: REFRESH_EXPIRES };
  return jwt.sign({ id, role }, REFRESH_SECRET, options);
}

// ---- Verify helpers now return a strongly-typed payload ----
export function verifyAccess(token: string): AccessPayload {
  const decoded = jwt.verify(token, ACCESS_SECRET); // string | JwtPayload
  if (!isAccessPayload(decoded)) throw new Error('Invalid access token payload');
  return decoded;
}

export function verifyRefresh(token: string): AccessPayload {
  const decoded = jwt.verify(token, REFRESH_SECRET); // string | JwtPayload
  if (!isAccessPayload(decoded)) throw new Error('Invalid refresh token payload');
  return decoded;
}
