import { NextResponse } from 'next/server';
import { clearAuthCookies } from '@/lib/auth/cookies';
import { resolveUserIdForLogout } from '@/lib/auth/logout';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  let redirectPath = '/';
  try {
    const body = (await req.json()) as { redirect?: unknown };
    if (typeof body.redirect === 'string' && body.redirect.startsWith('/')) {
      redirectPath = body.redirect;
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
