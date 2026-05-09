import { compare } from 'bcrypt-ts';
import { getUser } from 'app/db';
import { badRequest, ok } from '../../_lib/http';

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body?.email || !body?.password) return badRequest('email and password required');
  const users = await getUser(body.email);
  if (!users.length) return badRequest('invalid credentials');
  const valid = await compare(body.password, users[0].password || '');
  if (!valid) return badRequest('invalid credentials');
  return ok({ success: true, user: { id: users[0].id, email: users[0].email } });
}
