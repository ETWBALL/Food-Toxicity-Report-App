// Reserved for Scans orchestration (POST /api/users/:id/scans) in PR #2.
// Products + Recalls in PR #1 do not require user-scoped auth.
import { NextResponse } from 'next/server';
import { auth } from '../../auth';

export type AuthResult =
  | { ok: true; userId: number }
  | { ok: false; response: NextResponse };

function unauthorized(reason: string): NextResponse {
  return NextResponse.json({ error: 'Unauthorized', reason }, { status: 401 });
}

function forbidden(): NextResponse {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

export async function requireUserMatch(paramId: number): Promise<AuthResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, response: unauthorized('no session') };

  const rawId = (session.user as { id?: string | number }).id;
  if (rawId === undefined || rawId === null) {
    return {
      ok: false,
      response: unauthorized('session.user.id missing — NextAuth session callback must expose user.id'),
    };
  }
  const sessionUserId = typeof rawId === 'string' ? Number.parseInt(rawId, 10) : rawId;
  if (!Number.isFinite(sessionUserId)) return { ok: false, response: unauthorized('invalid session id') };
  if (sessionUserId !== paramId) return { ok: false, response: forbidden() };

  return { ok: true, userId: sessionUserId };
}
