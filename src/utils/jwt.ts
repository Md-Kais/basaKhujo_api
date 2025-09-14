import * as jwt from 'jsonwebtoken';
import { config } from '../config';

// Normalize secrets so they’re never undefined
const ACCESS_SECRET: jwt.Secret  = config.jwt.accessSecret as jwt.Secret;
const REFRESH_SECRET: jwt.Secret = config.jwt.refreshSecret as jwt.Secret;

// Normalize expires to the exact type accepted by jsonwebtoken@9
const ACCESS_EXPIRES: jwt.SignOptions['expiresIn']  =
  config.jwt.accessExpiresIn as jwt.SignOptions['expiresIn'];
const REFRESH_EXPIRES: jwt.SignOptions['expiresIn'] =
  config.jwt.refreshExpiresIn as jwt.SignOptions['expiresIn'];

export function signAccess(payload: object): string {
  const options: jwt.SignOptions = { expiresIn: ACCESS_EXPIRES };
  return jwt.sign(payload, ACCESS_SECRET, options);
}

export function signRefresh(payload: object): string {
  const options: jwt.SignOptions = { expiresIn: REFRESH_EXPIRES };
  return jwt.sign(payload, REFRESH_SECRET, options);
}

export function verifyAccess(token: string) {
  return jwt.verify(token, ACCESS_SECRET);
}

export function verifyRefresh(token: string) {
  return jwt.verify(token, REFRESH_SECRET);
}
