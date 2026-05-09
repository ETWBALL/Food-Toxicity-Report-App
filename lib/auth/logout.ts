import { verifyRefreshToken } from '@/lib/auth/jwt';
import { prisma } from '@/lib/prisma';
import { loadUserFromAccessToken } from '@/lib/auth/session';
import { readTokensFromRequest } from '@/lib/auth/cookies';

/**
 * Identifies the signed-in user for logout revocation without issuing new tokens.
 * Accepts a valid access token or refresh token (signature + tv match).
 */
export async function resolveUserIdForLogout(req: Request): Promise<number | null> {
  const { access, refresh } = readTokensFromRequest(req);

  if (access) {
    try {
      const user = await loadUserFromAccessToken(access);
      return user.id;
    } catch {
      // expired / revoked — try refresh
    }
  }

  if (refresh) {
    try {
      const payload = await verifyRefreshToken(refresh);
      const userId = Number(payload.sub);
      const tv =
        typeof payload.tv === 'number'
          ? payload.tv
          : typeof payload.tv === 'string'
            ? Number(payload.tv)
            : NaN;
      if (!Number.isFinite(userId) || !Number.isFinite(tv)) return null;

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user || user.deletedAt || user.tokenVersion !== tv) return null;
      return user.id;
    } catch {
      return null;
    }
  }

  return null;
}
