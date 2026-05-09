import { createUser, getUser } from 'app/db';
import { badRequest, ok } from '../../_lib/http';

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body?.email || !body?.password) return badRequest('email and password required');
  const existing = await getUser(body.email);
  if (existing.length) return badRequest('email already registered');
  await createUser(body.email, body.password);
  return ok({ success: true }, 201);
}
