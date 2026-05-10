import { NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/proxy';

/**
 * Mutations on shared product catalog:
 * - If `INTERNAL_API_KEY` is set, require `Authorization: Bearer <key>` (server-to-server).
 * - Otherwise require an authenticated user session (blocks anonymous catalog poisoning).
 */
export async function gateCatalogWrite(req: Request): Promise<NextResponse | null> {
  const secret = process.env.INTERNAL_API_KEY?.trim();
  if (secret) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return null;
  }

  const session = await authenticateRequest(req);
  if (!session.ok) {
    return session.response;
  }
  return null;
}
