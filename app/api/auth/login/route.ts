import { NextResponse } from 'next/server';
import { applyAuthCookies } from '@/lib/auth/cookies';
import { verifyPassword } from '@/lib/auth/password';
import { prisma } from '@/lib/prisma';
import { issueTokenPair } from '@/lib/auth/session';
import { serializeUser } from '@/lib/auth/proxy';
import { loginBodySchema } from '@/lib/validation/auth';
import { badRequest, validationError } from '../../_lib/http';

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest('Invalid JSON body');
  }

  const parsed = loginBodySchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error.issues);
  }

  const email = normalizeEmail(parsed.data.email);
  const { password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.deletedAt) {
    return badRequest('Invalid credentials');
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return badRequest('Invalid credentials');
  }

  const tokens = await issueTokenPair(user);
  const res = NextResponse.json({
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    user: serializeUser(user),
  });
  applyAuthCookies(res, tokens);
  return res;
}
