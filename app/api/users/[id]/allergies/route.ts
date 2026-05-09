import { ensureApiTables, sql } from '../../../_lib/db';
import { badRequest, ok, parseId } from '../../../_lib/http';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  await ensureApiTables();
  const userId = parseId(params.id);
  if (!userId) return badRequest('invalid user id');
  const rows = await sql`SELECT id, name FROM user_allergies WHERE user_id = ${userId} ORDER BY id DESC`;
  return ok(rows);
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  await ensureApiTables();
  const userId = parseId(params.id);
  const body = await req.json().catch(() => null);
  if (!userId) return badRequest('invalid user id');
  if (!body?.name) return badRequest('name required');
  const inserted = await sql`
    INSERT INTO user_allergies (user_id, name)
    VALUES (${userId}, ${body.name})
    RETURNING id, name
  `;
  return ok(inserted[0], 201);
}
