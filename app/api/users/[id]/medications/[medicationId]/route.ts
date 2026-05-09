import { ensureApiTables, sql } from '../../../../_lib/db';
import { badRequest, ok, parseId } from '../../../../_lib/http';

export async function PUT(req: Request, { params }: { params: { id: string; medicationId: string } }) {
  await ensureApiTables();
  const userId = parseId(params.id);
  const medicationId = parseId(params.medicationId);
  const body = await req.json().catch(() => null);
  if (!userId || !medicationId) return badRequest('invalid id');
  if (!body?.name) return badRequest('name required');
  await sql`
    UPDATE user_medications
    SET name = ${body.name}
    WHERE id = ${medicationId} AND user_id = ${userId}
  `;
  return ok({ success: true });
}

export async function DELETE(_: Request, { params }: { params: { id: string; medicationId: string } }) {
  await ensureApiTables();
  const userId = parseId(params.id);
  const medicationId = parseId(params.medicationId);
  if (!userId || !medicationId) return badRequest('invalid id');
  await sql`DELETE FROM user_medications WHERE id = ${medicationId} AND user_id = ${userId}`;
  return ok({ success: true });
}
