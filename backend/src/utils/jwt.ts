import crypto from 'crypto';
import { config } from '../config/env';
import { UnauthorizedError } from './errors';
import { UserRole } from '../domain/types';

export interface TokenPayload {
  userId: string;
  role: UserRole;
  isVerified?: boolean;
  tokenId?: string;
  family?: string;
  iat?: number;
  exp?: number;
}


const base64UrlEncode = (str: string): string => {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
};

const base64UrlDecode = (str: string): string => {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
};

/**
 * Signs an HS256 JWT token with expiration.
 */
export const signToken = (
  payload: Omit<TokenPayload, 'iat' | 'exp'>,
  secret: string,
  expiresInSeconds: number
): string => {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: TokenPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const dataToSign = `${encodedHeader}.${encodedPayload}`;

  const signature = crypto
    .createHmac('sha256', secret)
    .update(dataToSign)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${dataToSign}.${signature}`;
};

/**
 * Verifies an HS256 JWT token, ensuring signature validity and checking expiry.
 */
export const verifyToken = (token: string, secret: string): TokenPayload => {
  if (!token || typeof token !== 'string') {
    throw new UnauthorizedError('Authentication token is required');
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new UnauthorizedError('Malformed authentication token');
  }

  const [encodedHeader, encodedPayload, signature] = parts;
  const dataToSign = `${encodedHeader}.${encodedPayload}`;

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(dataToSign)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    sigBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(sigBuffer, expectedBuffer)
  ) {
    throw new UnauthorizedError('Invalid token signature');
  }

  try {
    const payload: TokenPayload = JSON.parse(base64UrlDecode(encodedPayload));
    const now = Math.floor(Date.now() / 1000);

    if (payload.exp && payload.exp < now) {
      throw new UnauthorizedError('Authentication token has expired');
    }

    return payload;
  } catch (err: any) {
    if (err instanceof UnauthorizedError) {
      throw err;
    }
    throw new UnauthorizedError('Invalid token payload');
  }
};

// Token lifetimes: 7 days in development/local test mode, 1 hour in production
export const ACCESS_TOKEN_EXPIRY_SECONDS =
  config.NODE_ENV === 'production' ? 60 * 60 : 7 * 24 * 60 * 60;
// Refresh token lifetime: 7 days in production, 30 days in development
export const REFRESH_TOKEN_EXPIRY_SECONDS =
  config.NODE_ENV === 'production' ? 7 * 24 * 60 * 60 : 30 * 24 * 60 * 60;

export const signAccessToken = (payload: Omit<TokenPayload, 'iat' | 'exp'>): string => {
  return signToken(payload, config.JWT_ACCESS_SECRET, ACCESS_TOKEN_EXPIRY_SECONDS);
};

export const signRefreshToken = (payload: Omit<TokenPayload, 'iat' | 'exp'>): string => {
  return signToken(payload, config.JWT_REFRESH_SECRET, REFRESH_TOKEN_EXPIRY_SECONDS);
};

export const verifyAccessToken = (token: string): TokenPayload => {
  return verifyToken(token, config.JWT_ACCESS_SECRET);
};

export const verifyRefreshToken = (token: string): TokenPayload => {
  return verifyToken(token, config.JWT_REFRESH_SECRET);
};
