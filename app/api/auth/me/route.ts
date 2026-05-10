/**
 * GET /api/auth/me
 *
 * Returns the currently authenticated user's profile.
 * 401 if not authenticated.
 */
import { requireAuth, serializeUser } from '@/lib/auth/proxy';

export async function GET(req: Request) {
  return requireAuth(req, async (caller) => {
    const { NextResponse } = await import('next/server');
    return NextResponse.json(serializeUser(caller));
  });
}
