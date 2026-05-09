import { prisma } from '@/lib/prisma';
import { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken } from '@/lib/auth/jwt';
import type { User } from '@prisma/client';

export type SessionUser = Pick<
  User,
  | 'id'
  | 'publicId'
  | 'email'
  | 'name'
  | 'country'
  | 'avatarUrl'
  | 'age'
  | 'createdAt'
  | 'tokenVersion'
  | 'deletedAt'
>;

export async function issueTokenPair(user: User) {
  const accessToken = await signAccessToken({
    id: user.id,
    email: user.email,
    publicId: user.publicId,
    tokenVersion: user.tokenVersion,
  });
  const refreshToken = await signRefreshToken({
    id: user.id,
    tokenVersion: user.tokenVersion,
  });
  return { accessToken, refreshToken };
}

/**
 * Validates a refresh token signature and revokes/family checks against the database.
 * Returns new access + refresh JWTs (same tokenVersion until logout).
 */
export async function rotateSessionFromRefreshToken(refreshTokenStr: string) {
  const payload = await verifyRefreshToken(refreshTokenStr);
  const userId = Number(payload.sub);
  if (!Number.isFinite(userId)) {
    throw new Error('Invalid token subject');
  }

  const tv =
    typeof payload.tv === 'number'
      ? payload.tv
      : typeof payload.tv === 'string'
        ? Number(payload.tv)
        : NaN;
  if (!Number.isFinite(tv)) {
    throw new Error('Invalid token version');
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.deletedAt) {
    throw new Error('User not available');
  }
  if (user.tokenVersion !== tv) {
    throw new Error('Session revoked');
  }

  const tokens = await issueTokenPair(user);
  return { user, ...tokens };
}

export async function loadUserFromAccessToken(accessTokenStr: string) {
  const payload = await verifyAccessToken(accessTokenStr);
  const userId = Number(payload.sub);
  if (!Number.isFinite(userId)) {
    throw new Error('Invalid token subject');
  }

  const tv =
    typeof payload.tv === 'number'
      ? payload.tv
      : typeof payload.tv === 'string'
        ? Number(payload.tv)
        : NaN;
  if (!Number.isFinite(tv)) {
    throw new Error('Invalid token version');
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.deletedAt) {
    throw new Error('User not available');
  }
  if (user.tokenVersion !== tv) {
    throw new Error('Session revoked');
  }

  return user;
}
