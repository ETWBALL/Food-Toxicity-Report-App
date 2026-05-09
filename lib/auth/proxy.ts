import { NextResponse } from 'next/server';
import { applyAuthCookies, readTokensFromRequest, type CookiePair } from '@/lib/auth/cookies';
import { loadUserFromAccessToken, rotateSessionFromRefreshToken } from '@/lib/auth/session';
import type { User } from '@prisma/client';

export type { SessionUser } from '@/lib/auth/session';

function publicUser(u: User) {
  return {
    id: u.id,
    publicId: u.publicId,
    email: u.email,
    name: u.name,
    country: u.country,
    avatarUrl: u.avatarUrl,
    age: u.age,
    createdAt: u.createdAt,
  };
}

export type AuthContext = {
  user: User;
  /** New cookies to apply when the access token was renewed via refresh */
  renewedCookies?: CookiePair;
};

/**
 * Resolves the current user from cookies: valid access token, or refresh rotation.
 * Use in Route Handlers; merge `renewedCookies` onto your JSON response when present.
 */
export async function authenticateRequest(req: Request): Promise<
  | { ok: true; auth: AuthContext }
  | { ok: false; response: NextResponse }
> {
  const { access, refresh } = readTokensFromRequest(req);

  if (access) {
    try {
      const user = await loadUserFromAccessToken(access);
      return { ok: true, auth: { user } };
    } catch {
      // fall through to refresh
    }
  }

  if (refresh) {
    try {
      const rotated = await rotateSessionFromRefreshToken(refresh);
      return {
        ok: true,
        auth: {
          user: rotated.user,
          renewedCookies: {
            accessToken: rotated.accessToken,
            refreshToken: rotated.refreshToken,
          },
        },
      };
    } catch {
      return {
        ok: false,
        response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      };
    }
  }

  return {
    ok: false,
    response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
  };
}

/** Requires auth; attaches refreshed cookies to the JSON response when rotation occurred. */
export async function requireAuth(
  req: Request,
  buildResponse: (user: User) => NextResponse | Promise<NextResponse>,
): Promise<NextResponse> {
  const result = await authenticateRequest(req);
  if (!result.ok) {
    return result.response;
  }

  let res = await buildResponse(result.auth.user);
  if (result.auth.renewedCookies) {
    res = applyAuthCookies(res, result.auth.renewedCookies);
  }
  return res;
}

export function serializeUser(u: User) {
  return publicUser(u);
}
