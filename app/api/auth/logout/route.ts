/**
 * POST /api/auth/logout
 *
 * Increments the caller’s `tokenVersion` (invalidates refresh/access families), clears auth cookies, and redirects.
 *
 * Body (optional JSON): `{ "redirect"?: string }` — path only; open redirects are rejected by `safeAppRedirectPath` (defaults to `/`).
 *
 * Success: `302` redirect to the safe path with cookies cleared.
 *
 * Works best when the browser sends the session cookie; unauthenticated calls still clear cookies.
 */
import { NextResponse } from 'next/server';
import { clearAuthCookies } from '@/lib/auth/cookies';
import { resolveUserIdForLogout } from '@/lib/auth/logout';
import { safeAppRedirectPath } from '@/lib/auth/safe-redirect';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  let redirectPath = '/';
  try {
    const body = (await req.json()) as { redirect?: unknown };
    if (typeof body.redirect === 'string') {
      const safe = safeAppRedirectPath(body.redirect);
      if (safe) redirectPath = safe;
    }
  } catch {
    /* body optional */
  }

  const uid = await resolveUserIdForLogout(req);
  if (uid != null) {
    await prisma.user.update({
      where: { id: uid },
      data: { tokenVersion: { increment: 1 } },
    });
  }

  const res = NextResponse.redirect(new URL(redirectPath, req.url));
  clearAuthCookies(res);
  return res;
}
