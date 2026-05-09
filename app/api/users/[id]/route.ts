import { ensureApiTables, sql } from '../../_lib/db';
import { badRequest, notFound, ok, parseId } from '../../_lib/http';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  await ensureApiTables();
  const userId = parseId(params.id);
  if (!userId) return badRequest('invalid user id');
  const rows = await sql`
    SELECT u.id, u.email, p.dietary_restrictions
    FROM "User" u
    LEFT JOIN "UserProfile" p ON p.user_id = u.id
    WHERE u.id = ${userId}
  `;
  if (!rows.length) return notFound('user not found');
  return ok(rows[0]);
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  await ensureApiTables();
  const userId = parseId(params.id);
  if (!userId) return badRequest('invalid user id');
  const body = await req.json().catch(() => null);
  if (!body) return badRequest('invalid body');

  if (body.email) {
    await sql`UPDATE "User" SET email = ${body.email} WHERE id = ${userId}`;
  }

  if (body.dietaryRestrictions) {
    await sql`
      INSERT INTO "UserProfile" (user_id, dietary_restrictions)
      VALUES (${userId}, ${JSON.stringify(body.dietaryRestrictions)}::jsonb)
      ON CONFLICT (user_id)
      DO UPDATE SET dietary_restrictions = EXCLUDED.dietary_restrictions
    `;
  }

  return ok({ success: true });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  await ensureApiTables();
  const userId = parseId(params.id);
  if (!userId) return badRequest('invalid user id');
  await sql`DELETE FROM "User" WHERE id = ${userId}`;
  return ok({ success: true });
}
