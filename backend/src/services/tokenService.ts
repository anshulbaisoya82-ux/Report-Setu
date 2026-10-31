import crypto from 'crypto';
import { prisma } from '../config/prisma';
import { UserRole } from '../generated/prisma/client';
import { signAccessToken, signRefreshToken, verifyRefreshToken, REFRESH_TOKEN_EXPIRY_SECONDS } from '../utils/jwt';
import { config } from '../config/env';
import { UnauthorizedError } from '../utils/errors';
import { recordAudit } from './auditService';
import { logger } from '../utils/logger';

export const hashRefreshToken = (token: string): string =>
  crypto.createHmac('sha256', config.JWT_REFRESH_SECRET).update(token).digest('hex');

export interface TokenSessionResult { accessToken: string; refreshToken: string; family: string }

export const createRefreshTokenSession = async (
  userId: string, role: UserRole, isVerified = false, existingFamily?: string
): Promise<TokenSessionResult> => {
  const family = existingFamily || crypto.randomUUID();
  const tokenId = crypto.randomUUID();
  const accessToken = signAccessToken({ userId, role: role as any, isVerified });
  const refreshToken = signRefreshToken({ userId, role: role as any, isVerified, tokenId, family });
  await prisma.refreshToken.create({
    data: { userId, tokenId, family, tokenHash: hashRefreshToken(refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_SECONDS * 1000) },
  });
  return { accessToken, refreshToken, family };
};

export interface RotateTokenResult {
  accessToken: string; refreshToken: string; userId: string; role: UserRole; isVerified?: boolean;
}

export const rotateRefreshToken = async (rawToken: string, ipAddress = '127.0.0.1'): Promise<RotateTokenResult> => {
  if (!rawToken || typeof rawToken !== 'string') throw new UnauthorizedError('Refresh token is required');
  const payload = verifyRefreshToken(rawToken);
  if (!payload.family || !payload.tokenId) throw new UnauthorizedError('Legacy or malformed refresh token. Please log in again.');
  const tokenRecord = await prisma.refreshToken.findFirst({ where: { tokenHash: hashRefreshToken(rawToken) } });
  if (!tokenRecord || tokenRecord.isRevoked || tokenRecord.expiresAt <= new Date()) {
    logger.warn({ type: 'refresh_token_reuse_detected', userId: payload.userId, family: payload.family, ipAddress });
    await prisma.refreshToken.updateMany({ where: { family: payload.family }, data: { isRevoked: true } });
    recordAudit({ userId: payload.userId, userRole: payload.role, action: 'AUTH_FAILED', resourceType: 'RefreshToken', purpose: 'REFRESH_TOKEN_REUSE_DETECTED', ipAddress });
    throw new UnauthorizedError('Invalid refresh token. Token reuse detected; all sessions in this family have been terminated.');
  }
  await prisma.refreshToken.update({ where: { id: tokenRecord.id }, data: { isRevoked: true } });
  const session = await createRefreshTokenSession(payload.userId, payload.role, payload.isVerified, payload.family);
  recordAudit({ userId: payload.userId, userRole: payload.role, action: 'AUTH_LOGIN', resourceType: 'RefreshToken', resourceId: tokenRecord.id, purpose: 'REFRESH_TOKEN_ROTATED', ipAddress });
  return { ...session, userId: payload.userId, role: payload.role as UserRole, isVerified: payload.isVerified };
};

export const revokeRefreshToken = async (rawToken?: string, ipAddress = '127.0.0.1'): Promise<void> => {
  if (!rawToken || typeof rawToken !== 'string') return;
  try {
    const record = await prisma.refreshToken.findFirst({ where: { tokenHash: hashRefreshToken(rawToken) } });
    if (record) {
      await prisma.refreshToken.update({ where: { id: record.id }, data: { isRevoked: true } });
      recordAudit({ userId: record.userId, userRole: 'anonymous', action: 'AUTH_LOGOUT', resourceType: 'RefreshToken', resourceId: record.id, purpose: 'SESSION_LOGOUT', ipAddress });
    }
  } catch (err) { logger.warn({ message: 'Error during refresh token revocation', error: (err as Error).message }); }
};

export const revokeAllUserSessions = async (userId: string, ipAddress = '127.0.0.1'): Promise<number> => {
  const result = await prisma.refreshToken.updateMany({ where: { userId, isRevoked: false }, data: { isRevoked: true } });
  recordAudit({ userId, userRole: 'anonymous', action: 'AUTH_LOGOUT', resourceType: 'RefreshToken', purpose: 'LOGOUT_ALL_DEVICES', ipAddress });
  return result.count;
};
