import { ok } from '../../_lib/http';

export async function POST() {
  return ok({
    success: true,
    message: 'Use NextAuth signOut() on client/session flow',
  });
}
