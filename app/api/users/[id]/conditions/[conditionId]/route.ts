import { ensureApiTables, sql } from '../../../../_lib/db';
import { badRequest, ok, parseId } from '../../../../_lib/http';

export async function PUT(req: Request, { params }: { params: { id: string; conditionId: string } }) {
  await ensureApiTables();
  const userId = parseId(params.id);
  const conditionId = parseId(params.conditionId);
  const body = await req.json().catch(() => null);
  if (!userId || !conditionId) return badRequest('invalid id');
  if (!body?.name) return badRequest('name required');
  await sql`
    UPDATE user_conditions
    SET name = ${body.name}
    WHERE id = ${conditionId} AND user_id = ${userId}
  `;
  return ok({ success: true });
}

export async function DELETE(_: Request, { params }: { params: { id: string; conditionId: string } }) {
  await ensureApiTables();
  const userId = parseId(params.id);
  const conditionId = parseId(params.conditionId);
  if (!userId || !conditionId) return badRequest('invalid id');
  await sql`DELETE FROM user_conditions WHERE id = ${conditionId} AND user_id = ${userId}`;
  return ok({ success: true });
}
