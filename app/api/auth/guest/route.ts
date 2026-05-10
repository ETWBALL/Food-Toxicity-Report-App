/**
 * POST /api/auth/guest
 *
 * Creates an ephemeral guest user (unique `@guest.local` email), issues JWTs, and sets cookies — no request body.
 *
 * Success `201`: `{ success: true, guest: true, accessToken, refreshToken, user }`
 *
 * Use this for try-before-register flows; guest rows are normal `User` records in the database.
 */
import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { applyAuthCookies } from '@/lib/auth/cookies';
import { hashPassword } from '@/lib/auth/password';
import { prisma } from '@/lib/prisma';
import { issueTokenPair } from '@/lib/auth/session';
import { serializeUser } from '@/lib/auth/proxy';

export async function POST() {
  const guestEmail = `guest_${Date.now()}_${randomUUID().slice(0, 8)}@guest.local`;
  const passwordHash = hashPassword(randomUUID());

  const user = await prisma.user.create({
    data: {
      publicId: randomUUID(),
      email: guestEmail,
      name: 'Guest',
      passwordHash,
    },
  });

  const tokens = await issueTokenPair(user);
  const res = NextResponse.json(
    {
      success: true,
      guest: true,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: serializeUser(user),
    },
    { status: 201 },
  );
  applyAuthCookies(res, tokens);
  return res;
}
