/**
 * POST /api/auth/refresh
 *
 * Rotates the session using a refresh token (from httpOnly cookie or body).
 *
 * Body (optional JSON): `{ "refreshToken"?: string }` — if omitted, uses `refresh` from cookies (`readTokensFromRequest`).
 *
 * Success `200`: `{ ok: true, accessToken, refreshToken, user }` + updated cookies.
 *
 * Errors: `401` missing refresh token or invalid/expired token.
 */
import { NextResponse } from 'next/server';
import { applyAuthCookies, readTokensFromRequest } from '@/lib/auth/cookies';
import { rotateSessionFromRefreshToken } from '@/lib/auth/session';
import { serializeUser } from '@/lib/auth/proxy';

export async function POST(req: Request) {
  const { refresh } = readTokensFromRequest(req);

  let bodyRefresh: string | undefined;
  try {
    const body: unknown = await req.json();
    if (
      body &&
      typeof body === 'object' &&
      'refreshToken' in body &&
      typeof (body as { refreshToken: unknown }).refreshToken === 'string'
    ) {
      bodyRefresh = (body as { refreshToken: string }).refreshToken;
    }
  } catch {
    /* optional JSON body */
  }

  const token = refresh ?? bodyRefresh;
  if (!token) {
    return NextResponse.json({ error: 'Refresh token required' }, { status: 401 });
  }

  try {
    const session = await rotateSessionFromRefreshToken(token);
    const res = NextResponse.json({
      ok: true,
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      user: serializeUser(session.user),
    });
    applyAuthCookies(res, {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
    });
    return res;
  } catch {
    return NextResponse.json({ error: 'Invalid or expired refresh token' }, { status: 401 });
  }
}
