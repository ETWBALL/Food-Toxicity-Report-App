import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { applyAuthCookies } from '@/lib/auth/cookies';
import { hashPassword } from '@/lib/auth/password';
import { prisma } from '@/lib/prisma';
import { issueTokenPair } from '@/lib/auth/session';
import { serializeUser } from '@/lib/auth/proxy';
import { registerBodySchema } from '@/lib/validation/auth';
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

  const parsed = registerBodySchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error.issues);
  }

  const email = normalizeEmail(parsed.data.email);
  const { password, name } = parsed.data;
  const displayName = name?.trim() || email.split('@')[0] || 'User';

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return badRequest('Email already registered');
  }

  const passwordHash = hashPassword(password);

  const user = await prisma.user.create({
    data: {
      publicId: randomUUID(),
      email,
      name: displayName,
      passwordHash,
    },
  });

  const tokens = await issueTokenPair(user);
  const res = NextResponse.json(
    {
      success: true,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: serializeUser(user),
    },
    { status: 201 },
  );
  applyAuthCookies(res, tokens);
  return res;
}
